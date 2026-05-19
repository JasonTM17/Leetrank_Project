//go:build integration

// Package integration_test — account-lockout regression suite.
//
// Verifies that 11 failed logins within the lockout window flips the
// account into a locked state, that valid credentials are still
// rejected during the lock window, and that the lock auto-clears once
// the lockedUntil timestamp passes.
package integration_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const (
	lockoutEmail    = "lockme@example.com"
	lockoutUsername = "lockme"
	lockoutPassword = "correct horse battery staple"
)

// TestAccountLockout_TripsAfterTenFailures registers a user, fails
// login 10 times, asserts the 11th call (with the right password) is
// blocked with 429+account_locked, then forces the lock window to
// expire and asserts a successful login.
func TestAccountLockout_TripsAfterTenFailures(t *testing.T) {
	pool := withPostgres(t)
	handler, _ := buildServer(t, pool)
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)

	// 1. register
	reg := post(t, srv, "/v1/auth/register", map[string]string{
		"email":    lockoutEmail,
		"username": lockoutUsername,
		"password": lockoutPassword,
	})
	if reg.StatusCode != http.StatusCreated {
		t.Fatalf("register status = %d", reg.StatusCode)
	}
	reg.Body.Close()

	// 2. drop the in-memory rate limiter (5/15min) so we can drive the
	//    persistent lockout policy directly. We do this by hitting
	//    /v1/auth/login enough times that the in-memory limiter would
	//    block. The handler also persists every failure to LoginAttempt,
	//    so a fresh httptest.Server per call would normally reset the
	//    in-memory limiter — but reusing the server is what makes this
	//    test exercise the production path. We work around the in-memory
	//    block by clearing it via a fresh handler on each iteration.
	for i := 0; i < lockoutThreshold; i++ {
		freshHandler, _ := buildServer(t, pool)
		freshSrv := httptest.NewServer(freshHandler)
		bad := post(t, freshSrv, "/v1/auth/login", map[string]string{
			"identifier": lockoutUsername,
			"password":   "wrong-password",
		})
		bad.Body.Close()
		if i < lockoutThreshold-1 && bad.StatusCode != http.StatusUnauthorized {
			freshSrv.Close()
			t.Fatalf("iteration %d: status = %d, want 401", i, bad.StatusCode)
		}
		freshSrv.Close()
	}

	// 3. The 11th attempt — even with the right password — must be
	//    locked out. Use a fresh server again to bypass the in-memory
	//    rate limit.
	finalHandler, _ := buildServer(t, pool)
	finalSrv := httptest.NewServer(finalHandler)
	t.Cleanup(finalSrv.Close)

	locked := post(t, finalSrv, "/v1/auth/login", map[string]string{
		"identifier": lockoutUsername,
		"password":   lockoutPassword,
	})
	defer locked.Body.Close()
	if locked.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("11th login status = %d, want 429", locked.StatusCode)
	}
	if locked.Header.Get("Retry-After") == "" {
		t.Errorf("expected Retry-After header on 429")
	}
	body := readJSON(t, locked)
	if body["error"] != "account_locked" {
		t.Errorf("expected error=account_locked, got %q", body["error"])
	}

	// 4. Force-expire the lockout row in the DB and assert the user can
	//    log in again with the right password.
	ctx := context.Background()
	if _, err := pool.Exec(ctx,
		`UPDATE "AccountLockout" SET "lockedUntil" = $1 WHERE identifier = $2`,
		time.Now().UTC().Add(-time.Minute), lockoutUsername,
	); err != nil {
		t.Fatalf("expire lock: %v", err)
	}
	// Also clear the LoginAttempt rows so the next failure does not
	// immediately re-trip the threshold.
	if _, err := pool.Exec(ctx, `DELETE FROM "LoginAttempt" WHERE identifier = $1`, lockoutUsername); err != nil {
		t.Fatalf("clear attempts: %v", err)
	}

	postLockHandler, _ := buildServer(t, pool)
	postLockSrv := httptest.NewServer(postLockHandler)
	t.Cleanup(postLockSrv.Close)
	ok := post(t, postLockSrv, "/v1/auth/login", map[string]string{
		"identifier": lockoutUsername,
		"password":   lockoutPassword,
	})
	defer ok.Body.Close()
	if ok.StatusCode != http.StatusOK {
		t.Fatalf("post-lock login status = %d, want 200", ok.StatusCode)
	}
}

// lockoutThreshold mirrors the production constant. We keep a copy
// here so the test never imports the internal package's unexported
// identifier directly (the auth package exposes the threshold only as
// a private const).
const lockoutThreshold = 10
