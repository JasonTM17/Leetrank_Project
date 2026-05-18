# 12. BFF or edge rewrite for the FE/BE cutover

Date: 2026-05-18

## Status

Proposed. Decision required before Phase 2d (cutover read traffic to apps/api)
in `.claude-private/microservices-plan/04-migration-sequencing.md`.

## Context

11 read-only routes have been ported from `src/app/api/*` (Next.js) to
`apps/api/src/routes/*` (Hono on port 4000). Both serve the same URLs
today. Cutover means: real browser traffic to those URLs must hit
`apps/api`, not the Next.js handler.

There are two ways to do that without changing the public URL:

1. **Edge rewrite at Caddy.** The reverse proxy matches the route pattern
   and forwards to `api:4000` instead of `app:3000`. Browser sees the
   same `/api/...` URL; routing decision is made one hop in.

2. **BFF helper inside `apps/web`.** A thin module — say
   `apps/web/src/lib/api-client.ts` — that the SSR/client code calls
   instead of fetching `/api/...` directly. The helper picks the upstream:
   the Hono service for ported routes, the in-process Next handler for
   the rest. Public URL is still `/api/...` because `apps/web` continues
   to expose those handlers (some as proxies, some still canonical).

## Decision

**Use edge rewrite at Caddy. Move the rule per route family, not per
endpoint.**

Reasoning:

- The browser already calls `/api/...`. We do not want to ship FE code
  changes to swing 11 (eventually 50+) routes — that is the bug-vector
  we said we would avoid.
- Caddy already terminates TLS and does path routing; it owns the
  `/api/auth/*` rate-limit zone. Adding a `reverse_proxy /api/leaderboard/*
  api:4000` line is one config change, applies to every consumer
  (browser + curl + future external clients) at once, and is reversible
  by reverting the line.
- A BFF helper requires `apps/web` to ship a release every time we
  cutover a route. That is exactly the deploy coupling we are splitting
  the services to avoid. Plan 04 §1 R1 (schema drift) extends to API
  drift: dual-source code paths drift faster than dual-source data.
- The cost — a bit of YAML/Caddyfile config — is bounded. The benefit
  scales as we cutover more routes.

## Consequences

**Positive**
- Zero `apps/web` changes required for cutover.
- One commit per cutover wave; rollback is `git revert` on the Caddyfile.
- External clients (mobile app, future API consumers) automatically
  hit the new origin.

**Negative**
- We lose the ability to run dual-traffic shadow tests by chance — to
  shadow we have to mirror the request explicitly in Caddy (it supports
  this) or do it in Cloudflare Workers / a sidecar. Plan accordingly
  when the parity test isn't enough confidence.
- Caddy becomes the choke point for routing decisions. Acceptable today
  (one ops surface to watch); a future move to ECS Fargate behind ALB
  per Plan 03 §2 absorbs this naturally.

**Neutral**
- SSR fetches inside `apps/web` still hit the Next.js process for
  unported routes. That's fine. SSR for ported routes can either keep
  going through Caddy (one extra hop) or be promoted to a direct
  service-to-service call once `@leetrank/auth-verify` lands in Phase 3.0.

## Alternatives considered

- **BFF helper.** Rejected (above).
- **Per-route hardcoded fetch URLs in the FE.** Rejected — couples
  every page to deployment topology.
- **Service mesh sidecar.** Premature (Plan 04 anti-goal #2).

## Implementation note

Add a comment block at the top of `infra/caddy/Caddyfile` listing every
route currently rewritten to `api:4000`. When the cutover is complete
(Phase 4), the comment converts to a list of remaining `app:3000` routes
— inverted because that's the smaller list at that point.
