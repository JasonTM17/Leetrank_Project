# ADR 0018 — Go services buildout: submissions and problems

**Status:** Proposed

**Date:** 2026-05-19

## Context

`services/auth-go` proved the Go runtime works end-to-end in this monorepo (ADR 0017). Two more services are natural next candidates:

- `apps/api` — a thin Hono/Node scaffold that currently holds the problems list, problem detail, leaderboard, and submissions read handlers. None of these handlers have grown complex business logic yet.
- `src/app/api/submissions/route.ts` — the Next.js route that handles submission creation; it is already partially async (queued path) and will need judge dispatch in Phase 3.2.

## Decision

Scaffold `services/submissions-go` (port 4012) and `services/problems-go` (port 4013) as idiomatic Go services using the same chi v5 + pgx v5 + slog + Prometheus stack established in `auth-go`. Both services run in parallel with the existing TS handlers during a cutover window, identical to the auth-go pattern.

`submissions-go` ships real read handlers now; the POST create and SSE stream endpoints are 501 stubs until Phase 3.2 wires judge dispatch.

`problems-go` ships all read handlers (list, detail, trending, random, leaderboard/top, stats) as real SQL queries.

## Rationale

1. **Judge already proves the runtime.** The judge service is Go; operating one language family for all backend services reduces cognitive overhead and simplifies the container build matrix.

2. **Migrating now is cheaper than later.** The TS handlers in `apps/api` are thin scaffolds with no accumulated business logic. Rewriting them before real handlers ship avoids a future migration of a live, battle-tested service.

3. **Blast radius is small.** Both services are read-heavy. The TS services remain running during the cutover window; Caddy routes can be flipped per-endpoint with zero downtime.

4. **Operational consistency.** One Dockerfile shape, one healthcheck pattern (`-healthcheck` flag), one metrics namespace, one structured log format across all Go services makes runbooks and alerting rules reusable.

## Consequences

- Two new Docker images (`nguyenson1710/leetrank-submissions-go`, `nguyenson1710/leetrank-problems-go`) added to the CI matrix.
- `docker-compose.yml` gains two new service blocks; `docker-compose.local.yml` remaps their ports to 14012/14013.
- `apps/api` and `src/app/api/submissions/` are **not** deleted until the cutover canary completes (separate ADR).
- Phase 3.2 must fill `POST /v1/submissions` and `GET /v1/submissions/:id/stream` in `submissions-go`.
