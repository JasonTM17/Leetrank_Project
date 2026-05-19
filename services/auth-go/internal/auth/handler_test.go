package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/jwks"
	"github.com/go-chi/chi/v5"
)

// These tests cover every code path in handler.go that does not require a
// live Postgres connection — i.e., body validation, auth-required gates,
// rate-limit short-circuit, and the cookie-clear branch of /logout. Tests
// that touch pool.QueryRow / pool.Exec are integration-only and live in
// services/auth-go/test/integration (not in this PR).

// newTestHandler returns a handler with no pool — only safe for paths
// that never reach the DB. Builds its own JWT keystore so /me and
// change-password can decode cookies in tests.
func newTestHandler(t *testing.T) *handler {
	t.Helper()
	ks, err := jwks.New("test-secret-32-chars-minimum-aaaa")
	if err != nil {
		t.Fatalf("jwks.New: %v", err)
	}
	return &handler{
		pool:      nil,
		ks:        ks,
		accountRL: newRateLimiter(),
		ipRL:      newRateLimiter(),
	}
}

func newRouter(h *handler) http.Handler {
	r := chi.NewRouter()
	r.Post("/auth/register", h.register)
	r.Post("/auth/login", h.login)
	r.Post("/auth/logout", h.logout)
	r.Get("/auth/me", h.me)
	r.Post("/auth/change-password", h.changePassword)
	return r
}

func doJSON(t *testing.T, router http.Handler, method, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func doRaw(t *testing.T, router http.Handler, method, path, raw string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func decodeError(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var out map[string]string
	if err := json.NewDecoder(w.Body).Decode(&out); err != nil {
		return ""
	}
	return out["error"]
}

// ── /register validation ─────────────────────────────────────────────────────

func TestRegister_InvalidJSON(t *testing.T) {
	router := newRouter(newTestHandler(t))
	w := doRaw(t, router, http.MethodPost, "/auth/register", "not-json")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", w.Code)
	}
	if !strings.Contains(decodeError(t, w), "invalid JSON") {
		t.Fatalf("missing JSON error message: %q", w.Body.String())
	}
}

func TestRegister_InvalidEmail(t *testing.T) {
	router := newRouter(newTestHandler(t))
	cases := []string{"", "not-an-email", "@example.com", "user@host"}
	for _, email := range cases {
		w := doJSON(t, router, http.MethodPost, "/auth/register", map[string]string{
			"email":    email,
			"username": "validname",
			"password": "longenough",
		})
		if w.Code != http.StatusBadRequest {
			t.Errorf("email=%q: got %d, want 400", email, w.Code)
		}
		if !strings.Contains(decodeError(t, w), "email") {
			t.Errorf("email=%q: error did not mention email: %s", email, w.Body.String())
		}
	}
}

func TestRegister_InvalidUsername(t *testing.T) {
	router := newRouter(newTestHandler(t))
	cases := []string{"", "ab", "Has-Caps", "with space", "with.dot"}
	for _, username := range cases {
		w := doJSON(t, router, http.MethodPost, "/auth/register", map[string]string{
			"email":    "u@e.io",
			"username": username,
			"password": "longenough",
		})
		if w.Code != http.StatusBadRequest {
			t.Errorf("username=%q: got %d, want 400", username, w.Code)
		}
		if !strings.Contains(decodeError(t, w), "username") {
			t.Errorf("username=%q: error did not mention username", username)
		}
	}
}

func TestRegister_ShortPassword(t *testing.T) {
	router := newRouter(newTestHandler(t))
	w := doJSON(t, router, http.MethodPost, "/auth/register", map[string]string{
		"email":    "u@e.io",
		"username": "validname",
		"password": "short",
	})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", w.Code)
	}
	if !strings.Contains(decodeError(t, w), "8 characters") {
		t.Fatalf("expected 8-char message, got %q", w.Body.String())
	}
}

// ── /login validation + rate limit ───────────────────────────────────────────

func TestLogin_InvalidJSON(t *testing.T) {
	router := newRouter(newTestHandler(t))
	w := doRaw(t, router, http.MethodPost, "/auth/login", "{nope")
	if w.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", w.Code)
	}
}

func TestLogin_RateLimited_PerAccount(t *testing.T) {
	h := newTestHandler(t)
	router := newRouter(h)

	// Pre-saturate the per-account window.
	for i := 0; i < rateLimitMax; i++ {
		_, _ = h.accountRL.allow("user@test")
	}

	w := doJSON(t, router, http.MethodPost, "/auth/login", map[string]string{
		"identifier": "user@test",
		"password":   "anything",
	})
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("got %d, want 429", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Fatal("expected Retry-After header on 429")
	}
}

func TestLogin_RateLimited_PerIP(t *testing.T) {
	h := newTestHandler(t)
	router := newRouter(h)

	// Pre-saturate the per-IP window for httptest's default RemoteAddr.
	for i := 0; i < rateLimitMax; i++ {
		_, _ = h.ipRL.allow("192.0.2.1:1234")
	}

	req := httptest.NewRequest(http.MethodPost, "/auth/login",
		strings.NewReader(`{"identifier":"x","password":"y"}`))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.1:1234"
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("got %d, want 429", w.Code)
	}
}

// ── /me + /change-password auth gates ────────────────────────────────────────

func TestMe_NoCookie(t *testing.T) {
	router := newRouter(newTestHandler(t))
	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("got %d, want 401", w.Code)
	}
}

func TestMe_BadCookie(t *testing.T) {
	router := newRouter(newTestHandler(t))
	w := doJSON(t, router, http.MethodGet, "/auth/me", nil, &http.Cookie{
		Name:  cookieName,
		Value: "not-a-jwt",
	})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("got %d, want 401", w.Code)
	}
	if !strings.Contains(decodeError(t, w), "invalid or expired") {
		t.Fatalf("expected invalid-token message, got %s", w.Body.String())
	}
}

func TestChangePassword_NoCookie(t *testing.T) {
	router := newRouter(newTestHandler(t))
	w := doJSON(t, router, http.MethodPost, "/auth/change-password", map[string]string{
		"currentPassword": "old",
		"newPassword":     "newlongpass",
	})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("got %d, want 401", w.Code)
	}
}

func TestChangePassword_ShortNewPassword(t *testing.T) {
	h := newTestHandler(t)
	router := newRouter(h)

	// Sign a real cookie that will pass requireAuth.
	token, err := h.ks.Sign("user-1", "user", jwtAudience, cookieTTL)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	w := doJSON(t, router, http.MethodPost, "/auth/change-password",
		map[string]string{"currentPassword": "old", "newPassword": "short"},
		&http.Cookie{Name: cookieName, Value: token},
	)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400 (body %s)", w.Code, w.Body.String())
	}
	if !strings.Contains(decodeError(t, w), "8 characters") {
		t.Fatalf("missing length error: %s", w.Body.String())
	}
}

func TestChangePassword_InvalidJSON(t *testing.T) {
	h := newTestHandler(t)
	router := newRouter(h)
	token, _ := h.ks.Sign("user-1", "user", jwtAudience, cookieTTL)
	w := doRaw(t, router, http.MethodPost, "/auth/change-password", "{garbage",
		&http.Cookie{Name: cookieName, Value: token})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", w.Code)
	}
}

// ── /logout ──────────────────────────────────────────────────────────────────

func TestLogout_AlwaysOK(t *testing.T) {
	router := newRouter(newTestHandler(t))
	w := doJSON(t, router, http.MethodPost, "/auth/logout", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200", w.Code)
	}
	// Cookie cleared with MaxAge < 0
	cookies := w.Result().Cookies()
	var cleared *http.Cookie
	for _, c := range cookies {
		if c.Name == cookieName {
			cleared = c
		}
	}
	if cleared == nil {
		t.Fatal("expected Set-Cookie clearing session")
	}
	if cleared.MaxAge >= 0 {
		t.Fatalf("expected negative MaxAge, got %d", cleared.MaxAge)
	}
}

// ── notImplemented stub ──────────────────────────────────────────────────────

func TestNotImplemented_Returns501(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/auth/sessions", notImplemented)
	req := httptest.NewRequest(http.MethodGet, "/auth/sessions", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotImplemented {
		t.Fatalf("got %d, want 501", w.Code)
	}
}

// ── cookie helpers ───────────────────────────────────────────────────────────

func TestSetSessionCookie_Properties(t *testing.T) {
	w := httptest.NewRecorder()
	setSessionCookie(w, "tok")
	res := w.Result()
	got := res.Cookies()
	if len(got) != 1 {
		t.Fatalf("expected 1 cookie, got %d", len(got))
	}
	c := got[0]
	if c.Name != cookieName || c.Value != "tok" {
		t.Errorf("name/value mismatch: %+v", c)
	}
	if !c.HttpOnly {
		t.Error("expected HttpOnly")
	}
	if !c.Secure {
		t.Error("expected Secure")
	}
	if c.SameSite != http.SameSiteLaxMode {
		t.Errorf("expected SameSite=Lax, got %v", c.SameSite)
	}
	if c.MaxAge != int(cookieTTL.Seconds()) {
		t.Errorf("expected MaxAge=%d, got %d", int(cookieTTL.Seconds()), c.MaxAge)
	}
	if w.Header().Get("Authorization") != "Bearer tok" {
		t.Errorf("expected Authorization=Bearer tok, got %q", w.Header().Get("Authorization"))
	}
}

func TestClearSessionCookie_Properties(t *testing.T) {
	w := httptest.NewRecorder()
	clearSessionCookie(w)
	res := w.Result()
	if len(res.Cookies()) != 1 {
		t.Fatalf("expected 1 cookie, got %d", len(res.Cookies()))
	}
	c := res.Cookies()[0]
	if c.MaxAge >= 0 {
		t.Errorf("expected negative MaxAge, got %d", c.MaxAge)
	}
}

// ── boundary check: cookie TTL is sane ───────────────────────────────────────

func TestCookieTTL_Is7Days(t *testing.T) {
	if cookieTTL != 7*24*time.Hour {
		t.Fatalf("cookieTTL changed unexpectedly: %v", cookieTTL)
	}
}
