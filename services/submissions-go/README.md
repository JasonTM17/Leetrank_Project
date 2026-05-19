# leetrank-submissions-go

Go rewrite of the submissions read/write API. Runs on port **4012**.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/healthz` | — | Liveness probe |
| GET | `/readyz` | — | Readiness probe (DB ping) |
| GET | `/metrics` | — | Prometheus metrics |
| GET | `/v1/submissions` | X-User-ID header | List user's submissions (paginated) |
| POST | `/v1/submissions` | X-User-ID header | Create submission (501 stub — Phase 3.2) |
| GET | `/v1/submissions/recent` | — | Public recent accepted feed |
| GET | `/v1/submissions/:id` | X-User-ID header | Fetch single submission |
| GET | `/v1/submissions/:id/stream` | X-User-ID header | SSE verdict stream (501 stub — Phase 3.2) |

## Query parameters

`GET /v1/submissions`
- `problemId` — filter by problem
- `page` — default 1
- `limit` — default 20, max 100

`GET /v1/submissions/recent`
- `limit` — default 20, max 50

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | Postgres connection string |
| `SUBMISSIONS_PORT` | no | `4012` | Listen port |
| `JWT_SECRET` | no | — | Reserved for Phase 3.2 JWT validation |
| `LOG_LEVEL` | no | `info` | Log level |

## Running locally

```sh
docker compose up submissions-go
```

Or directly (requires Go 1.22+):

```sh
DATABASE_URL="postgresql://leetrank:leetrank-dev@localhost:5432/leetrank" go run ./cmd/server
```
