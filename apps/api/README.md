# leetrank-api

Read-only API service for LeetRank. Standalone Hono HTTP server that owns the ported public endpoints (Phase 2 of [ADR 0011](../../docs/adr/0011-split-backend-frontend.md)).

## Status

**Phase 2 — active.** All 17 routes below are live. Auth-gated write endpoints (submissions, admin) remain in `apps/web` until Phase 3.

## Port

`4000` (default). Override with `API_PORT`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info (name, version) |
| GET | `/healthz` | Liveness — always 200 while process is up |
| GET | `/health` | Alias for `/readyz` |
| GET | `/readyz` | Readiness — probes Postgres |
| GET | `/metrics` | Prometheus text exposition |
| GET | `/stats` | Platform-wide counts (problems, contests, users, accepted) |
| GET | `/leaderboard/top` | Top-N leaderboard entries |
| GET | `/tags` | All tags |
| GET | `/tags/:slug` | Tag detail + paginated problem list |
| GET | `/contests` | All contests (with entry/problem counts) |
| GET | `/contests/active` | Active contests only |
| GET | `/contests/upcoming` | Upcoming contests only |
| GET | `/contests/:slug` | Contest detail + problem list |
| GET | `/problems` | Paginated problem list (filter by difficulty, tag, search) |
| GET | `/problems/trending` | Top trending problems by recent accepted count |
| GET | `/problems/random` | One random problem summary |
| GET | `/problems/:slug` | Full problem detail + test cases |

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection URL |
| `JWT_SECRET` | Production only | dev fallback | HS256 signing secret (16+ chars). Process exits on startup if missing in production. |
| `API_PORT` | No | `4000` | HTTP listen port |
| `CORS_ALLOWED_ORIGINS` | No | `""` | Comma-separated allowed origins. Empty in production rejects all cross-origin requests. |
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |
| `LOG_LEVEL` | No | `info` | Logger threshold (`debug` / `info` / `warn` / `error`) |

`JWT_SECRET` is validated by `src/env.ts` at startup. In development, a deterministic insecure fallback is used when the variable is absent — never deploy that fallback to production.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with `tsx watch` (hot-reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled output (`node dist/server.js`) |
| `npm run typecheck` | Type-check without emitting |
| `npm run test` | Run Vitest test suite |

## Dev quickstart

```bash
# 1. Install workspace dependencies (from repo root)
npm install

# 2. Copy and fill in environment variables
cp .env.example .env

# 3. Start the API service
cd apps/api && npm run dev
# Listening on http://localhost:4000
```

## Docker

Multi-stage build — compile stage on `node:20-alpine`, runtime stage on `node:20-alpine` with a non-root user and a `HEALTHCHECK` against `/healthz`.

```bash
# Build locally
docker build -t leetrank-api ./apps/api

# Run
docker run \
  -e DATABASE_URL=postgresql://user:pass@host:5432/leetrank \
  -e JWT_SECRET=your-secret \
  -p 4000:4000 \
  leetrank-api
```

The published image is `jasontm17/leetrank-api`. CI pushes `latest` and a short-SHA tag on every push to `main`. See [docs/runbooks/docker.md](../../docs/runbooks/docker.md) for compose commands.

## Health endpoints

| Endpoint | Purpose | Typical use |
|----------|---------|-------------|
| `GET /healthz` | Liveness — returns 200 immediately | Kubernetes `livenessProbe` |
| `GET /readyz` | Readiness — probes Postgres | Kubernetes `readinessProbe`, compose `healthcheck` |
| `GET /metrics` | Prometheus text format | Prometheus scrape target |

## Testing

The package ships 46 Vitest tests covering route handlers, schema validation, and middleware.

```bash
# From repo root
npm test --workspace=apps/api

# From the package directory
cd apps/api && npm test
```

## Architecture

This service is the Phase 2 output of [ADR 0011](../../docs/adr/0011-split-backend-frontend.md) (FE/BE split). It sits behind Caddy at `/api/v1/*` and is consumed by `apps/web` over the internal Docker network. JWT verification uses `@leetrank/auth-verify` (HS256 today, JWKS in Phase 3.1). The wire format is defined in `@leetrank/api-contracts`.

See also: [ADR 0013 — service-to-service auth](../../docs/adr/0013-service-to-service-auth.md).

---

**Author:** Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)
