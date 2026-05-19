// Package auth — audit log persistence + read endpoint.
//
// Every security-relevant action on a user's account (login, logout,
// password change, profile update, account lock) writes one row into
// the AuditLog table. Users can read their own log via
// GET /v1/auth/audit-log (auth required).
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	httpx "github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/http"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	auditActionLogin           = "login"
	auditActionLogout          = "logout"
	auditActionPasswordChange  = "password_change"
	auditActionAccountLocked   = "account_locked"
	auditActionProfileUpdate   = "profile_update"
	auditActionRegister        = "register"
	auditActionPasswordReset   = "password_reset_requested"
	auditActionEmailVerified   = "email_verified"
	auditActionEmailVerifySent = "email_verification_sent"
)

// audit writes one AuditLog row. Best-effort: any DB error is silently
// dropped so a failed audit write never breaks the parent request.
//
// userID may be empty for events not tied to a specific user (e.g. a
// failed login against an unknown identifier that nevertheless trips
// the lockout counter).
func (h *handler) audit(ctx context.Context, userID, action, ip, userAgent string, meta map[string]any) {
	if h.pool == nil {
		return
	}
	var (
		userIDArg any = nil
		metaArg   any = nil
	)
	if userID != "" {
		userIDArg = userID
	}
	if len(meta) > 0 {
		buf, err := json.Marshal(meta)
		if err == nil {
			metaArg = string(buf)
		}
	}
	_, _ = h.pool.Exec(ctx,
		`INSERT INTO "AuditLog" ("userId", action, "ipAddress", "userAgent", metadata)
		 VALUES ($1, $2, $3, $4, $5)`,
		userIDArg, action, ip, userAgent, metaArg,
	)
}

// auditLogEntry is the JSON shape returned by GET /v1/auth/audit-log.
type auditLogEntry struct {
	ID        int64          `json:"id"`
	Action    string         `json:"action"`
	IPAddress string         `json:"ipAddress,omitempty"`
	UserAgent string         `json:"userAgent,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
}

// auditLog handles GET /v1/auth/audit-log — returns the caller's last
// 50 audit rows in reverse-chronological order. `limit` query param
// (1..200) overrides the default.
func (h *handler) auditLog(w http.ResponseWriter, r *http.Request) {
	claims, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			if n > 200 {
				n = 200
			}
			limit = n
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := h.pool.Query(ctx,
		`SELECT id, action, COALESCE("ipAddress", ''), COALESCE("userAgent", ''),
		        metadata::text, "createdAt"
		 FROM "AuditLog"
		 WHERE "userId" = $1
		 ORDER BY "createdAt" DESC
		 LIMIT $2`,
		claims.Subject, limit,
	)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer rows.Close()

	out := make([]auditLogEntry, 0, limit)
	for rows.Next() {
		var (
			e       auditLogEntry
			metaRaw *string
		)
		if err := rows.Scan(&e.ID, &e.Action, &e.IPAddress, &e.UserAgent, &metaRaw, &e.CreatedAt); err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
			return
		}
		if metaRaw != nil && *metaRaw != "" {
			m := map[string]any{}
			if err := json.Unmarshal([]byte(*metaRaw), &m); err == nil {
				e.Metadata = m
			}
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil && !errors.Is(err, context.Canceled) {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"entries": out,
		"limit":   limit,
	})
}

// recentAuditCount is exposed for tests that need to assert audit rows
// were written without exposing the pool directly.
func recentAuditCount(ctx context.Context, pool *pgxpool.Pool, userID, action string) (int, error) {
	if pool == nil {
		return 0, nil
	}
	var count int
	err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM "AuditLog" WHERE "userId" = $1 AND action = $2`,
		userID, action,
	).Scan(&count)
	return count, err
}
