# 17. leetrank-auth-go: rewrite the auth service in Go

Date: 2026-05-19

## Status

Proposed

## Context

`apps/auth` (TypeScript / Hono) was scaffolded in Phase 3.1 but ships
only 501 stubs — no real `register`, `login`, `me`, or `change-password`
handlers. The user has asked the backend services to be written in Go
(or Rust / Ruby) for performance, operational simplicity, and to align
with the existing Go judge service. Doing the rewrite now is materially
cheaper than after handlers ship: there is nothing to port, only a
contract to honour.

This ADR extends ADRs 0011 (FE/BE split), 0013 (Ed25519 JWKS), and 0016
(leetrank-auth scaffold).

## Decision

Ship `services/auth-go` in parallel with `apps/auth`. Same wire surface,
different runtime:

- Web framework: chi (`github.com/go-chi/chi/v5`)
- DB driver: pgx v5
- JWKS: `github.com/go-jose/go-jose/v4` (HS256 today, Ed25519 in 3.1.5)
- Logger: stdlib `log/slog` JSON handler
- Metrics: `prometheus/client_golang`
- Bcrypt cost 12 (`golang.org/x/crypto/bcrypt`)

Container: distroless static runtime (~15 MB). Port 4011 in compose
(distinct from TS auth's 4001) so both can run side-by-side during
the cutover window. Caddy keeps routing `/api/v1/auth/*` to the TS
service until the Go service has feature parity AND has been canary'd
for 7 days with zero auth-related P1/P2 incidents.

## Consequences

Positive:
- Final image is ~15 MB vs. ~150 MB for `apps/auth`. Pull time on
  Fargate cold starts drops by ~5x.
- Single static binary — no `node_modules` to audit, no Prisma engine
  to ship, no glibc-vs-musl drama.
- Goroutine concurrency model handles login bursts without an event
  loop bottleneck.
- pgx is the fastest mainstream Postgres driver; sub-ms latency for
  pings and prepared statements.

Negative:
- Two services to operate during cutover (~4 weeks).
- No Prisma — `services/auth-go` owns its own SQL migrations via
  golang-migrate. Schema diverges from the root `prisma/schema.prisma`
  and that's on purpose: per Plan 04 §7 each service owns its data.
- `packages/auth-verify` (TS) has no Go counterpart; service-to-service
  verification on the Go side will use go-jose directly.

## Alternatives considered

- Stay on TS, fill in handlers there. Cheapest if we already had a
  reason to keep `apps/auth`. We don't — there's nothing to keep.
- Rust + axum. Tempting for memory safety and even smaller binaries,
  but the team has zero Rust experience in tree (judge is Go). Picking
  Go aligns with what we already operate.
- Ruby + Sinatra/Rails. Productivity-friendly but adds a third runtime
  to the platform; no operational win.

## Rollout / cutover

1. Ship `services/auth-go` v0.1 with 501 stubs (this commit). Caddy
   does not route to it yet.
2. Phase 3.1.5: implement register/login/me/logout/change-password in
   Go, ship integration tests against a real Postgres in CI.
3. Generate Ed25519 keypair at boot, persist to a mounted volume,
   publish JWKS. `apps/api` and `apps/web` switch to JWKS verification
   from `auth-go:4011/.well-known/jwks.json`.
4. Caddy flips `/api/v1/auth/*` to `auth-go:4011`. `apps/auth` (TS)
   stays running for 14 days as a hot rollback target.
5. After 14 days clean, remove `apps/auth` from `docker-compose.yml`
   and the `docker-publish.yml` matrix. Filed as a follow-up commit.

## References

- `services/auth-go/cmd/server/main.go`
- `services/auth-go/internal/jwks/keystore.go`
- `apps/auth/src/server.ts` (the TS reference being replaced)
- ADR 0013 — service-to-service auth (Ed25519 + JWKS)
- ADR 0016 — leetrank-auth service scaffold
