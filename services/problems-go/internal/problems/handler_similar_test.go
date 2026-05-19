// Tests for the similar-problems endpoint.
//
// We exercise the early-return slug-validation path here. Full SQL
// behaviour is covered by the e2e suite.
package problems

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
)

// TestSimilarRequiresSlug — empty slug must 400.
func TestSimilarRequiresSlug(t *testing.T) {
	h := &Handler{pool: nil}
	r := httptest.NewRequest(http.MethodGet, "/v1/problems//similar", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("slug", "")
	r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()
	h.similar(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty slug, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "slug required") {
		t.Fatalf("expected 'slug required' error body, got %s", w.Body.String())
	}
}
