# 13. Service-to-service authentication

Date: 2026-05-18

## Status

Proposed. Required by Phase 3.0 in
`.claude-private/microservices-plan/04-migration-sequencing.md`.

## Context

Today every service inside the docker network can call every other
service unauthenticated. `apps/api` exposes port 4000 with no auth
guard, the judge's `/execute` endpoint trusts every caller, and the
shared `JWT_SECRET` is reused by `app` and `api` for user-facing JWTs.

As soon as we extract `leetrank-auth` (Phase 3.1) and the
`leetrank-submissions` worker starts calling the judge with privileged
operations (fetching hidden test cases), we need:

1. A way for a service to prove its identity to another service.
2. A way to carry the original user's identity through that hop.
3. A rotation procedure so a leaked secret can be retired without
   downtime.

## Decision

**Use Ed25519-signed JWTs for service-to-service auth, with a 90-day
rotation cycle. JWKS published by `leetrank-auth` is the single source
of public keys.**

Concretely:

- `leetrank-auth` (currently the Next.js auth handlers; later a separate
  service) holds the private signing key. It issues two distinct token
  types from the same key:
  - **User access tokens** (`aud=leetrank-web,leetrank-api`, today's
    cookie token).
  - **Service tokens** (`aud=leetrank-submissions` or similar — one per
    target). Issued on demand to a service that has already
    authenticated to `auth` via a long-lived shared secret.
- Every service consumes `auth/.well-known/jwks.json` at startup and
  caches the result for 30 minutes. Token verification is purely local
  thereafter — no per-request hop to `auth`.
- A user calling `apps/web` → `apps/api` → `judge` carries:
  - The user JWT in the cookie / `Authorization: Bearer ...` header
    (verified by `apps/api`).
  - A new service JWT minted by `apps/api` with `act` claim
    (RFC 8693 actor token) embedding the user's `sub`. The judge
    verifies the service token and uses `act.sub` for audit trail.

## Why Ed25519 (not RS256, not HS256)

- HS256 is what we have today. Symmetric → every consumer of the secret
  can also mint tokens. Cannot scale past two services. Already a
  RULES §4 violation in spirit.
- RS256 keys are 2048+ bits → JWKS payloads are larger, signing is
  ~10× slower than Ed25519. We do not need RSA's library compatibility;
  `jose@^5` ships Ed25519.
- Ed25519: 256-bit key, 64-byte signature, native in `jose`. Faster
  signing (we sign on every login + every service hop), smaller JWKS,
  modern.

## Rotation

- Two key slots: `JWT_SIGNING_KEY_PRIMARY`, `JWT_SIGNING_KEY_SECONDARY`.
  Both are listed in JWKS at all times.
- Issuer signs new tokens with PRIMARY only. Verifiers accept either.
- Rotation: secondary ← primary (old), primary ← new key. Wait
  `max(token_lifetime, jwks_cache_ttl) + 5min` before retiring the old
  key entirely.
- Drill: practiced quarterly on staging before the first prod rotation
  (Plan 04 G3.0 gate criterion).

## Consequences

**Positive**
- Each service can verify tokens without a network call.
- Symmetric JWT_SECRET retired; no more shared-key blast radius.
- Token audience claim makes "this token was minted for service X"
  explicit; misuse is observable.
- Rotation is mechanical, not panicked.

**Negative**
- One more piece of state for `auth` to manage (the signing key + JWKS
  endpoint + key rotation script).
- Initial migration window: services must accept BOTH HS256 (legacy
  cookies) and Ed25519 (new tokens) for ~30 days while existing
  sessions expire.

**Neutral**
- Cookie-vs-header auth surface unchanged for users. The new token
  format only affects service↔service traffic.

## Implementation note

The shared verifier scaffold lives at `packages/auth-verify/` (created
in this session, currently empty). Phase 3.0 fills it. `apps/api`
wires `requireAuth(token)` middleware once the package is real.

## Alternatives considered

- **mTLS via a service mesh (Linkerd / Istio).** Stronger guarantees,
  but mesh comes with its own ops surface. Plan 04 anti-goal #2 defers
  mesh until ≥ 5 services in prod.
- **OIDC against an external IdP (Auth0, etc.).** Too much overhead
  for an internal trust boundary. Use external OIDC for human
  authentication only (and only if we add SSO later).
