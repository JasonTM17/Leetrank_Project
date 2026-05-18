# leetrank-auth

Auth service for LeetRank. Owns JWT issuance, JWKS publication, and the login/logout/refresh flows.

## Status

**Phase 3.1 scaffold** — the service is wired into the stack and Caddy routes `/api/v1/auth/*` here, but all auth endpoints return `501 Not Implemented` until Phase 3.1.5 completes the migration from `apps/web`.

The JWKS endpoint (`GET /jwks` and `GET /.well-known/jwks.json`) returns an empty key set until Phase 3.1.1 generates the Ed25519 keypair.

## Port

`4001` (default). Override with `API_PORT`.

## Endpoints

| Method | Path | Status |
|--------|------|--------|
| GET | `/healthz` | Liveness — always 200 while process is up |
| GET | `/readyz` | Readiness — probes Postgres |
| GET | `/health` | Alias for `/readyz` |
| GET | `/metrics` | Prometheus text exposition |
| GET | `/jwks` | JWKS (empty until Phase 3.1.1) |
| GET | `/.well-known/jwks.json` | JWKS alias |
| GET/POST | `/login` | 501 until Phase 3.1.5 |

## Development

```bash
# From repo root — deps must be installed first
cd apps/auth
npm install
npm run dev
```

## Docker

```bash
docker build -t leetrank-auth .
docker run -e JWT_SECRET=dev -e DATABASE_URL=postgresql://... -p 4001:4001 leetrank-auth
```
