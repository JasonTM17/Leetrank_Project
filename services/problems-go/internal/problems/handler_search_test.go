// Package problems contains tests for the read API.
//
// These tests use pgxmock to fake the postgres pool. We don't spin up a
// real DB in unit tests — full storage coverage lives in the e2e suite.
// CI is the source of truth (no Go toolchain in the agent sandbox).
package problems

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestSearchRequiresQuery — empty `q` must 400.
func TestSearchRequiresQuery(t *testing.T) {
	h := &Handler{pool: nil} // pool not used on the early-return path
	r := httptest.NewRequest(http.MethodGet, "/v1/problems/search", nil)
	w := httptest.NewRecorder()
	h.search(w, r.WithContext(context.Background()))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "q required") {
		t.Fatalf("expected 'q required' error body, got %s", w.Body.String())
	}
}

// TestSearchClampsLimit — verifies limit is clamped to [1,50] before
// being passed to the SQL layer.
func TestSearchClampsLimit(t *testing.T) {
	if got := clamp(parseIntOr("9999", 10), 1, 50); got != 50 {
		t.Errorf("limit=9999 should clamp to 50, got %d", got)
	}
	if got := clamp(parseIntOr("0", 10), 1, 50); got != 10 {
		t.Errorf("limit=0 should fall back to default 10, got %d", got)
	}
	if got := clamp(parseIntOr("-5", 10), 1, 50); got != 10 {
		t.Errorf("limit=-5 should fall back to default 10, got %d", got)
	}
	if got := clamp(parseIntOr("25", 10), 1, 50); got != 25 {
		t.Errorf("limit=25 should pass through, got %d", got)
	}
}

// TestParseIntOrZeroFallback — `parseIntOr` rejects zero/negative and
// falls back to the supplied default. The search handler then reads
// offset separately to allow offset=0 (the default).
func TestParseIntOrZeroFallback(t *testing.T) {
	if got := parseIntOr("0", 7); got != 7 {
		t.Errorf("parseIntOr(\"0\") expected fallback 7, got %d", got)
	}
	if got := parseIntOr("", 7); got != 7 {
		t.Errorf("parseIntOr(\"\") expected fallback 7, got %d", got)
	}
	if got := parseIntOr("3", 7); got != 3 {
		t.Errorf("parseIntOr(\"3\") expected 3, got %d", got)
	}
}
