# leetrank-submissions-go

Go rewrite of the submissions read/write API. Runs on port **4012**. Owns user submission listing, retrieval, and (in Phase 3.2) creation + judge dispatch.

## Purpose and responsibilities

| Responsibility | Owned here? |
|----------------|-------------|
| User submission list (`GET /v1/submissions`) | Yes |
| Single submission read (`GET /v1/submissions/:id`) | Yes |
| Public recent feed (`GET /v1/submissions/recent`) | Yes |
| Submission creation + judge dispatch (`POST /v1/submissions`) | Stub — Phase 3.2 |
| SSE verdict stream (`GET /v1/submissions/:id/stream`) | Stub — Phase 3.2 |
| Auth issuance | No → `services/auth-go` |
| Problem catalogue reads | No → `services/problems-go` |

## Status

Read paths are **active** in production. Write paths return `501 Not Implemented` until Phase 3.2 lands the judge dispatcher and verdict streaming.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/healthz` | — | Liveness probe |
| GET | `/readyz` | — | Readiness probe (DB ping) |
| GET | `/metrics` | — | Prometheus metrics |
| GET | `/v1/submissions` | `X-User-ID` header | List user's submissions (paginated) |
| POST | `/v1/submissions` | `X-User-ID` header | Create submission (501 stub — Phase 3.2) |
| GET | `/v1/submissions/recent` | — | Public recent accepted feed |
| GET | `/v1/submissions/:id` | `X-User-ID` header | Fetch single submission |
| GET | `/v1/submissions/:id/stream` | `X-User-ID` header | SSE verdict stream (501 stub) |

### Auth model

Authenticated routes read `X-User-ID` from the request header. The upstream gateway (Caddy) is responsible for validating the session cookie and injecting the header — see [ADR 0013](../../docs/adr/0013-service-to-service-auth.md). A missing header on a protected route returns `401 Unauthorized`.

### Query parameters

`GET /v1/submissions`
- `problemId` — filter by problem
- `page` — default `1`
- `limit` — default `20`, max `100`

`GET /v1/submissions/recent`
- `limit` — default `20`, max `50`

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | Postgres connection string |
| `SUBMISSIONS_PORT` | no | `4012` | Listen port |
| `JWT_SECRET` | no | — | Reserved for Phase 3.2 in-process verification |
| `LOG_LEVEL` | no | `info` | slog level |

## Local dev

```bash
docker compose up submissions-go

# Or natively (Go 1.22+):
DATABASE_URL="postgresql://leetrank:leetrank-dev@localhost:5432/leetrank" \
go run ./cmd/server
```

Smoke-test:

```bash
curl -s http://localhost:4012/healthz

# Public feed (no auth).
curl -s "http://localhost:4012/v1/submissions/recent?limit=5" | jq

# Authenticated list — pretend the gateway already validated.
curl -s -H "X-User-ID: <USER_UUID>" http://localhost:4012/v1/submissions | jq
```

## Test

```bash
go test ./... -v -cover
```

Coverage threshold: **≥ 70%** (standard Go service — see global rule #5).

Tests cover: submission list pagination, single submission retrieval, recent public feed, X-User-ID auth enforcement (401 on missing header), readiness probe, and middleware chain (request-id, recover, timeout, metrics).

## Production runbook

### Image build

```bash
docker build -t nguyenson1710/leetrank-submissions-go:latest \
             -t nguyenson1710/leetrank-submissions-go:$(git rev-parse --short HEAD) \
             -f services/submissions-go/Dockerfile services/submissions-go
docker push nguyenson1710/leetrank-submissions-go:latest
docker push nguyenson1710/leetrank-submissions-go:$(git rev-parse --short HEAD)
```

### Scale-out

Stateless on the read paths. When Phase 3.2 lands:

- Judge dispatch will go through the Redis queue (BLPOP semantics) — multi-replica safe by design.
- SSE streams are sticky per-connection; use a sticky-session LB or a cluster-wide Redis pub/sub fan-out (tracked in [ADR 0007](../../docs/adr/0007-redis-for-cache-and-queue.md)).

## On-call playbook

### `401 Unauthorized` on `/v1/submissions`

The route requires `X-User-ID`. A 401 from a real user means the upstream gateway didn't validate or didn't forward the header.

1. `docker compose logs caddy | grep submissions-go` — confirm Caddy is injecting the header.
2. Confirm the cookie is set on the user's browser (`document.cookie` should show `leetrank_session=...`).
3. If the session cookie is absent, route the user to `auth-go` to re-login.

### `503` from `/readyz`

Postgres ping failed. Same diagnostic flow as `apps/api` and `problems-go` — check container health, network, then `pg_stat_activity`.

### `501 Not Implemented` on `POST /v1/submissions`

Expected until Phase 3.2. The frontend currently routes submission creation through `apps/web` → judge service directly. Confirm the request was misrouted; do not enable the stub in production.

### Logs and metrics

| Source | Where |
|--------|-------|
| slog JSON logs | stdout — `docker compose logs submissions-go` |
| Prometheus metrics | scraped at `/metrics` |
| Postgres slow queries | `pg_stat_statements` |

Every log line carries `request_id`.

## Architecture

chi router, pgx v5, slog, distroless static runtime. Read queries hit Postgres directly; write paths in Phase 3.2 will enqueue a job through Redis to the `judge-service`.

See also: [ADR 0011](../../docs/adr/0011-split-backend-frontend.md), [ADR 0018](../../docs/adr/0018-go-services-buildout.md), [ADR 0007](../../docs/adr/0007-redis-for-cache-and-queue.md), [ADR 0009](../../docs/adr/0009-judge-concurrency-bounds.md).
