# leetrank-api

Read-only HTTP API for LeetRank. Standalone Hono service that owns the ported public endpoints — Phase 2 of [ADR 0011](../../docs/adr/0011-split-backend-frontend.md).

## Purpose and responsibilities

`apps/api` is the canonical read surface for the platform. It does **not** own auth issuance, code submission, or any write path that mutates user state — those live in `services/auth-go` and `services/submissions-go` respectively.

| Responsibility                                 | Owned here?                            |
| ---------------------------------------------- | -------------------------------------- |
| Catalogue reads (problems, tags, contests)     | Yes                                    |
| Aggregate stats (`/stats`)                     | Yes                                    |
| Top-N leaderboard (`/leaderboard/top`)         | Yes                                    |
| Liveness / readiness / metrics                 | Yes                                    |
| Authentication (login, register, JWT issuance) | No → `services/auth-go`                |
| Submission creation, judge dispatch            | No → `services/submissions-go`         |
| Admin mutations                                | No → still in `apps/web` until Phase 3 |

## Status

**Phase 2 — active.** All 17 routes below are live and covered by 46 Vitest tests.

## Endpoints

| Method | Path                 | Description                                                |
| ------ | -------------------- | ---------------------------------------------------------- |
| GET    | `/`                  | Service info (name, version)                               |
| GET    | `/healthz`           | Liveness — always 200 while process is up                  |
| GET    | `/health`            | Alias for `/readyz`                                        |
| GET    | `/readyz`            | Readiness — probes Postgres                                |
| GET    | `/metrics`           | Prometheus text exposition                                 |
| GET    | `/stats`             | Platform-wide counts (problems, contests, users, accepted) |
| GET    | `/leaderboard/top`   | Top-N leaderboard entries                                  |
| GET    | `/tags`              | All tags                                                   |
| GET    | `/tags/:slug`        | Tag detail + paginated problem list                        |
| GET    | `/contests`          | All contests (with entry/problem counts)                   |
| GET    | `/contests/active`   | Active contests only                                       |
| GET    | `/contests/upcoming` | Upcoming contests only                                     |
| GET    | `/contests/:slug`    | Contest detail + problem list                              |
| GET    | `/problems`          | Paginated problem list (filter by difficulty, tag, search) |
| GET    | `/problems/trending` | Top trending problems by recent accepted count             |
| GET    | `/problems/random`   | One random problem summary                                 |
| GET    | `/problems/:slug`    | Full problem detail + test cases                           |

Full machine-readable contract: [`apps/api/openapi.yaml`](./openapi.yaml).

## Environment variables

| Variable               | Required        | Default       | Description                                                                            |
| ---------------------- | --------------- | ------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | yes             | —             | PostgreSQL connection URL                                                              |
| `JWT_SECRET`           | production only | dev fallback  | HS256 signing secret (16+ chars). Process exits at startup if missing in `production`. |
| `API_PORT`             | no              | `4000`        | HTTP listen port                                                                       |
| `CORS_ALLOWED_ORIGINS` | no              | `""`          | Comma-separated allowed origins. Empty in production rejects cross-origin requests.    |
| `NODE_ENV`             | no              | `development` | `development` / `production` / `test`                                                  |
| `LOG_LEVEL`            | no              | `info`        | Logger threshold (`debug` / `info` / `warn` / `error`)                                 |

`JWT_SECRET` is validated by `src/env.ts` at startup. The dev fallback is deterministic and insecure; never deploy it.

## Local dev

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cd apps/api && pnpm dev
# Listening on http://localhost:4000
```

Smoke-test:

```bash
curl -s http://localhost:4000/healthz
curl -s http://localhost:4000/stats | jq
curl -s "http://localhost:4000/problems?limit=5" | jq
```

Run tests:

```bash
pnpm --filter apps/api test
```

## Production runbook

### Image build

```bash
docker build -t nguyenson1710/leetrank-api:latest \
             -t nguyenson1710/leetrank-api:$(git rev-parse --short HEAD) \
             -f apps/api/Dockerfile .
docker push nguyenson1710/leetrank-api:latest
docker push nguyenson1710/leetrank-api:$(git rev-parse --short HEAD)
```

CI does this automatically on every push to `main`.

### Deploy directly

```bash
docker run -d --name leetrank-api \
  -e DATABASE_URL=postgresql://USER:PASS@HOST:5432/leetrank \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e NODE_ENV=production \
  -e CORS_ALLOWED_ORIGINS=https://leetrank.example.com \
  -p 4000:4000 \
  --restart unless-stopped \
  nguyenson1710/leetrank-api:latest
```

### Scale-out

The service is stateless. Scale by adding replicas behind any L7 load balancer; Caddy in this repo handles fan-out by name resolution.

### Health probes

| Endpoint       | Purpose                            | Typical use                                |
| -------------- | ---------------------------------- | ------------------------------------------ |
| `GET /healthz` | Liveness — returns 200 immediately | k8s `livenessProbe`, compose `healthcheck` |
| `GET /readyz`  | Readiness — pings Postgres         | k8s `readinessProbe`, gateway warm-check   |
| `GET /metrics` | Prometheus text format             | Prometheus scrape target                   |

Compose healthcheck is `wget --spider http://localhost:4000/healthz` (5 s interval, 30 s start period).

## On-call playbook

### `503 Service Unavailable` from `/readyz`

`/readyz` issues `SELECT 1` against Postgres. A 503 means Postgres is unreachable from this container.

1. Check container logs: `docker compose logs api | tail -200`. Look for `db: connect failed`.
2. Confirm the `postgres` container is healthy: `docker compose ps postgres`.
3. From inside the api container, `nc -zv postgres 5432`.
4. If postgres is healthy and reachable, look at `pg_stat_activity` for connection saturation. The default pool cap is 10; bump `DATABASE_URL` `connection_limit=...` if sustained.

### High latency on `/leaderboard/top`

The endpoint hits Postgres directly today. If P95 climbs past 500 ms:

1. Open `/metrics`; check `http_request_duration_seconds_bucket` for the route.
2. `EXPLAIN ANALYZE` the underlying query.
3. The Phase 4 fix is the Redis sorted set in [ADR 0022](../../docs/adr/0022-leaderboard-caching-strategy.md) — coordinate with the on-call before flipping it on.

### `JWT_SECRET must be set` at boot

Container exits at startup with this message in `production`. Set the env var via your secrets store; never bake it into the image or commit `.env`. See [ADR 0025](../../docs/adr/0025-secret-management.md).

### Logs

| Source                | Where                                            |
| --------------------- | ------------------------------------------------ |
| Application JSON logs | stdout — collected by docker logging driver      |
| Caddy access logs     | the Caddy container, `/var/log/caddy/access.log` |
| Prometheus metrics    | scraped at `/metrics`                            |

Filter by request id: every log line includes `request_id` set by the Hono request-id middleware.

## Architecture

This service sits behind Caddy at `/api/v1/*` and is consumed by `apps/web` over the internal docker network. JWT verification (when added in Phase 3.1.5) uses `@leetrank/auth-verify`. The wire format is defined in `@leetrank/api-contracts`.

See also: [ADR 0011](../../docs/adr/0011-split-backend-frontend.md), [ADR 0013](../../docs/adr/0013-service-to-service-auth.md), [ADR 0024](../../docs/adr/0024-observability-stack.md).
