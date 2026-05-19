// Package problems implements the HTTP handlers for the problems read API.
// All routes are fully implemented against Postgres via pgx direct queries.
package problems

import (
	"net/http"
	"strconv"
	"strings"

	httpx "github.com/JasonTM17/Leetrank_Project/services/problems-go/internal/http"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler holds the DB pool shared across all problem endpoints.
type Handler struct {
	pool *pgxpool.Pool
}

// New returns a Handler backed by pool.
func New(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

// Router mounts all /v1/problems routes onto a new chi sub-router.
func (h *Handler) Router() http.Handler {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Get("/trending", h.trending)
	r.Get("/random", h.random)
	r.Get("/search", h.search)
	r.Get("/{slug}", h.detail)
	r.Get("/{slug}/similar", h.similar)
	return r
}

// LeaderboardRouter mounts /v1/leaderboard routes.
func (h *Handler) LeaderboardRouter() http.Handler {
	r := chi.NewRouter()
	r.Get("/top", h.leaderboardTop)
	return r
}

// ---- list ---------------------------------------------------------------

type tagRow struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type problemListItem struct {
	ID              string   `json:"id"`
	Title           string   `json:"title"`
	Slug            string   `json:"slug"`
	Difficulty      string   `json:"difficulty"`
	Tags            []tagRow `json:"tags"`
	SubmissionCount int      `json:"submissionCount"`
}

// GET /v1/problems — paginated list with optional difficulty/tag/search filters.
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	difficulty := q.Get("difficulty")
	tag := q.Get("tag")
	search := q.Get("search")
	page := parseIntOr(q.Get("page"), 1)
	limit := clamp(parseIntOr(q.Get("limit"), 50), 1, 50)
	offset := (page - 1) * limit

	// Build dynamic WHERE clause.
	conditions := []string{"1=1"}
	args := []any{}
	argIdx := 1

	if difficulty != "" {
		conditions = append(conditions, `p.difficulty = $`+strconv.Itoa(argIdx))
		args = append(args, difficulty)
		argIdx++
	}
	if search != "" {
		conditions = append(conditions, `p.title ILIKE $`+strconv.Itoa(argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if tag != "" {
		conditions = append(conditions,
			`EXISTS (SELECT 1 FROM "ProblemTag" pt JOIN "Tag" t ON t.id = pt."tagId"
			         WHERE pt."problemId" = p.id AND t.slug = $`+strconv.Itoa(argIdx)+`)`)
		args = append(args, tag)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	// Count query.
	var total int
	countSQL := `SELECT COUNT(*) FROM "Problem" p WHERE ` + where
	if err := h.pool.QueryRow(r.Context(), countSQL, args...).Scan(&total); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	// Main query — fetch problems ordered by "order" asc.
	listArgs := append(args, limit, offset)
	listSQL := `
		SELECT p.id, p.title, p.slug, p.difficulty,
		       (SELECT COUNT(*) FROM "Submission" s WHERE s."problemId" = p.id) AS submission_count
		FROM "Problem" p
		WHERE ` + where + `
		ORDER BY p."order" ASC
		LIMIT $` + strconv.Itoa(argIdx) + ` OFFSET $` + strconv.Itoa(argIdx+1)

	pgRows, err := h.pool.Query(r.Context(), listSQL, listArgs...)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}
	defer pgRows.Close()

	problems := make([]problemListItem, 0, limit)
	for pgRows.Next() {
		var p problemListItem
		if err := pgRows.Scan(&p.ID, &p.Title, &p.Slug, &p.Difficulty, &p.SubmissionCount); err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
		p.Tags = []tagRow{}
		problems = append(problems, p)
	}
	if err := pgRows.Err(); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	// Fetch tags for the returned problem IDs in one query.
	if len(problems) > 0 {
		ids := make([]string, len(problems))
		for i, p := range problems {
			ids[i] = p.ID
		}
		tagRows, err := h.pool.Query(r.Context(),
			`SELECT pt."problemId", t.id, t.name, t.slug
			 FROM "ProblemTag" pt
			 JOIN "Tag" t ON t.id = pt."tagId"
			 WHERE pt."problemId" = ANY($1)`,
			ids,
		)
		if err == nil {
			defer tagRows.Close()
			tagMap := make(map[string][]tagRow)
			for tagRows.Next() {
				var pid string
				var tr tagRow
				if err := tagRows.Scan(&pid, &tr.ID, &tr.Name, &tr.Slug); err == nil {
					tagMap[pid] = append(tagMap[pid], tr)
				}
			}
			for i := range problems {
				if tags, ok := tagMap[problems[i].ID]; ok {
					problems[i].Tags = tags
				}
			}
		}
	}

	if search != "" {
		w.Header().Set("Cache-Control", "no-store")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"problems": problems,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

// ---- detail -------------------------------------------------------------

type testCaseRow struct {
	ID       string `json:"id"`
	Input    string `json:"input"`
	Expected string `json:"expected"`
	Order    int    `json:"order"`
}

// GET /v1/problems/:slug — full problem detail with public test cases.
func (h *Handler) detail(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "slug required"})
		return
	}

	var p struct {
		ID          string  `json:"id"`
		Title       string  `json:"title"`
		Slug        string  `json:"slug"`
		Description string  `json:"description"`
		Difficulty  string  `json:"difficulty"`
		Constraints *string `json:"constraints,omitempty"`
		Hints       *string `json:"hints,omitempty"`
		Editorial   *string `json:"editorial,omitempty"`
		StarterCode *string `json:"starterCode,omitempty"`
		Tags        []tagRow     `json:"tags"`
		TestCases   []testCaseRow `json:"testCases"`
	}

	err := h.pool.QueryRow(r.Context(),
		`SELECT id, title, slug, description, difficulty, constraints, hints, editorial, "starterCode"
		 FROM "Problem" WHERE slug = $1`,
		slug,
	).Scan(&p.ID, &p.Title, &p.Slug, &p.Description, &p.Difficulty,
		&p.Constraints, &p.Hints, &p.Editorial, &p.StarterCode)
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			httpx.JSON(w, http.StatusNotFound, map[string]string{"error": "Problem not found"})
			return
		}
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	// Tags
	p.Tags = []tagRow{}
	tagPgRows, err := h.pool.Query(r.Context(),
		`SELECT t.id, t.name, t.slug
		 FROM "ProblemTag" pt JOIN "Tag" t ON t.id = pt."tagId"
		 WHERE pt."problemId" = $1`,
		p.ID,
	)
	if err == nil {
		defer tagPgRows.Close()
		for tagPgRows.Next() {
			var tr tagRow
			if err := tagPgRows.Scan(&tr.ID, &tr.Name, &tr.Slug); err == nil {
				p.Tags = append(p.Tags, tr)
			}
		}
	}

	// Public test cases only.
	p.TestCases = []testCaseRow{}
	tcRows, err := h.pool.Query(r.Context(),
		`SELECT id, input, expected, "order"
		 FROM "TestCase"
		 WHERE "problemId" = $1 AND "isHidden" = false
		 ORDER BY "order" ASC`,
		p.ID,
	)
	if err == nil {
		defer tcRows.Close()
		for tcRows.Next() {
			var tc testCaseRow
			if err := tcRows.Scan(&tc.ID, &tc.Input, &tc.Expected, &tc.Order); err == nil {
				p.TestCases = append(p.TestCases, tc)
			}
		}
	}

	w.Header().Set("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
	httpx.JSON(w, http.StatusOK, map[string]any{"problem": p})
}

// ---- trending -----------------------------------------------------------

type trendingItem struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	Slug            string  `json:"slug"`
	Difficulty      string  `json:"difficulty"`
	AcceptanceRate  float64 `json:"acceptanceRate"`
	RecentAccepted  int     `json:"recentAccepted"`
}

// GET /v1/problems/trending — top problems by recent acceptance (last 7 days).
func (h *Handler) trending(w http.ResponseWriter, r *http.Request) {
	limit := clamp(parseIntOr(r.URL.Query().Get("limit"), 10), 1, 50)

	pgRows, err := h.pool.Query(r.Context(),
		`SELECT p.id, p.title, p.slug, p.difficulty,
		        COUNT(*) FILTER (WHERE s.status = 'accepted') AS recent_accepted,
		        COUNT(*) AS recent_total
		 FROM "Problem" p
		 JOIN "Submission" s ON s."problemId" = p.id
		 WHERE s."createdAt" >= NOW() - INTERVAL '7 days'
		 GROUP BY p.id, p.title, p.slug, p.difficulty
		 HAVING COUNT(*) > 0
		 ORDER BY recent_accepted DESC, recent_total DESC
		 LIMIT $1`,
		limit,
	)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}
	defer pgRows.Close()

	items := make([]trendingItem, 0, limit)
	for pgRows.Next() {
		var item trendingItem
		var recentTotal int
		if err := pgRows.Scan(&item.ID, &item.Title, &item.Slug, &item.Difficulty,
			&item.RecentAccepted, &recentTotal); err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
		if recentTotal > 0 {
			item.AcceptanceRate = float64(item.RecentAccepted) / float64(recentTotal)
		}
		items = append(items, item)
	}
	if err := pgRows.Err(); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
	httpx.JSON(w, http.StatusOK, map[string]any{"problems": items})
}

// ---- random -------------------------------------------------------------

// GET /v1/problems/random — one random problem, optionally filtered by difficulty.
func (h *Handler) random(w http.ResponseWriter, r *http.Request) {
	difficulty := r.URL.Query().Get("difficulty")

	var id, title, slug, diff string
	var err error
	if difficulty != "" {
		err = h.pool.QueryRow(r.Context(),
			`SELECT id, title, slug, difficulty FROM "Problem"
			 WHERE difficulty = $1
			 ORDER BY RANDOM() LIMIT 1`,
			difficulty,
		).Scan(&id, &title, &slug, &diff)
	} else {
		err = h.pool.QueryRow(r.Context(),
			`SELECT id, title, slug, difficulty FROM "Problem"
			 ORDER BY RANDOM() LIMIT 1`,
		).Scan(&id, &title, &slug, &diff)
	}
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			httpx.JSON(w, http.StatusNotFound, map[string]string{"error": "No problems found"})
			return
		}
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"problem": map[string]string{
			"id":         id,
			"title":      title,
			"slug":       slug,
			"difficulty": diff,
		},
	})
}

// ---- leaderboard --------------------------------------------------------

type leaderboardEntry struct {
	Rank   int    `json:"rank"`
	UserID string `json:"userId"`
	Username string `json:"username"`
	Avatar  *string `json:"avatar,omitempty"`
	Solved  int    `json:"solved"`
}

// GET /v1/leaderboard/top — top 10 users by distinct accepted problems.
func (h *Handler) leaderboardTop(w http.ResponseWriter, r *http.Request) {
	limit := clamp(parseIntOr(r.URL.Query().Get("limit"), 10), 1, 50)

	pgRows, err := h.pool.Query(r.Context(),
		`SELECT u.id, u.username, u.avatar,
		        COUNT(DISTINCT s."problemId") AS solved
		 FROM "Submission" s
		 JOIN "User" u ON u.id = s."userId"
		 WHERE s.status = 'accepted'
		 GROUP BY u.id, u.username, u.avatar
		 ORDER BY solved DESC
		 LIMIT $1`,
		limit,
	)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}
	defer pgRows.Close()

	entries := make([]leaderboardEntry, 0, limit)
	rank := 1
	for pgRows.Next() {
		var e leaderboardEntry
		if err := pgRows.Scan(&e.UserID, &e.Username, &e.Avatar, &e.Solved); err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
		e.Rank = rank
		rank++
		entries = append(entries, e)
	}
	if err := pgRows.Err(); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
	httpx.JSON(w, http.StatusOK, map[string]any{"leaderboard": entries})
}

// ---- stats --------------------------------------------------------------

// GET /v1/stats — aggregate counts for the platform.
func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	var problemCount, contestCount, userCount, acceptedCount int

	if err := h.pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM "Problem"`).Scan(&problemCount); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}
	if err := h.pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM "Contest"`).Scan(&contestCount); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}
	if err := h.pool.QueryRow(r.Context(), `SELECT COUNT(*) FROM "User"`).Scan(&userCount); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}
	if err := h.pool.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM "Submission" WHERE status = 'accepted'`).Scan(&acceptedCount); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
	httpx.JSON(w, http.StatusOK, map[string]any{
		"problems":  problemCount,
		"contests":  contestCount,
		"users":     userCount,
		"accepted":  acceptedCount,
	})
}

// ---- search (full-text) -------------------------------------------------

type searchItem struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Slug       string  `json:"slug"`
	Difficulty string  `json:"difficulty"`
	Rank       float64 `json:"rank"`
}

// GET /v1/problems/search?q=... — Postgres full-text search ranked by ts_rank.
// Backed by the GIN index on to_tsvector('english', title || ' ' || description).
func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "q required"})
		return
	}
	limit := clamp(parseIntOr(r.URL.Query().Get("limit"), 10), 1, 50)
	// Offset accepts 0 (the default) so we parse it directly instead of
	// going through parseIntOr (which rejects 0 as "missing").
	offset := 0
	if v, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && v >= 0 {
		offset = clamp(v, 0, 10000)
	}

	const sql = `
		SELECT id, title, slug, difficulty,
		       ts_rank(
		         to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')),
		         plainto_tsquery('english', $1)
		       ) AS rank
		FROM "Problem"
		WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
		      @@ plainto_tsquery('english', $1)
		ORDER BY rank DESC, "order" ASC
		LIMIT $2 OFFSET $3`

	rows, err := h.pool.Query(r.Context(), sql, q, limit, offset)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}
	defer rows.Close()

	items := make([]searchItem, 0, limit)
	for rows.Next() {
		var it searchItem
		if err := rows.Scan(&it.ID, &it.Title, &it.Slug, &it.Difficulty, &it.Rank); err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
	httpx.JSON(w, http.StatusOK, map[string]any{
		"problems": items,
		"q":        q,
		"limit":    limit,
		"offset":   offset,
	})
}

// ---- similar (by tag overlap) -------------------------------------------

type similarItem struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	Slug            string `json:"slug"`
	Difficulty      string `json:"difficulty"`
	OverlapCount    int    `json:"overlapCount"`
	SubmissionCount int    `json:"submissionCount"`
}

// GET /v1/problems/{slug}/similar — top 5 related problems ranked by
// shared-tag count then by submission volume (a stand-in for `_count.submissions`
// from the Prisma client). Empty slice if the source problem has no tags.
func (h *Handler) similar(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		httpx.JSON(w, http.StatusBadRequest, map[string]string{"error": "slug required"})
		return
	}

	const sql = `
		WITH src AS (
		  SELECT id FROM "Problem" WHERE slug = $1
		),
		src_tags AS (
		  SELECT pt."tagId" FROM "ProblemTag" pt
		  JOIN src ON src.id = pt."problemId"
		)
		SELECT p.id, p.title, p.slug, p.difficulty,
		       COUNT(pt."tagId")::int AS overlap_count,
		       (SELECT COUNT(*) FROM "Submission" s WHERE s."problemId" = p.id)::int AS submission_count
		FROM "Problem" p
		JOIN "ProblemTag" pt ON pt."problemId" = p.id
		WHERE pt."tagId" IN (SELECT "tagId" FROM src_tags)
		  AND p.id <> (SELECT id FROM src)
		GROUP BY p.id, p.title, p.slug, p.difficulty
		ORDER BY overlap_count DESC, submission_count DESC, p."order" ASC
		LIMIT 5`

	rows, err := h.pool.Query(r.Context(), sql, slug)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}
	defer rows.Close()

	items := make([]similarItem, 0, 5)
	for rows.Next() {
		var it similarItem
		if err := rows.Scan(&it.ID, &it.Title, &it.Slug, &it.Difficulty, &it.OverlapCount, &it.SubmissionCount); err != nil {
			httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
			return
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
	httpx.JSON(w, http.StatusOK, map[string]any{
		"slug":     slug,
		"problems": items,
	})
}

// ---- helpers ------------------------------------------------------------

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
