# leetrank-problems-go

Go rewrite of the public problems read API. Runs on port **4013**. Owns `/v1/problems/*`, `/v1/leaderboard/top`, and `/v1/stats` from the platform's read surface.

## Purpose and responsibilities

| Responsibility | Owned here? |
|----------------|-------------|
| Problem catalogue reads (list, detail, trending, random) | Yes |
| Top-N leaderboard | Yes |
| Aggregate stats | Yes |
| Auth issuance | No → `services/auth-go` |
| Submission writes / judge dispatch | No → `services/submissions-go` |
| Mutations (admin) | No |

## Status

**Active.** All 9 routes are live. Read-only — no auth required, no mutations.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/healthz` | — | Liveness probe |
| GET | `/readyz` | — | Readiness probe (DB ping) |
| GET | `/metrics` | — | Prometheus metrics |
| GET | `/v1/problems` | — | Paginated problem list |
| GET | `/v1/problems/trending` | — | Top problems by recent acceptance |
| GET | `/v1/problems/random` | — | One random problem |
| GET | `/v1/problems/:slug` | — | Full problem detail with public test cases |
| GET | `/v1/leaderboard/top` | — | Top users by solved count |
| GET | `/v1/stats` | — | Platform aggregate counts |

### Query parameters

`GET /v1/problems`
- `difficulty` — `easy` / `medium` / `hard`
- `tag` — tag slug
- `search` — title substring (ILIKE)
- `page` — default `1`
- `limit` — default `50`, max `50`

`GET /v1/problems/trending`
- `limit` — default `10`, max `50`

`GET /v1/problems/random`
- `difficulty` — optional filter

`GET /v1/leaderboard/top`
- `limit` — default `10`, max `50`

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | Postgres connection string |
| `PROBLEMS_PORT` | no | `4013` | Listen port |
| `LOG_LEVEL` | no | `info` | slog level |

## Local dev

```bash
# Compose (recommended):
docker compose up problems-go

# Native (Go 1.22+):
DATABASE_URL="postgresql://leetrank:leetrank-dev@localhost:5432/leetrank" \
go run ./cmd/server
# Listening on http://localhost:4013
```

Smoke-test:

```bash
curl -s http://localhost:4013/healthz
curl -s "http://localhost:4013/v1/problems?limit=3" | jq
curl -s "http://localhost:4013/v1/problems/trending?limit=5" | jq
curl -s "http://localhost:4013/v1/leaderboard/top?limit=10" | jq
```

## Test

```bash
go test ./... -v -cover
```

Coverage threshold: **≥ 70%** (standard Go service — see global rule #5).

Tests cover: problem list pagination and filtering, trending/random endpoints, leaderboard top-N query, stats aggregation, readiness probe (DB ping), and middleware chain (request-id, recover, timeout, metrics).

## Production runbook

### Image build

```bash
docker build -t nguyenson1710/leetrank-problems-go:latest \
             -t nguyenson1710/leetrank-problems-go:$(git rev-parse --short HEAD) \
             -f services/problems-go/Dockerfile services/problems-go
docker push nguyenson1710/leetrank-problems-go:latest
docker push nguyenson1710/leetrank-problems-go:$(git rev-parse --short HEAD)
```

### Scale-out

Stateless. The `/v1/problems` and `/v1/leaderboard/top` queries are the hot paths — confirm Postgres has indexes on `Problem.difficulty`, `Problem.slug`, and the `User.solvedCount` surrogate before scaling beyond two replicas.

The leaderboard endpoint is a candidate for the Redis sorted-set layer in [ADR 0022](../../docs/adr/0022-leaderboard-caching-strategy.md).

## On-call playbook

### `503 Service Unavailable` from `/readyz`

The probe issues a Postgres ping. A 503 means the connection pool is exhausted or the DB is unreachable.

1. `docker compose logs problems-go | tail -200` — look for `pgx: timeout`.
2. Check `pg_stat_activity` for stuck queries; long-running `LIKE '%…%'` from the `search` parameter is the most common offender.
3. Bump `pool_max_conns` via the URL query parameter if traffic justifies it.

### Slow `/v1/problems?search=...` queries

`search` does `ILIKE '%term%'`. Postgres can't use a B-tree index for unanchored substrings.

1. Confirm whether traffic is dominated by `search`. If yes, push toward an FTS column (`tsvector`) — tracked under Phase 4.
2. As a stop-gap, lower the per-IP rate limit on the gateway.

### Logs and metrics

| Source | Where |
|--------|-------|
| slog JSON logs | stdout — `docker compose logs problems-go` |
| Prometheus metrics | scraped at `/metrics` |
| Postgres query stats | `pg_stat_statements` in the `postgres` container |

Per-request `request_id` is on every log line.

## Architecture

chi router with the standard middleware chain (request id, access log, recover, 15 s timeout, metrics). pgx v5 connection pool, no ORM. Distroless static runtime.

See also: [ADR 0011](../../docs/adr/0011-split-backend-frontend.md), [ADR 0018](../../docs/adr/0018-go-services-buildout.md), [ADR 0022](../../docs/adr/0022-leaderboard-caching-strategy.md).
