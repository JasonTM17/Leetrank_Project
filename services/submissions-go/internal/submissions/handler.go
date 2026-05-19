// Package submissions implements the HTTP handlers for the submissions
// read/write API. POST /v1/submissions is a 501 stub — Phase 3.2 fills
// in judge dispatch. All other routes are fully implemented against
// Postgres via pgx direct queries (no ORM).
package submissions

import (
	"net/http"
	"strconv"
	"strings"

	httpx "github.com/JasonTM17/Leetrank_Project/services/submissions-go/internal/http"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler holds the DB pool shared across all submission endpoints.
type Handler struct {
	pool *pgxpool.Pool
}

// New returns a Handler backed by pool.
func New(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

// Router mounts all /v1/submissions routes onto a new chi sub-router.
func (h *Handler) Router() http.Handler {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/recent", h.recent)
	r.Get("/{id}", h.get)
	r.Get("/{id}/stream", h.stream)
	return r
}

// submissionRow is the shape returned by list/get queries.
type submissionRow struct {
	ID        string  `json:"id"`
	ProblemID string  `json:"problemId"`
	Language  string  `json:"language"`
	Status    string  `json:"status"`
	Runtime   *int    `json:"runtime,omitempty"`
	Memory    *int    `json:"memory,omitempty"`
	CreatedAt string  `json:"createdAt"`
}

// recentRow is the public feed shape (no code, no error).
type recentRow struct {
	ID           string `json:"id"`
	UserID       string `json:"userId"`
	ProblemID    string `json:"problemId"`
	ProblemSlug  string `json:"problemSlug"`
	ProblemTitle string `json:"problemTitle"`
	Language     string `json:"language"`
	Status       string `json:"status"`
	CreatedAt    string `json:"createdAt"`
}

// GET /v1/submissions — list the authenticated user's submissions.
// Query params: problemId (optional), page (default 1), limit (default 20, max 100).
//
// Auth: reads X-User-ID header set by the upstream gateway/auth middleware.
// Returns 401 if the header is absent.
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	problemID := r.URL.Query().Get("problemId")
	page := parseIntOr(r.URL.Query().Get("page"), 1)
	limit := clamp(parseIntOr(r.URL.Query().Get("limit"), 20), 1, 100)
	offset := (page - 1) * limit

	var (
		rows []submissionRow
		total int
	)

	if problemID != "" {
		// Count
		err := h.pool.QueryRow(r.Context(),
			`SELECT COUNT(*) FROM "Submission" WHERE "userId" = $1 AND "problemId" = $2`,
			userID, problemID,
		).Scan(&total)
		if err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
		// Rows
		pgRows, err := h.pool.Query(r.Context(),
			`SELECT id, "problemId", language, status, runtime, memory, "createdAt"
			 FROM "Submission"
			 WHERE "userId" = $1 AND "problemId" = $2
			 ORDER BY "createdAt" DESC
			 LIMIT $3 OFFSET $4`,
			userID, problemID, limit, offset,
		)
		if err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
		defer pgRows.Close()
		for pgRows.Next() {
			var s submissionRow
			if err := pgRows.Scan(&s.ID, &s.ProblemID, &s.Language, &s.Status, &s.Runtime, &s.Memory, &s.CreatedAt); err != nil {
				httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
				return
			}
			rows = append(rows, s)
		}
		if err := pgRows.Err(); err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
	} else {
		// Count
		err := h.pool.QueryRow(r.Context(),
			`SELECT COUNT(*) FROM "Submission" WHERE "userId" = $1`,
			userID,
		).Scan(&total)
		if err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
		// Rows
		pgRows, err := h.pool.Query(r.Context(),
			`SELECT id, "problemId", language, status, runtime, memory, "createdAt"
			 FROM "Submission"
			 WHERE "userId" = $1
			 ORDER BY "createdAt" DESC
			 LIMIT $2 OFFSET $3`,
			userID, limit, offset,
		)
		if err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
		defer pgRows.Close()
		for pgRows.Next() {
			var s submissionRow
			if err := pgRows.Scan(&s.ID, &s.ProblemID, &s.Language, &s.Status, &s.Runtime, &s.Memory, &s.CreatedAt); err != nil {
				httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
				return
			}
			rows = append(rows, s)
		}
		if err := pgRows.Err(); err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
	}

	if rows == nil {
		rows = []submissionRow{}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"submissions": rows,
		"total":       total,
		"page":        page,
		"limit":       limit,
	})
}

// POST /v1/submissions — 501 stub. Phase 3.2 fills judge dispatch.
func (h *Handler) create(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusNotImplemented, map[string]string{
		"error":   "Not implemented yet — Phase 3.2",
		"service": "leetrank-submissions-go",
	})
}

// GET /v1/submissions/:id — fetch a single submission. Auth required.
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		httpx.JSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "id required"})
		return
	}

	var s struct {
		ID        string  `json:"id"`
		UserID    string  `json:"userId"`
		ProblemID string  `json:"problemId"`
		Language  string  `json:"language"`
		Code      string  `json:"code"`
		Status    string  `json:"status"`
		Runtime   *int    `json:"runtime,omitempty"`
		Memory    *int    `json:"memory,omitempty"`
		Output    *string `json:"output,omitempty"`
		Error     *string `json:"error,omitempty"`
		CreatedAt string  `json:"createdAt"`
	}

	err := h.pool.QueryRow(r.Context(),
		`SELECT id, "userId", "problemId", language, code, status, runtime, memory, output, error, "createdAt"
		 FROM "Submission"
		 WHERE id = $1`,
		id,
	).Scan(&s.ID, &s.UserID, &s.ProblemID, &s.Language, &s.Code, &s.Status,
		&s.Runtime, &s.Memory, &s.Output, &s.Error, &s.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			httpx.JSON(w, http.StatusNotFound, map[string]string{"error": "Submission not found"})
			return
		}
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	// Only the owner may read their own submission.
	if s.UserID != userID {
		httpx.JSON(w, http.StatusForbidden, map[string]string{"error": "Forbidden"})
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"submission": s})
}

// GET /v1/submissions/:id/stream — SSE stub. Phase 3.2 fills real streaming.
func (h *Handler) stream(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusNotImplemented, map[string]string{
		"error":   "Not implemented yet — Phase 3.2",
		"service": "leetrank-submissions-go",
	})
}

// GET /v1/submissions/recent — public recent accepted submissions feed.
// Returns the last 20 accepted submissions with problem info.
func (h *Handler) recent(w http.ResponseWriter, r *http.Request) {
	limit := clamp(parseIntOr(r.URL.Query().Get("limit"), 20), 1, 50)

	pgRows, err := h.pool.Query(r.Context(),
		`SELECT s.id, s."userId", s."problemId", p.slug, p.title, s.language, s.status, s."createdAt"
		 FROM "Submission" s
		 JOIN "Problem" p ON p.id = s."problemId"
		 WHERE s.status = 'accepted'
		 ORDER BY s."createdAt" DESC
		 LIMIT $1`,
		limit,
	)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}
	defer pgRows.Close()

	rows := make([]recentRow, 0, limit)
	for pgRows.Next() {
		var row recentRow
		if err := pgRows.Scan(&row.ID, &row.UserID, &row.ProblemID, &row.ProblemSlug,
			&row.ProblemTitle, &row.Language, &row.Status, &row.CreatedAt); err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
		rows = append(rows, row)
	}
	if err := pgRows.Err(); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=30, stale-while-revalidate=60")
	httpx.JSON(w, http.StatusOK, map[string]any{"submissions": rows})
}

func parseIntOr(s string, fallback int) int {
	if v, err := strconv.Atoi(s); err == nil && v > 0 {
		return v
	}
	return fallback
}

func clamp(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
