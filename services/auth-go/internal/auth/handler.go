// Package auth ships 501 stubs for the migration-target endpoints.
//
// Caddy can already route /api/v1/auth/* to leetrank-auth-go without
// breaking anything. Phase 3.1.5 fills in the real handlers (register,
// login, me, logout, change-password) backed by Postgres + bcrypt cost
// 12 + Ed25519-signed JWTs.
package auth

import (
	"net/http"

	httpx "github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/http"
	"github.com/go-chi/chi/v5"
)

func Router() http.Handler {
	r := chi.NewRouter()
	r.Post("/register", notImplemented)
	r.Post("/login", notImplemented)
	r.Post("/logout", notImplemented)
	r.Get("/me", notImplemented)
	r.Post("/change-password", notImplemented)
	r.Get("/sessions", notImplemented)
	return r
}

func notImplemented(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusNotImplemented, map[string]string{
		"error":   "Not implemented yet — Phase 3.1.5",
		"service": "leetrank-auth-go",
	})
}
