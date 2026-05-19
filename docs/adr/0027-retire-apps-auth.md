# 27. Retire `apps/auth` in favour of the `services/auth-go` identity service

Date: 2026-05-19

## Status

Accepted.

## Context

LeetRank has been running two auth services side-by-side since Phase 3.1:

- **`apps/auth`** — TypeScript / Hono service on port `4001`, scaffolded in [ADR 0016](0016-leetrank-auth-service.md). Most endpoints were `501 Not Implemented` stubs while the production handlers were ported into the Go rewrite. JWKS returned an empty key set. Image: `nguyenson1710/leetrank-auth`.
- **`services/auth-go`** (a.k.a. `identity`) — Go service on port `4011` introduced in [ADR 0017](0017-auth-go-rewrite.md). Owns the real register / login / me / logout / change-password handlers (Phase 3.1.5) and as of last week ships a real Ed25519 keystore with JWKS published at `/.well-known/jwks.json` (Phase 3.1.1). Image: `nguyenson1710/leetrank-identity`.

Caddy was routing `/api/v1/auth/*` to `auth:4001`, which then forwarded to itself or returned 501. The Go service was reachable but not on the canonical Caddy path. The cutover plan in ADR 0017 always called for `apps/auth` to be deleted once the Go rewrite was healthy and JWKS was real. That moment has arrived.

Running two auth services in parallel had real costs:

- **Doubled blast radius.** Any auth incident has to be triaged twice. Two healthcheck endpoints, two Prometheus jobs, two sets of logs, two Docker images on every release.
- **Split-brain risk on JWT issuance.** Both services read `JWT_SECRET` and could in principle mint conflicting tokens. The Ed25519 keystore lives in `services/auth-go` only — `apps/auth` has no access to the private key, so it could never become a real issuer without duplicating that work.
- **Confusing service map.** New contributors hit ADR 0016 and ADR 0017 and have to read both to figure out which one is "the" auth service. The README service table called this out explicitly as "Cutover (TS) / Cutover (Go)" — a state, not a destination.
- **Wasted CI and registry budget.** Build, push, and Trivy-scan runs for an image that nothing depends on.

The decision to retire one of them was always going to be `apps/auth`. The Go service has the real keystore, the lower image size (~15 MB distroless vs. ~150 MB Node), the lower latency, and the production handlers. Keeping `apps/auth` would mean re-porting the Ed25519 keystore back into TypeScript for no gain.

## Decision

Collapse the two auth services into one. **`services/auth-go` (identity, port 4011) is the sole canonical auth service for LeetRank going forward.** `apps/auth` is removed from the codebase.

The cutover is done in a single PR rather than a phased canary because:

1. `apps/auth` was already returning 501s for the real handlers — it had no real users.
2. Caddy controls the public route; the change is a one-line upstream swap from `auth:4001` to `identity:4011`.
3. The Go service has been running in parallel for the entire scaffold phase and serves the real handlers today.

The PR makes these changes:

- **Caddy** — `infra/caddy/Caddyfile`: `/api/v1/auth/*` now reverse-proxies to `identity:4011`. Order preserved: identity block sits above the generic `/api/v1/*` catch-all to `api:4000`.
- **Compose** — `docker-compose.yml`, `docker-compose.local.yml`: the `auth:` service block is removed. `identity:` is unchanged.
- **CI** — `.github/workflows/ci.yml`: the `auth` job (TS typecheck/build) is replaced with a no-op `auth-go` placeholder gated on `if: false` so the existing `docker` job's `needs:` chain stays valid. The `go-tests` matrix already covers `services/auth-go`.
- **Container publish** — `.github/workflows/docker-publish.yml`: the `auth` matrix entry is removed. `nguyenson1710/leetrank-auth` is no longer built or pushed.
- **Trivy** — `.github/workflows/trivy.yml`: scans `nguyenson1710/leetrank-identity:latest` instead of `nguyenson1710/leetrank-auth:latest`.
- **Dependabot** — `.github/dependabot.yml`: the `/apps/auth` npm and docker entries are removed.
- **Prometheus** — `infra/prometheus/prometheus.yml`: the `job_name: auth` scrape target switches from `auth:4001` to `identity:4011`.
- **Status page** — `src/app/api/status/route.ts`: `AUTH_INTERNAL_URL` defaults to `http://identity:4011`. The probed service id and display name are renamed to `identity` / `Identity Service`.
- **Source deletion** — `apps/auth/` is deleted via `git rm -rf`. The `pnpm-workspace.yaml` glob (`apps/*`) automatically drops it. The root `package.json` had no direct `apps/auth` reference.
- **Docs** — README service map, architecture diagram, port table, runbooks (`auth.md`, `caddy.md`, `api.md`, `redis.md`, `postgres.md`, `INDEX.md`), `CONTRIBUTING.md`, `docs/onboarding.md`, and `packages/auth-verify/README.md` are updated to point at `identity:4011`. The runbook formerly titled "Auth Service Runbook (`apps/auth`)" becomes "Identity Service Runbook (`services/auth-go`)".

The dual-registry publish is unaffected: `nguyenson1710/leetrank-identity` and `ghcr.io/jasontm17/leetrank-identity` continue to build on every push to `main`.

### What about `src/lib/auth.ts`?

The Next.js helper at `src/lib/auth.ts` still mints its own HS256 JWTs for cookie sessions issued by the Next.js `/api/auth/*` routes. It is **not** migrated to JWKS verification in this PR.

That helper is the residual HS256 caller. Its migration to `createRemoteJWKSet` against `http://identity:4011/.well-known/jwks.json` is a separate workstream because:

- The Next.js auth routes (`src/app/api/auth/*`) currently do their own bcrypt password hashing and HS256 cookie minting. Migrating verification without first migrating issuance would create a token-format mismatch on the server side.
- Frontend session cookies are domain-scoped to `apps/web`; identity cookies are issued separately. The two surfaces still need to be reconciled — either by deleting the Next.js auth routes outright (preferred) or by treating them as a thin proxy over identity.

The goal of *this* ADR is to delete `apps/auth`, not to refactor every JWT path. The HS256 caller stays as-is and is tracked as future work in the Consequences section below.

## Consequences

### Positive

- **One auth service, one image, one route, one keystore.** Token issuance is unambiguous.
- **Token portability.** Every service that needs to verify a user JWT goes through JWKS at `identity:4011/.well-known/jwks.json` and gets the same Ed25519 public set. No more HS256 vs Ed25519 ambiguity at the boundary.
- **Single revocation path.** Rotating a key is one operation against one keystore in one container.
- **Smaller surface for attack and audit.** One Dockerfile, one Trivy scan target for the auth path, one runbook.
- **Faster CI.** One less matrix entry in `docker-publish.yml` and one less job in `ci.yml` per push.
- **Cleaner ops.** `docker compose up identity` replaces `docker compose up auth auth-go`. The port table in the README drops a row.

### Negative

- **Residual HS256 issuer.** `src/lib/auth.ts` still mints HS256 cookies; the platform is not yet 100% Ed25519 end-to-end. Documented in the section above. Tracked as `F-067` in the prod-readiness audit.
- **Existing user sessions remain HS256.** Sessions minted by the Next.js auth routes do not gain Ed25519 properties retroactively. This is fine — the cookie is opaque to the user — but operators reviewing logs will see two token formats coexisting until the Next.js auth routes are migrated.
- **External JWKS callers must update their URL.** Anything outside the cluster that pinned `http://auth:4001/.well-known/jwks.json` needs to swap to `http://identity:4011/.well-known/jwks.json`. Inside the cluster the swap is just the compose service name change.
- **Phase 3.1 documentation has fossils.** ADR 0016 still describes the scaffold phase as if `apps/auth` were a long-lived service. ADR 0017 already covers the rewrite and is the source of truth for the design; ADR 0027 (this document) covers the deletion. We do not edit historical ADRs.

### Migration

For an existing deployment, the cutover is:

```bash
# 1. Pull the new images and Caddyfile
git pull
docker compose pull

# 2. Stop and remove the old container
docker compose down auth

# 3. Bring up identity (no-op if already running)
docker compose up -d identity

# 4. Reload Caddy so the new /api/v1/auth/* upstream takes effect
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

# 5. Smoke
curl -fsS http://identity:4011/healthz
curl -fsS http://identity:4011/.well-known/jwks.json | jq '.keys | length'
curl -fsS http://localhost/api/v1/auth/healthz   # via Caddy
```

No DB migration is required — both services already shared the same Postgres tables and the same `JWT_SECRET`.

### Future work

1. **Migrate `src/lib/auth.ts` to JWKS verification.** Replace the HS256 helper with `createRemoteJWKSet` against `http://identity:4011/.well-known/jwks.json`, with a 10-minute cache.
2. **Delete the Next.js auth routes.** `src/app/api/auth/login`, `register`, `logout`, `me` should become thin redirects to `/api/v1/auth/*` (or be deleted outright if the frontend is updated to call identity directly).
3. **Drop `JWT_SECRET` from non-issuer services.** Once every verifier is on JWKS, `JWT_SECRET` only needs to live in `identity` (the issuer that signs HS256 fallbacks during rollout) and `web` (the residual HS256 minter). The other services can stop accepting it as an env var.

These three are sequenced and tracked separately. They are explicitly **not** part of this ADR — this ADR is the deletion ADR.

## Alternatives considered

### Keep both services and let `apps/auth` proxy to `identity`

Rejected. Adding a hop with no logic doubles latency for no benefit and keeps the dual blast radius intact. The 501 stubs were never going to become real handlers in TypeScript — that is what `auth-go` already does.

### Migrate `src/lib/auth.ts` in the same PR

Rejected for scope. The deletion of `apps/auth` is mechanical and reversible if anything goes wrong. The HS256 → JWKS migration on the Next.js side touches the cookie issuance path and the auth route handlers, which is a much larger blast radius. Coupling them would put two unrelated risks behind the same revert button.

### Rebrand `services/auth-go` back to `auth`

Rejected. The image and service name `identity` already exists in CI, in the registry, in `docker-compose.yml`, and in the routing table. Renaming back to `auth` would mean breaking every consumer that pulls `nguyenson1710/leetrank-identity:latest` for no operational gain.

## References

- [ADR 0013](0013-service-to-service-auth.md) — Service-to-service auth (Ed25519 JWKS)
- [ADR 0016](0016-leetrank-auth-service.md) — `leetrank-auth` service scaffold (superseded by this ADR for the deletion)
- [ADR 0017](0017-auth-go-rewrite.md) — `leetrank-auth-go` rewrite
- [ADR 0025](0025-secret-management.md) — Secret management
- `services/auth-go/README.md` — identity service README and runbook
- `docs/runbooks/auth.md` — identity service runbook
