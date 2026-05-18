# 11. Plan to split backend and frontend into independent services

Date: 2026-05-18

## Status

Proposed. Tracked refactor — phased rollout planned for v0.2.

## Context

LeetRank today is a monolithic Next.js application: the same process serves
the React UI **and** the JSON API consumed by it. Routes under `src/app/api/*`
share the Node runtime, the Prisma client, and the request lifecycle of the
pages they back. The Go judge service is already a separate process, but
everything else lives in one container.

This is fine for early iteration. As the platform grows, the trade-offs
become uncomfortable:

- **Scale-and-deploy coupling.** A traffic spike on `/api/leaderboard/top`
  forces the same fleet to handle the rendered HTML for `/leaderboard` —
  even though the rendered page is mostly static and the API is the hot
  spot. Conversely, every `next build` to ship a UI tweak redeploys the
  entire API.
- **Blast radius.** A bad API deploy takes the UI offline with it. There is
  no way to roll forward the frontend independently when the backend has
  a regression, or vice versa.
- **Language lock-in.** API routes are TypeScript on Node by default. If a
  hot endpoint would benefit from being in Go or Rust, the only option
  today is sidecar via the judge pattern, which means duplicating Prisma
  access logic.
- **Team workflow.** Frontend changes and backend changes touch the same
  build, the same test suite, and (crucially) the same review queue. Two
  teams cannot move independently.
- **Boundary clarity.** Without a network boundary between FE and BE, it is
  too easy to leak prisma types into UI code, share assumptions about
  runtime, or accidentally call internal helpers from a Server Component.

## Decision

We will split LeetRank into two top-level services with distinct
responsibilities, deployable and scalable independently:

```
leetrank/
├── apps/
│   ├── web/          # Next.js UI only — Server Components, route handlers
│   │                 # for things tied to rendering (auth callbacks, OG
│   │                 # images), and proxies to the backend.
│   │
│   └── api/          # Standalone HTTP service. Initial implementation
│                     # in TS (Hono or Fastify) reusing the existing
│                     # route logic; later parts may rewrite into Go.
│
├── packages/
│   ├── api-contracts/  # OpenAPI spec + zod schemas + generated TS clients.
│   │                   # Frontend imports the client; backend imports the
│   │                   # schemas. Single source of truth.
│   ├── prisma/         # Schema + generated client. Owned by the api app
│   │                   # but exposed as a workspace package so seed scripts
│   │                   # and tests can import it.
│   └── ui/             # Shared design tokens, primitives, and storybook.
│
├── services/
│   └── judge/        # Existing Go judge — already separate, no change.
│
└── infra/            # Docker compose, Caddy, observability stack.
```

The frontend talks to the backend over HTTP — same way an external client
would. No imports from `apps/api` into `apps/web` and no shared runtime
state. The contract between them is `packages/api-contracts/openapi.yaml`,
which we already maintain (see `docs/openapi.yaml` from ADR 0001 era).

## Migration plan

This is a multi-step refactor; we don't do it in one PR. Phased rollout:

**Phase 1 — Workspaces (1 week).**
Convert the repo to a pnpm workspace. Move existing code under `apps/web/`
without behavioural change. Add `apps/api/` as an empty placeholder.

**Phase 2 — Extract a vertical slice (2 weeks).**
Pick one route family — the public read endpoints (`/api/leaderboard/top`,
`/api/tags`, `/api/contests`) since they're cacheable and read-only — and
move them into `apps/api/` running as a separate process. Update the
frontend to call the new origin via a server-side rewrite (so the public
URL is unchanged).

**Phase 3 — Move the rest of the API (4 weeks).**
Auth, submissions, discussions, admin. Each gets its own PR with parity
tests. The 409-test suite gets split between the two apps; integration
tests against the actual HTTP boundary replace in-process route tests.

**Phase 4 — Drop the API routes from the web app (1 week).**
Once nothing inside `apps/web/` references prisma directly, remove the
`/api/*` route handlers and the prisma dependency from `apps/web`.
Lock the boundary in CI (lint rule against `from "@/lib/db"` outside
`apps/api/`).

**Phase 5 — Optional Go port (deferred).**
Once the boundary is solid, hot endpoints can be ported to Go without
disrupting the frontend. The judge service is precedent.

## Consequences

**Positive:**

- FE and BE deploy and scale independently.
- Hot API endpoints can grow more replicas without re-rendering the UI.
- The OpenAPI contract becomes the canonical interface — generated clients
  give the frontend type safety and prevent drift.
- A bad backend deploy no longer takes the marketing site down.
- Team workflow improves — backend reviewers don't gate UI tweaks.
- Future Go/Python/Rust rewrites of specific services become possible
  without touching the rest of the codebase.

**Negative:**

- Network hop between FE and BE adds a few ms of latency to dynamic SSR
  pages. We mitigate by caching in the BFF layer where it matters.
- More moving parts to deploy and monitor (`web`, `api`, `judge`,
  postgres, redis, caddy, prometheus, grafana).
- Local dev requires either running multiple processes or compose. The
  existing `docker compose up` already does this, so the cost is low.
- The migration is risky if rushed — phased rollout is non-negotiable.

**Neutral:**

- Existing CI must learn the workspace layout. The `web`, `api`, `judge`,
  `audit`, `docker` jobs already split per concern, so the change is
  mostly path-prefix updates.

## Alternatives considered

- **Stay monolithic.** Rejected. The trade-offs above only get worse with
  scale, and refactoring becomes harder the longer we wait.
- **Microservices from day one.** Rejected for the bootstrap phase — the
  productivity hit on a 1-engineer team would have outweighed the
  scalability benefit. We're past that point now.
- **API as a Vercel Edge function.** Considered. Edge functions have
  compatibility issues (per the Vercel knowledge base) and we want full
  Node.js — Fluid Compute is the recommendation. We may eventually run
  `apps/api` on Fluid Compute, but the first cut runs in our own
  container alongside the existing judge service so we control the
  observability surface.
