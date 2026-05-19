// Package auth — forgot-password + email verification flows.
//
// These are placeholder flows: tokens are generated, hashed, and stored
// in Postgres so callers/tests can drive the full lifecycle, but no
// actual email is sent. Production wiring (SMTP / SES / Postmark) is
// deferred to a later phase.
//
// Anti-enumeration: forgot-password always returns 202 regardless of
// whether the email matches a real user. resend-verification ditto.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"time"

	httpx "github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/http"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// passwordResetTTL is how long a password-reset token remains valid.
	passwordResetTTL = time.Hour
	// emailVerifyTTL is how long an email-verification token remains valid.
	emailVerifyTTL = 24 * time.Hour
)

// newOpaqueToken returns (plain, hash). plain is delivered to the user
// (e.g. embedded in a verification link); only its sha256 lives in the DB.
func newOpaqueToken() (plain, hash string, err error) {
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", "", err
	}
	plain = base64.RawURLEncoding.EncodeToString(raw[:])
	sum := sha256.Sum256([]byte(plain))
	hash = base64.RawURLEncoding.EncodeToString(sum[:])
	return plain, hash, nil
}

func hashOpaqueToken(plain string) string {
	sum := sha256.Sum256([]byte(plain))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// ── forgot-password / reset-password ─────────────────────────────────────────

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

// forgotPassword always returns 202 to avoid leaking whether an email
// is registered. When the email matches a real user, a single-use
// reset token is persisted (its plaintext is exposed back to the
// caller in dev mode only — see `LEETRANK_DEV_RETURN_RESET_TOKEN`).
func (h *handler) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotPasswordRequest
	if err := decodeBody(r, &req); err != nil {
		// Still 202 — we never tell the caller anything actionable.
		httpx.JSON(w, http.StatusAccepted, map[string]string{"status": "accepted"})
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if !emailRe.MatchString(req.Email) {
		httpx.JSON(w, http.StatusAccepted, map[string]string{"status": "accepted"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var (
		userID string
		token  string
	)
	if err := h.pool.QueryRow(ctx,
		`SELECT id FROM "User" WHERE email = $1`, req.Email,
	).Scan(&userID); err == nil {
		plain, hash, err := newOpaqueToken()
		if err == nil {
			expiresAt := time.Now().UTC().Add(passwordResetTTL)
			if _, dberr := h.pool.Exec(ctx,
				`INSERT INTO "PasswordResetToken" ("tokenHash", "userId", "expiresAt")
				 VALUES ($1, $2, $3)`,
				hash, userID, expiresAt,
			); dberr == nil {
				token = plain
			}
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		// Drop the error silently — endpoint must not leak existence.
	}

	resp := map[string]string{"status": "accepted"}
	// Only return token in non-prod debug mode for tests/local dev.
	if token != "" && isDevReturnTokens() {
		resp["resetToken"] = token
	}
	httpx.JSON(w, http.StatusAccepted, resp)
}

type resetPasswordRequest struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

// resetPassword consumes a reset token and updates the user's password.
func (h *handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetPasswordRequest
	if err := decodeBody(r, &req); err != nil {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "token required"})
		return
	}
	if len(req.NewPassword) < 8 {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "new password must be at least 8 characters"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	hash := hashOpaqueToken(req.Token)
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		userID    string
		expiresAt time.Time
		usedAt    *time.Time
	)
	err = tx.QueryRow(ctx,
		`SELECT "userId", "expiresAt", "usedAt"
		 FROM "PasswordResetToken" WHERE "tokenHash" = $1`,
		hash,
	).Scan(&userID, &expiresAt, &usedAt)
	if err != nil || usedAt != nil || time.Now().After(expiresAt) {
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
		return
	}

	if _, err := tx.Exec(ctx,
		`UPDATE "PasswordResetToken" SET "usedAt" = NOW() WHERE "tokenHash" = $1`,
		hash,
	); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	newHash, err := bcryptHash([]byte(req.NewPassword))
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	if _, err := tx.Exec(ctx,
		`UPDATE "User" SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
		newHash, userID,
	); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ── verify-email / resend-verification ───────────────────────────────────────

type verifyEmailRequest struct {
	Token string `json:"token"`
}

// verifyEmail consumes a verification token and flips
// User."emailVerified" = true.
func (h *handler) verifyEmail(w http.ResponseWriter, r *http.Request) {
	var req verifyEmailRequest
	if err := decodeBody(r, &req); err != nil {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "token required"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	hash := hashOpaqueToken(req.Token)
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		userID    string
		expiresAt time.Time
		usedAt    *time.Time
	)
	err = tx.QueryRow(ctx,
		`SELECT "userId", "expiresAt", "usedAt"
		 FROM "EmailVerificationToken" WHERE "tokenHash" = $1`,
		hash,
	).Scan(&userID, &expiresAt, &usedAt)
	if err != nil || usedAt != nil || time.Now().After(expiresAt) {
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired token"})
		return
	}
	if _, err := tx.Exec(ctx,
		`UPDATE "EmailVerificationToken" SET "usedAt" = NOW() WHERE "tokenHash" = $1`,
		hash,
	); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	if _, err := tx.Exec(ctx,
		`UPDATE "User" SET "emailVerified" = true, "updatedAt" = NOW() WHERE id = $1`,
		userID,
	); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// resendVerification issues a fresh verification token. Anti-enumeration:
// always returns 202 even when authenticated user has no email or is
// already verified.
func (h *handler) resendVerification(w http.ResponseWriter, r *http.Request) {
	claims, ok := h.requireAuth(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	plain, _, _ := issueEmailVerification(ctx, h.pool, claims.Subject)
	resp := map[string]string{"status": "accepted"}
	if plain != "" && isDevReturnTokens() {
		resp["verifyToken"] = plain
	}
	httpx.JSON(w, http.StatusAccepted, resp)
}

// issueEmailVerification creates and stores a fresh verification token
// for userID. Returns the plaintext (caller decides whether to email
// or log it).
func issueEmailVerification(ctx context.Context, pool *pgxpool.Pool, userID string) (plain, hash string, err error) {
	if pool == nil {
		return "", "", errors.New("auth: pool not configured")
	}
	plain, hash, err = newOpaqueToken()
	if err != nil {
		return "", "", err
	}
	expiresAt := time.Now().UTC().Add(emailVerifyTTL)
	_, err = pool.Exec(ctx,
		`INSERT INTO "EmailVerificationToken" ("tokenHash", "userId", "expiresAt")
		 VALUES ($1, $2, $3)`,
		hash, userID, expiresAt,
	)
	if err != nil {
		return "", "", err
	}
	return plain, hash, nil
}
