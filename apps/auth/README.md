# leetrank-auth

TypeScript auth service for LeetRank — owns JWT issuance, JWKS publication, and the login/logout/refresh flows. Runs side-by-side with `services/auth-go` during the Phase 3.1.5 cutover (see [ADR 0017](../../docs/adr/0017-auth-go-rewrite.md)).

## Purpose and responsibilities

| Responsibility | Owned here? |
|----------------|-------------|
| Account creation (`POST /register`) | Yes (501 stub during scaffold) |
| Login + cookie issuance (`POST /login`) | Yes (501 stub during scaffold) |
| Session inspection (`GET /me`) | Yes (501 stub) |
| Logout (`POST /logout`) | Yes |
| Password change (`POST /change-password`) | Yes (501 stub) |
| JWKS publication (`/jwks`, `/.well-known/jwks.json`) | Yes |
| Read-side endpoints (problems, leaderboard) | No → `apps/api` |
| Submission write path | No → `services/submissions-go` |

## Status

**Phase 3.1 scaffold.** The service is wired into the stack and Caddy routes `/api/v1/auth/*` here, but the real handlers live in `services/auth-go` (Phase 3.1.5). Endpoints in this TS service return `501 Not Implemented` until the cutover decision lands.

The JWKS endpoint returns an empty key set until Phase 3.1.1 generates the Ed25519 keypair (see [ADR 0013](../../docs/adr/0013-service-to-service-auth.md)).

## Endpoints

| Method | Path | Status |
|--------|------|--------|
| GET | `/healthz` | Liveness — always 200 |
| GET | `/readyz` | Readiness — Postgres ping |
| GET | `/health` | Alias for `/readyz` |
| GET | `/metrics` | Prometheus text exposition |
| GET | `/jwks` | JWKS (empty until Phase 3.1.1) |
| GET | `/.well-known/jwks.json` | JWKS alias |
| POST | `/v1/auth/login` | 501 until cutover |
| POST | `/v1/auth/register` | 501 until cutover |
| GET | `/v1/auth/me` | 501 until cutover |
| POST | `/v1/auth/logout` | 200 |
| POST | `/v1/auth/change-password` | 501 until cutover |

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | PostgreSQL connection URL |
| `JWT_SECRET` | yes | — | HS256 signing secret (16+ chars) |
| `API_PORT` | no | `4001` | HTTP listen port |
| `CORS_ALLOWED_ORIGINS` | no | `""` | Comma-separated allowed origins |
| `NODE_ENV` | no | `development` | `development` / `production` / `test` |
| `LOG_LEVEL` | no | `info` | Logger threshold |

## Local dev

```bash
pnpm install
cd apps/auth
pnpm dev
# Listening on http://localhost:4001
```

Smoke-test:

```bash
curl -s http://localhost:4001/healthz
curl -s http://localhost:4001/.well-known/jwks.json
```

## Production runbook

```bash
docker build -t nguyenson1710/leetrank-auth:latest -f apps/auth/Dockerfile .
docker run -d --name leetrank-auth \
  -e DATABASE_URL=postgresql://USER:PASS@HOST:5432/leetrank \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e NODE_ENV=production \
  -p 4001:4001 \
  --restart unless-stopped \
  nguyenson1710/leetrank-auth:latest
```

The compose stack already runs both `auth` and `auth-go` containers in parallel. Caddy routes traffic — flip the upstream by editing the `Caddyfile` site block.

### Cutover sequence (Phase 3.1.5)

1. Deploy `auth-go` to staging; run register/login parity checks.
2. Run a 7-day canary in production with Caddy splitting 1% → `auth-go`.
3. If zero P1/P2 incidents, ramp 10 → 50 → 100%. Keep `apps/auth` warm for 30 days.
4. Decommission `apps/auth` once `auth-go` p99 < 200 ms and zero rollbacks across two release cycles.

## On-call playbook

### `501 Not Implemented` on register/login

Expected during the scaffold phase. Frontend should target `services/auth-go` directly via the Caddy route. Confirm with `curl -s http://auth-go:4011/v1/auth/login -X POST` from within the network.

### `JWT_SECRET must be set` at boot

The process exits during env validation. Inject the secret via your secrets store; do **not** commit it. See [ADR 0025](../../docs/adr/0025-secret-management.md).

### Empty JWKS response

Expected until Phase 3.1.1 keypair generation. Service-to-service callers should fall back to HS256 verification with the shared `JWT_SECRET`.

### Logs

| Source | Where |
|--------|-------|
| Application JSON logs | stdout — `docker compose logs auth` |
| Caddy access logs | `/var/log/caddy/access.log` in the Caddy container |
| Prometheus metrics | scraped at `/metrics` |

Filter by `request_id` to correlate a single request across the auth → DB hop.

## Architecture

Sits behind Caddy at `/api/v1/auth/*`. Co-deployed with `services/auth-go` for the cutover window. Long-term, `apps/auth` is decommissioned and `auth-go` becomes the canonical issuer.

See also: [ADR 0016](../../docs/adr/0016-leetrank-auth-service.md), [ADR 0017](../../docs/adr/0017-auth-go-rewrite.md).
