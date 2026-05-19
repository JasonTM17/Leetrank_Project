# leetrank-problems-go

Go rewrite of the problems read API. Runs on port **4013**.

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

## Query parameters

`GET /v1/problems`
- `difficulty` — `easy` / `medium` / `hard`
- `tag` — tag slug
- `search` — title substring (ILIKE)
- `page` — default 1
- `limit` — default 50, max 50

`GET /v1/problems/trending`
- `limit` — default 10, max 50

`GET /v1/problems/random`
- `difficulty` — optional filter

`GET /v1/leaderboard/top`
- `limit` — default 10, max 50

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | Postgres connection string |
| `PROBLEMS_PORT` | no | `4013` | Listen port |
| `LOG_LEVEL` | no | `info` | Log level |

## Running locally

```sh
docker compose up problems-go
```

Or directly (requires Go 1.22+):

```sh
DATABASE_URL="postgresql://leetrank:leetrank-dev@localhost:5432/leetrank" go run ./cmd/server
```
