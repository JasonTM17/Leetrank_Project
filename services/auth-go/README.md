# leetrank-auth-go

Production Go rewrite of `apps/auth`. Same wire surface, different runtime — chi + pgx v5 + go-jose + slog. Lives next to `apps/auth` during the cutover documented in [ADR 0017](../../docs/adr/0017-auth-go-rewrite.md).

## Purpose and responsibilities

| Responsibility | Owned here? |
|----------------|-------------|
| Account creation (`POST /v1/auth/register`) | Yes |
| Login + cookie issuance (`POST /v1/auth/login`) | Yes |
| Session inspection (`GET /v1/auth/me`) | Yes |
| Logout (`POST /v1/auth/logout`) | Yes |
| Password change (`POST /v1/auth/change-password`) | Yes |
| JWKS publication (`/jwks`, `/.well-known/jwks.json`) | Yes |
| Submission writes, judge dispatch | No → `services/submissions-go` |

## Status

**Phase 3.1.5 — active.** All real handlers ship: bcrypt cost 12 hashes, HS256-signed JWTs, dummy-hash timing-attack mitigation, sliding-window rate limiter (5 attempts / 15 min, per-IP and per-account).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/healthz` | — | Liveness — 200 while process is up |
| GET | `/readyz` | — | Readiness — Postgres ping |
| GET | `/metrics` | — | Prometheus text exposition |
| GET | `/jwks` | — | JWKS (HS256 today, Ed25519 in 3.1.5+) |
| GET | `/.well-known/jwks.json` | — | JWKS alias |
| POST | `/v1/auth/register` | — | Create account |
| POST | `/v1/auth/login` | — | Issue session cookie |
| POST | `/v1/auth/logout` | — | Clear session cookie |
| GET | `/v1/auth/me` | cookie | Current session profile |
| POST | `/v1/auth/change-password` | cookie | Update password |
| GET | `/v1/auth/sessions` | — | 501 — session model not yet in schema |

Full machine-readable contract: [`services/auth-go/openapi.yaml`](./openapi.yaml).

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | PostgreSQL connection URL |
| `JWT_SECRET` | yes | — | HS256 signing secret, 16+ chars |
| `AUTH_PORT` | no | `4011` | HTTP listen port |
| `CORS_ALLOWED_ORIGINS` | no | `""` | Comma-separated allowed origins |
| `LOG_LEVEL` | no | `info` | slog level |

Validated by `internal/config/config.go` at boot. Missing required values exit non-zero with a structured error log.

## Local dev

```bash
# Native (Go 1.22+):
cd services/auth-go
DATABASE_URL="postgresql://leetrank:leetrank-dev@localhost:5432/leetrank" \
JWT_SECRET="dev-only-secret-32-characters-long" \
go run ./cmd/server
# Listening on http://localhost:4011

# Or via compose (recommended):
docker compose up auth-go
```

Smoke-test the real handlers:

```bash
# Register a user.
curl -s -X POST http://localhost:4011/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.test","username":"abtest","password":"Sup3rSecret!"}'

# Login (cookie jar captures the session).
curl -s -X POST http://localhost:4011/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.test","password":"Sup3rSecret!"}' \
  -c /tmp/leetrank.cookies

# Inspect session.
curl -s -b /tmp/leetrank.cookies http://localhost:4011/v1/auth/me
```

## Production runbook

### Image build

```bash
docker build -t nguyenson1710/leetrank-auth-go:latest \
             -t nguyenson1710/leetrank-auth-go:$(git rev-parse --short HEAD) \
             -f services/auth-go/Dockerfile services/auth-go
docker push nguyenson1710/leetrank-auth-go:latest
docker push nguyenson1710/leetrank-auth-go:$(git rev-parse --short HEAD)
```

CI handles this on every push to `main`. The runtime stage is distroless (`gcr.io/distroless/static`), ~15 MB total — see [ADR 0017](../../docs/adr/0017-auth-go-rewrite.md).

### Healthcheck

Distroless has no `wget`. The compose `healthcheck` invokes the in-image binary with `-healthcheck`, which probes `/healthz` over loopback and exits 0/1.

### Scale-out

Stateless. The rate limiter is in-process — for multi-replica deployments, replace it with the Redis-backed limiter described in [ADR 0007](../../docs/adr/0007-redis-for-cache-and-queue.md). Tracked under Phase 4.

### Cutover from `apps/auth`

Same sequence as the TS service: 1% canary → 7-day burn-in → ramp 10/50/100. Caddy splits via `reverse_proxy auth-go:4011 auth:4001 { lb_policy ... }`.

## On-call playbook

### `429 Too Many Requests` from `/login`

Expected when an attacker hammers the endpoint. The sliding-window limiter caps 5 attempts per 15 minutes per IP **and** per account. The `Retry-After` header gives seconds remaining.

If a legitimate user is locked out:

1. Confirm IP / account from access logs.
2. Restart the container to clear in-process state — single-replica only. Multi-replica needs the Redis limiter.

### `500` on register/login

Most often a Postgres connectivity issue:

1. `docker compose logs auth-go | tail -200` — look for `pgx: failed to connect`.
2. From inside the container, `nc -zv postgres 5432`.
3. Check `pg_stat_activity` for connection saturation; bump `pool_max_conns` in the DB URL if needed.

If Postgres is healthy, look for `bcrypt: hashedPassword is not the hash of the given password` — those are user-driven and not an outage.

### JWT signature failures downstream

If `apps/api` or `apps/web` reject session cookies issued here:

1. Confirm both sides see the same `JWT_SECRET` (check via the secrets store — never echo the value into logs or tickets).
2. Confirm clock skew between containers is < 30 s — JWT `exp` and `iat` use UTC.
3. Run `curl http://auth-go:4011/jwks` and confirm at least one key is published.

### Logs

| Source | Where |
|--------|-------|
| slog JSON logs | stdout — `docker compose logs auth-go` |
| Prometheus metrics | scraped at `/metrics` |
| Postgres slow queries | `pg_stat_statements` |

Every log line carries `request_id` (set by `internal/http/middleware.go`).

## Architecture

chi router with the standard middleware chain (request id → access log → recover → 15 s timeout → metrics). pgx v5 connection pool, no ORM. JWTs signed HS256 via `go-jose/v4` today; Ed25519 via `internal/jwks` lands in Phase 3.1.5+. Distroless static runtime, non-root, no shell.

See also: [ADR 0011](../../docs/adr/0011-split-backend-frontend.md), [ADR 0013](../../docs/adr/0013-service-to-service-auth.md), [ADR 0017](../../docs/adr/0017-auth-go-rewrite.md), [ADR 0018](../../docs/adr/0018-go-services-buildout.md).
