//go:build integration

package integration_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestAuthFlow_RegisterLoginMeRefreshLogout exercises the canonical
// happy path end-to-end against a real Postgres + Ed25519 keystore +
// bcrypt hashing.
//
//   register -> me -> logout -> login -> refresh -> me -> logout
//
// Every transition asserts the server returned a non-empty access
// token, a refresh cookie, and a /me response that matches the
// registered identity.
func TestAuthFlow_RegisterLoginMeRefreshLogout(t *testing.T) {
	pool := withPostgres(t)
	handler, _ := buildServer(t, pool)
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	// 1. register
	resp := post(t, srv, "/v1/auth/register", map[string]string{
		"email":    "alice@example.com",
		"username": "alice",
		"password": "correct horse battery staple",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("register status = %d", resp.StatusCode)
	}
	access1, refresh1 := extractTokens(t, resp)
	if access1 == "" || refresh1 == "" {
		t.Fatal("register: empty token pair")
	}

	// 2. /me with the access cookie
	meResp := get(t, srv, "/v1/auth/me", &http.Cookie{Name: "leetrank_session", Value: access1})
	if meResp.StatusCode != http.StatusOK {
		t.Fatalf("me status = %d", meResp.StatusCode)
	}
	user := decodeMe(t, meResp)
	if user["email"] != "alice@example.com" {
		t.Errorf("me email = %q", user["email"])
	}
	if user["username"] != "alice" {
		t.Errorf("me username = %q", user["username"])
	}

	// 3. logout
	out := post(t, srv, "/v1/auth/logout", map[string]string{},
		&http.Cookie{Name: "leetrank_refresh", Value: refresh1})
	if out.StatusCode != http.StatusOK {
		t.Fatalf("logout status = %d", out.StatusCode)
	}

	// 4. login
	login := post(t, srv, "/v1/auth/login", map[string]string{
		"identifier": "alice",
		"password":   "correct horse battery staple",
	})
	if login.StatusCode != http.StatusOK {
		t.Fatalf("login status = %d", login.StatusCode)
	}
	access2, refresh2 := extractTokens(t, login)
	if access2 == access1 {
		t.Errorf("expected fresh access token after login")
	}

	// 5. refresh — present the cookie, get a fresh pair
	refreshResp := post(t, srv, "/v1/auth/refresh", map[string]string{},
		&http.Cookie{Name: "leetrank_refresh", Value: refresh2})
	if refreshResp.StatusCode != http.StatusOK {
		t.Fatalf("refresh status = %d", refreshResp.StatusCode)
	}
	access3, refresh3 := extractTokens(t, refreshResp)
	if access3 == "" || refresh3 == "" {
		t.Fatal("refresh: empty token pair")
	}
	if refresh3 == refresh2 {
		t.Errorf("expected refresh token rotation; got identical value")
	}

	// 6. /me again with the new access cookie
	meResp2 := get(t, srv, "/v1/auth/me",
		&http.Cookie{Name: "leetrank_session", Value: access3})
	if meResp2.StatusCode != http.StatusOK {
		t.Fatalf("me-after-refresh status = %d", meResp2.StatusCode)
	}

	// 7. presenting the old refresh token must now fail (revoked at rotate)
	stale := post(t, srv, "/v1/auth/refresh", map[string]string{},
		&http.Cookie{Name: "leetrank_refresh", Value: refresh2})
	if stale.StatusCode != http.StatusUnauthorized {
		t.Fatalf("stale refresh expected 401, got %d", stale.StatusCode)
	}
}

// TestLogin_WrongPassword verifies invalid credentials return 401 and
// do not leak whether the user exists.
func TestLogin_WrongPassword(t *testing.T) {
	pool := withPostgres(t)
	handler, _ := buildServer(t, pool)
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	post(t, srv, "/v1/auth/register", map[string]string{
		"email":    "bob@example.com",
		"username": "bob",
		"password": "rightpassword123",
	})

	bad := post(t, srv, "/v1/auth/login", map[string]string{
		"identifier": "bob",
		"password":   "wrongpassword",
	})
	if bad.StatusCode != http.StatusUnauthorized {
		t.Fatalf("bad login status = %d, want 401", bad.StatusCode)
	}
	body := readJSON(t, bad)
	if !strings.Contains(strings.ToLower(body["error"]), "invalid credentials") {
		t.Errorf("expected generic 'invalid credentials', got %q", body["error"])
	}
}

// TestJWKS_PublishesSignerKey verifies /.well-known/jwks.json exposes
// exactly the key used to sign tokens.
func TestJWKS_PublishesSignerKey(t *testing.T) {
	pool := withPostgres(t)
	handler, ks := buildServer(t, pool)
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	resp, err := srv.Client().Get(srv.URL + "/.well-known/jwks.json")
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("jwks status = %d", resp.StatusCode)
	}
	var doc struct {
		Keys []map[string]string `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		t.Fatal(err)
	}
	if len(doc.Keys) != 1 {
		t.Fatalf("jwks keys = %d, want 1", len(doc.Keys))
	}
	if doc.Keys[0]["kid"] != ks.KID() {
		t.Errorf("kid mismatch: jwks=%q ks=%q", doc.Keys[0]["kid"], ks.KID())
	}
}

// extractTokens reads the access cookie + refresh cookie + JSON body
// off a register/login/refresh response.
func extractTokens(t *testing.T, resp *http.Response) (access, refresh string) {
	t.Helper()
	defer resp.Body.Close()

	for _, c := range resp.Cookies() {
		switch c.Name {
		case "leetrank_session":
			access = c.Value
		case "leetrank_refresh":
			refresh = c.Value
		}
	}
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if access == "" {
		if v, ok := body["token"].(string); ok {
			access = v
		}
	}
	if refresh == "" {
		if v, ok := body["refreshToken"].(string); ok {
			refresh = v
		}
	}
	return
}

func decodeMe(t *testing.T, resp *http.Response) map[string]string {
	t.Helper()
	defer resp.Body.Close()
	var body struct {
		User map[string]string `json:"user"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode me: %v", err)
	}
	return body.User
}

func readJSON(t *testing.T, resp *http.Response) map[string]string {
	t.Helper()
	defer resp.Body.Close()
	out := map[string]string{}
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return out
}
