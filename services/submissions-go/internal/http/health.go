package http

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Liveness is the cheap probe — answers "is this process alive?" without
// touching the database. Used by orchestrators for restart decisions.
func Liveness(w http.ResponseWriter, _ *http.Request) {
	JSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "leetrank-submissions-go",
	})
}

// Readiness pings Postgres with a 2s budget. Used by load balancers to
// stop routing traffic when the DB is unreachable.
func Readiness(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			JSON(w, http.StatusServiceUnavailable, map[string]any{
				"status": "down",
				"services": map[string]any{
					"database": map[string]string{"status": "down", "error": err.Error()},
				},
			})
			return
		}
		JSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"services": map[string]any{
				"database": map[string]string{"status": "ok"},
			},
		})
	}
}
