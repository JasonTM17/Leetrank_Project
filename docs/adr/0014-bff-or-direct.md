# 14. Fate of apps/api after Phase 4

Date: 2026-05-18

## Status

Proposed. Decision required before Phase 4 (drop /api/\* from apps/web)
in the microservices migration plan.

## Context

`apps/api` started as the destination for read-only public routes
extracted from the Next.js monolith. By the end of Phase 3.x it will
have been disassembled into purpose-built services:
`leetrank-auth`, `leetrank-problems`, `leetrank-contests`,
`leetrank-submissions`, `leetrank-discussions`, `leetrank-leaderboard`.

What happens to `apps/api` then? Three options:

1. **Retire it.** Delete the directory. Browsers and SSR call the
   per-domain services directly via Caddy.
2. **Repurpose as a thin BFF.** Aggregator that fans out to the per-
   domain services and returns a single response shape per page. Useful
   for SSR: one network hop instead of three.
3. **Keep it as a proxy/edge cache layer.** Same role as Caddy but
   with logic — short-TTL caching, request-shape normalisation, etc.

## Decision

**Retire `apps/api` at Phase 4. Browsers and SSR call the per-domain
services directly via Caddy.**

Reasoning:

- Aggregation can be done at Caddy with `handle` blocks for the few
  pages that genuinely need it (homepage hero stats; problem detail
  with comment count). Adding a Node-based BFF for that is overhead.
- SSR inside `apps/web` already runs Server Components — composing
  multiple service calls in parallel is what `Promise.all` is for.
  No service is required to do that for us.
- Edge caching is Caddy's job, or a CDN's. Plan 03 §1 prefers Caddy
  - Compose locally and ALB + CloudFront in prod; neither needs an
    extra service.
- Each new service ships its own routes. Routing them through `api`
  is a hop tax (latency + JSON parse + JSON re-emit) for no gain.

## Consequences

**Positive**

- One fewer service to deploy, scale, and patch.
- One less hop on the SSR critical path.
- `apps/api`'s `Dockerfile`, `package.json`, CI job, and Docker Hub
  image (`leetrank-api`) all retire — image registry stays clean.

**Negative**

- If a future feature needs server-side aggregation we have to add it
  back. The cost of doing so is small (fork from the retired
  `apps/api/` git history; new service name).
- The `WEB_API_PROXY_BASE` env var documented in `apps/api/README.md`
  becomes a deprecated key.

**Neutral**

- The work that landed in `apps/api/` (env validation pattern,
  middleware, /metrics, /health split, structured logger) is reusable
  as the per-service skeleton. Phase 4 cleanup commit moves the
  patterns into `packages/observability` + a `pnpm new-service`
  cookiecutter (Plan 04 §10 self-improvement #8).

## Alternatives considered

- **Keep apps/api as a BFF.** Rejected. Aggregation needs do not
  justify a long-running service. We can revisit if a real need
  appears (mobile app with strict latency budget, for example).
- **Promote apps/api to leetrank-gateway.** Rejected. Caddy already
  is the gateway. A second one in Node would be duplicate work and
  duplicate latency.

## Implementation note

The retirement commit (Phase 4) does these steps in order:

1. Confirm Caddy routes every `/api/*` directly to the responsible
   service (no rule still points at `app:3000` or `api:4000`).
2. Remove the `api` service from `docker-compose.yml`.
3. Remove the `api` job from `.github/workflows/ci.yml`.
4. Remove the `api` matrix entry from `.github/workflows/docker-publish.yml`.
5. Move reusable pieces (env.ts pattern, middleware, logger, metrics)
   into `packages/observability` for adoption by every other service.
6. Delete `apps/api/`.
7. Mark `leetrank-api` Docker Hub image as deprecated; do not delete
   for 90 days so any pin still pulls.

If the deletion needs to be reverted, the commit is a single
`git revert` on a single PR.
