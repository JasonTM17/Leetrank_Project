// Package auth implements the real handlers for register, login, me,
// logout, and change-password backed by Postgres + bcrypt cost 12 +
// HS256-signed JWTs (Phase 3.1.5).
package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	httpx "github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/http"
	"github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/jwks"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const (
	cookieName   = "leetrank_session"
	jwtAudience  = "leetrank"
	cookieTTL    = 7 * 24 * time.Hour
	rateLimitMax = 5
	rateLimitWin = 15 * time.Minute
)

// dummyHash is computed once at startup so login-miss paths still run a
// full bcrypt comparison, preventing timing-based user enumeration.
var dummyHash []byte

func init() {
	h, err := bcrypt.GenerateFromPassword([]byte("dummy-constant-password-for-timing-attack-prevention"), 12)
	if err != nil {
		panic("auth: bcrypt dummy hash init: " + err.Error())
	}
	dummyHash = h
}

// ── rate limiter ──────────────────────────────────────────────────────────────

type attempt struct {
	count     int
	windowEnd time.Time
}

type rateLimiter struct {
	mu      sync.Mutex
	entries map[string]*attempt
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{entries: make(map[string]*attempt)}
}

// allow returns (allowed, retryAfterSeconds). A new window is opened on
// first call or after the previous window expires.
func (rl *rateLimiter) allow(key string) (bool, int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	e, ok := rl.entries[key]
	if !ok || now.After(e.windowEnd) {
		rl.entries[key] = &attempt{count: 1, windowEnd: now.Add(rateLimitWin)}
		return true, 0
	}
	e.count++
	if e.count > rateLimitMax {
		secs := int(e.windowEnd.Sub(now).Seconds()) + 1
		return false, secs
	}
	return true, 0
}

// ── validation ────────────────────────────────────────────────────────────────

var (
	emailRe    = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	usernameRe = regexp.MustCompile(`^[a-z0-9_]{3,30}$`)
)

// ── handler ───────────────────────────────────────────────────────────────────

type handler struct {
	pool      *pgxpool.Pool
	ks        *jwks.KeyStore
	accountRL *rateLimiter
	ipRL      *rateLimiter
}

// Router wires the auth sub-router. pool and ks are injected by main.
func Router(pool *pgxpool.Pool, ks *jwks.KeyStore) http.Handler {
	h := &handler{
		pool:      pool,
		ks:        ks,
		accountRL: newRateLimiter(),
		ipRL:      newRateLimiter(),
	}
	r := chi.NewRouter()
	r.Post("/register", h.register)
	r.Post("/login", h.login)
	r.Post("/logout", h.logout)
	r.Get("/me", h.me)
	r.Post("/change-password", h.changePassword)
	r.Get("/sessions", notImplemented) // Session model not yet in schema
	return r
}

// ── helpers ───────────────────────────────────────────────────────────────────

func setSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(cookieTTL.Seconds()),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	w.Header().Set("Authorization", "Bearer "+token)
}

func clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

func decodeBody(r *http.Request, dst any) error {
	return json.NewDecoder(r.Body).Decode(dst)
}

// ── register ──────────────────────────────────────────────────────────────────

type registerRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type userResponse struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

func (h *handler) register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := decodeBody(r, &req); err != nil {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	req.Username = strings.TrimSpace(req.Username)

	switch {
	case !emailRe.MatchString(req.Email):
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid email address"})
		return
	case !usernameRe.MatchString(req.Username):
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "username must be 3-30 characters and contain only lowercase letters, numbers, or underscores"})
		return
	case len(req.Password) < 8:
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 8 characters"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Conflict check — anti-enumeration: single generic message for both cases.
	var exists int
	err := h.pool.QueryRow(ctx,
		`SELECT 1 FROM "User" WHERE email = $1 OR username = $2 LIMIT 1`,
		req.Email, req.Username,
	).Scan(&exists)
	if err == nil {
		// Row found — conflict.
		httpx.JSON(w, http.StatusConflict, map[string]string{"error": "email or username already in use"})
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	id := uuid.NewString()
	now := time.Now().UTC()

	_, err = h.pool.Exec(ctx,
		`INSERT INTO "User" (id, email, username, password, role, "createdAt", "updatedAt")
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		id, req.Email, req.Username, string(hash), "user", now, now,
	)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	token, err := h.ks.Sign(id, "user", jwtAudience, cookieTTL)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	setSessionCookie(w, token)
	httpx.JSON(w, http.StatusCreated, map[string]any{
		"user": userResponse{
			ID:        id,
			Email:     req.Email,
			Username:  req.Username,
			Role:      "user",
			CreatedAt: now,
		},
		"token": token,
	})
}

// ── login ─────────────────────────────────────────────────────────────────────

type loginRequest struct {
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
}

func (h *handler) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeBody(r, &req); err != nil {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	req.Identifier = strings.TrimSpace(req.Identifier)

	// Per-account rate limit (keyed by lower-cased identifier).
	accountKey := strings.ToLower(req.Identifier)
	if ok, retryAfter := h.accountRL.allow(accountKey); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
		httpx.JSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many login attempts, please try again later"})
		return
	}

	// Per-IP rate limit (use RemoteAddr directly — spoof-resistant during dev).
	if ok, retryAfter := h.ipRL.allow(r.RemoteAddr); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
		httpx.JSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many login attempts, please try again later"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var (
		id        string
		email     string
		username  string
		role      string
		createdAt time.Time
		hashStr   string
	)
	err := h.pool.QueryRow(ctx,
		`SELECT id, email, username, password, role, "createdAt"
		 FROM "User"
		 WHERE email = $1 OR username = $1
		 LIMIT 1`,
		req.Identifier,
	).Scan(&id, &email, &username, &hashStr, &role, &createdAt)

	if err != nil {
		// User not found — still run bcrypt to prevent timing enumeration.
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashStr), []byte(req.Password)); err != nil {
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	token, err := h.ks.Sign(id, role, jwtAudience, cookieTTL)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	setSessionCookie(w, token)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"user": userResponse{
			ID:        id,
			Email:     email,
			Username:  username,
			Role:      role,
			CreatedAt: createdAt,
		},
		"token": token,
	})
}

// ── me ────────────────────────────────────────────────────────────────────────

func (h *handler) me(w http.ResponseWriter, r *http.Request) {
	claims, ok := h.requireAuth(w, r)
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var (
		id       string
		email    string
		username string
		role     string
	)
	err := h.pool.QueryRow(ctx,
		`SELECT id, email, username, role FROM "User" WHERE id = $1`,
		claims.Subject,
	).Scan(&id, &email, &username, &role)
	if err != nil {
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "user not found"})
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"user": map[string]string{
			"id":       id,
			"email":    email,
			"username": username,
			"role":     role,
		},
	})
}

// ── logout ────────────────────────────────────────────────────────────────────

func (h *handler) logout(w http.ResponseWriter, r *http.Request) {
	clearSessionCookie(w)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ── change-password ───────────────────────────────────────────────────────────

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func (h *handler) changePassword(w http.ResponseWriter, r *http.Request) {
	claims, ok := h.requireAuth(w, r)
	if !ok {
		return
	}

	var req changePasswordRequest
	if err := decodeBody(r, &req); err != nil {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if len(req.NewPassword) < 8 {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "new password must be at least 8 characters"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var hashStr string
	err := h.pool.QueryRow(ctx,
		`SELECT password FROM "User" WHERE id = $1`,
		claims.Subject,
	).Scan(&hashStr)
	if err != nil {
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "user not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashStr), []byte(req.CurrentPassword)); err != nil {
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "current password is incorrect"})
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	now := time.Now().UTC()
	_, err = h.pool.Exec(ctx,
		`UPDATE "User" SET password = $1, "updatedAt" = $2 WHERE id = $3`,
		string(newHash), now, claims.Subject,
	)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ── auth middleware helper ────────────────────────────────────────────────────

func (h *handler) requireAuth(w http.ResponseWriter, r *http.Request) (*jwks.Claims, bool) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return nil, false
	}
	claims, err := h.ks.Verify(cookie.Value, jwtAudience)
	if err != nil {
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired session"})
		return nil, false
	}
	return claims, true
}

// ── stub ──────────────────────────────────────────────────────────────────────

func notImplemented(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusNotImplemented, map[string]string{
		"error":   "Not implemented yet — Session model pending",
		"service": "leetrank-auth-go",
	})
}
