# leetrank-auth-go

Production-grade Go rewrite of `apps/auth`. Same wire surface, different
runtime — chi + pgx + go-jose + slog. Lives next to `apps/auth` during
the cutover documented in `docs/adr/0017-auth-go-rewrite.md`.

## Why Go

The TS `apps/auth` was a scaffold; no business logic existed yet. Re-doing
the foundation in Go now is cheaper than porting after handlers ship. Go
gives us:

- Single static binary, distroless runtime image (~15 MB) vs. node:20 (~150 MB).
- Native goroutine concurrency for login bursts without an event-loop tax.
- `log/slog` JSON handler is in stdlib — no logger dep drift.
- pgx is the fastest mainstream Postgres driver; sub-ms latency for ping.
- crypto/ed25519 is in stdlib — JWKS-ready without a third-party crypto lib.

## Endpoints

| Path | Status | Notes |
|---|---|---|
| `GET  /` | 200 | service banner |
| `GET  /healthz` | 200 always | cheap liveness, no DB |
| `GET  /readyz` | 200 / 503 | pings Postgres with 2s budget |
| `GET  /metrics` | 200 | Prometheus exposition |
| `GET  /jwks` and `GET /.well-known/jwks.json` | 200 | empty until Phase 3.1.5 |
| `POST /v1/auth/register` | 501 | stub |
| `POST /v1/auth/login` | 501 | stub |
| `POST /v1/auth/logout` | 501 | stub |
| `GET  /v1/auth/me` | 501 | stub |
| `POST /v1/auth/change-password` | 501 | stub |
| `GET  /v1/auth/sessions` | 501 | stub |

## Local

```bash
export DATABASE_URL='postgresql://leetrank:leetrank-dev@localhost:15432/leetrank?schema=public'
export JWT_SECRET='dev-secret-32-chars-minimum-aaaa'
export AUTH_PORT=4011
go run ./cmd/server
```

Then probe:

```bash
curl http://localhost:4011/healthz
curl http://localhost:4011/readyz
curl http://localhost:4011/jwks
```

## Docker

The image is built from the repo root context so it can find `prisma/`
(future migrations live there). Build via the root `docker compose`:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml build auth-go
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --no-deps auth-go
curl http://localhost:14011/healthz
```

## Cutover

ADR 0017 lays out the rollout. TL;DR: keep both `apps/auth` (TS, port 4001)
and `services/auth-go` (Go, port 4011) running. Caddy keeps routing
`/api/v1/auth/*` to TS until the Go service has feature parity AND has
been canary'd for 7 days.
