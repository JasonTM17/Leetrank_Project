# Auth Service Runbook (`apps/auth`)

Quick reference for operating the LeetRank auth service in production.

---

## What it does

`apps/auth` is a standalone Hono HTTP server (Node.js) on port 4001. It is the future home of all authentication logic: login, logout, token refresh, and JWKS key distribution. As of Phase 3.1 (scaffold), most endpoints return `501 Not Implemented`. The only live endpoint is the JWKS endpoint, which currently returns an empty key set (Phase 3.1.1 not yet complete). Real auth logic migrates from `apps/web` in Phase 3.1.5. See [`docs/adr/0016-leetrank-auth-service.md`](../adr/0016-leetrank-auth-service.md) for the full plan.

> **Note:** Because most endpoints are stubs, the primary operational concern today is keeping the service reachable so that Caddy can proxy `/api/v1/auth/*` without 502 errors, and ensuring the JWKS endpoint responds correctly for future token verification.

---

## Health endpoints

| Endpoint | Purpose | Expected response |
|---|---|---|
| `GET /healthz` | Cheap liveness — no DB call | `200 {"status":"ok"}` |
| `GET /readyz` | Readiness — includes DB probe | `200` if DB reachable; `503` if not |
| `GET /health` | Alias for `/readyz` | Same as above |
| `GET /metrics` | Prometheus metrics | `200` text/plain exposition format |
| `GET /jwks` | JWKS key set | `200 {"keys":[]}` (empty until Phase 3.1.1) |
| `GET /.well-known/jwks.json` | JWKS alias (RFC 7517) | Same as above |

```bash
# Liveness
curl http://localhost:4001/healthz

# Readiness
curl http://localhost:4001/readyz | jq

# JWKS endpoint
curl http://localhost:4001/jwks | jq

# Prometheus metrics
curl http://localhost:4001/metrics | grep leetrank
```

---

## Common alerts

All alert definitions live in [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml).

### `ServiceDown` (severity: critical) — `job=auth`

**Condition:** `up == 0` for `job=auth` for 2 minutes.

**Meaning:** Prometheus cannot scrape `auth:4001`. The container is down or crashed.

**Triage:**

```bash
# 1. Check container state
docker compose ps auth

# 2. Tail recent logs
docker compose logs --tail=100 auth

# 3. Manual liveness check
curl http://localhost:4001/healthz

# 4. Restart if stopped/exited
docker compose up -d auth

# 5. Check for startup crash (env validation failure is common)
docker compose logs auth | grep -i "error\|fatal\|missing\|required"
```

The auth service validates `JWT_SECRET` and `DATABASE_URL` at startup via `env.js`. A missing or malformed env var causes an immediate process exit. Verify `.env` contains both values.

Escalate to Nguyễn Sơn (jasonbmt06@gmail.com) if the service does not recover within 10 minutes.

---

### JWKS endpoint unreachable

This is not a Prometheus alert today but is the most operationally significant failure for the auth service in Phase 3.1.

**Symptoms:** `GET /jwks` returns non-200, or Caddy logs show 502 for `/api/v1/auth/*` paths.

**Triage:**

```bash
# 1. Check JWKS directly
curl -v http://localhost:4001/jwks

# 2. Check Caddy is routing correctly
docker compose logs --tail=50 caddy | grep "auth"

# 3. Verify auth container is up
docker compose ps auth

# 4. Check auth logs for errors
docker compose logs --tail=50 auth
```

---

## Current endpoint status (Phase 3.1)

| Endpoint | Status | Notes |
|---|---|---|
| `GET /healthz` | Live | Liveness probe |
| `GET /readyz` | Live | DB probe |
| `GET /metrics` | Live | Prometheus scrape |
| `GET /jwks` | Live | Returns empty `{"keys":[]}` |
| `GET /.well-known/jwks.json` | Live | Same as `/jwks` |
| `GET /login` | 501 stub | Phase 3.1.5 |
| `POST /login` | 501 stub | Phase 3.1.5 |

---

## Common failure modes

### Env validation failure at startup

Signs: Container exits immediately, logs show `Missing required env var` or similar.

Fix: Ensure `JWT_SECRET` and `DATABASE_URL` are set in `.env`. The service calls `env.js` as its first import and exits if validation fails.

### DB connection refused

Signs: `/readyz` returns 503, logs show Prisma `P1001`.

Fix: See [`postgres.md`](postgres.md). Auth uses the same `DATABASE_URL` as `api` and `app`.

### 502 from Caddy on `/api/v1/auth/*`

Signs: Browser or curl gets 502 for auth paths.

Fix: Auth container is likely down. Run `docker compose up -d auth` and verify with `curl http://localhost:4001/healthz`.

---

## Recent incidents

_No incidents recorded yet. File post-mortems under `docs/post-mortems/YYYY-MM-DD-slug.md`._

---

## Useful commands

```bash
# Stream logs
docker compose logs -f auth

# Last 100 lines
docker compose logs --tail=100 auth

# Liveness probe
curl http://localhost:4001/healthz

# JWKS check
curl http://localhost:4001/jwks | jq

# Prometheus metrics
curl http://localhost:4001/metrics

# Restart
docker compose restart auth

# Rebuild and restart
docker compose build auth && docker compose up -d auth
```

---

## Open gaps (Phase 3.1)

The following are known gaps tracked in the prod-readiness audit:

- **F-081** — Auth service ships 501 stubs; complete Phase 3.1.5 before cutover.
- **F-082** — JWKS is empty; generate Ed25519 keypair and expose real keys (Phase 3.1.1).
- **F-066** — No login rate limit at auth service; add per-IP + per-account lockout.
- **F-067** — Shared `JWT_SECRET` with `apps/web`; migrate to per-service keys in Phase 3.1.1.
- **F-084** — No refresh-token rotation.

---

## See also

- [`docker.md`](docker.md) — general Docker Compose operations
- [`postgres.md`](postgres.md) — database runbook
- [`docs/adr/0016-leetrank-auth-service.md`](../adr/0016-leetrank-auth-service.md) — auth service ADR
- [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml) — alert definitions

---

_Author: Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)_
