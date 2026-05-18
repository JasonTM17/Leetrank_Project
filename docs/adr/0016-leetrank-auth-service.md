# ADR 0016 — LeetRank Auth Service (Phase 3.1)

**Status:** Accepted  
**Date:** 2026-05-18  
**Deciders:** JasonTM17  
**Supersedes:** —  
**Related:** ADR-0013 (service-to-service auth), Plan 04 G3.1

---

## Context

Auth logic currently lives inside `apps/web` as Next.js API routes (`/api/auth/*`). This creates two problems:

1. **Blast radius** — a bug in the auth flow can take down the entire web app.
2. **Scale coupling** — auth and UI scale together even though their load profiles differ (auth is bursty at login time; UI is steady).

Plan 04 Goal 3.1 calls for extracting auth into a dedicated service. Rather than doing a big-bang cutover, we scaffold the service first so the infrastructure is wired and tested before any real auth logic moves.

## Decision

Stand up `apps/auth` as a new service with the same shape as `apps/api`:

- Hono HTTP server, port 4001
- Same env validation, logger, middleware stack (request-context, timeout, CORS, body-limit)
- `/healthz` liveness, `/readyz` readiness, `/metrics` Prometheus
- `/jwks` and `/.well-known/jwks.json` — JWKS endpoint (empty key set in v0.1)
- `/login` GET + POST — returns `501 Not Implemented` with a structured error body

Caddy routes `/api/v1/auth/*` to `auth:4001` **above** the existing `/api/v1/*` block so auth paths are matched first. The frontend receives a 501 rather than a 404 or connection refused, making the migration state visible without breaking anything.

## What is in v0.1 (Phase 3.1 scaffold)

| Component | State |
|-----------|-------|
| Service skeleton | Done — same shape as apps/api |
| Docker image | Done — multi-stage, port 4001, healthcheck on /healthz |
| Compose wiring | Done — `auth` service block, depends on postgres |
| Caddy routing | Done — `/api/v1/auth/*` → `auth:4001` |
| Prometheus scrape | Done — `job_name: auth` |
| CI typecheck + build | Done — mirrors `api` job |
| Docker Hub publish | Done — `jasontm17/leetrank-auth` in matrix |
| JWKS endpoint | Scaffold — returns `{ keys: [] }` |
| Login endpoint | Stub — returns 501 |

## What comes next

**Phase 3.1.1** — Generate Ed25519 keypair, store private key as secret, populate JWKS with the public key. Other services (`apps/api`, `apps/web`) can then verify JWTs by fetching `/jwks`.

**Phase 3.1.5** — Port the actual login/logout/refresh handlers from `apps/web/src/app/api/auth/*` into `apps/auth/src/routes/`. Update the frontend to call `/api/v1/auth/login` instead of `/api/auth/login`. Remove the Next.js auth routes.

## Consequences

- **Positive:** Infrastructure is wired and tested before any real auth logic moves. Cutover becomes a mechanical swap.
- **Positive:** Blast radius is reduced — a crash in the auth service does not take down the web app.
- **Positive:** Auth can be scaled independently.
- **Negative:** One more service to operate. Acceptable given the existing multi-service stack.
- **Negative:** Until Phase 3.1.5, login is broken for users hitting `/api/v1/auth/*` directly. Mitigated by the 501 response (not a silent failure) and the fact that the frontend still calls the Next.js routes during the transition.
