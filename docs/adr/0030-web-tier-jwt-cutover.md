# 0030 — Web tier JWT cutover to JWKS verify-only

Status: Accepted
Date: 2026-05-19

## Context

The Next.js web tier (`src/lib/auth.ts`, `src/middleware.ts`) currently signs and
verifies session cookies with a single shared HS256 secret (`JWT_SECRET`). The
identity service (`services/auth-go`) is the system of record for users and
already publishes asymmetric keys at `/.well-known/jwks.json`. The shared
HS256 secret is a soft target: any service with read access to the env can
mint admin tokens, and rotation requires a coordinated restart.

A security review flagged the 7-day access TTL as too long given that
revocation is best-effort (we rely on cookie deletion). Production tokens
should be short-lived; the refresh path issued by the identity service does
the long-lived work.

## Decision

Cut the web tier over to JWKS verification, in two phases.

### Phase 1 — verify-both, sign-HS256 (this ADR)

- Web tier verifies JWKS first. The token's protected header is decoded; if
  `alg` is anything other than `HS256` (RS256, ES256, EdDSA), we verify
  against the cached `createRemoteJWKSet(AUTH_JWKS_URL)`.
- HS256 verification is gated by `LEGACY_HS256_FALLBACK`. In production it
  defaults to off; dev/test default to on so existing flows keep working
  while the identity service is being wired up.
- The web tier keeps signing HS256 in `signToken()` for now — login, register,
  and refresh paths still mint local cookies. The TTL drops from 7 days to
  15 minutes as immediate mitigation; refresh is the user's responsibility
  via the identity service.
- `getSession()` and `middleware.ts` both go through the new
  `verifyTokenJwks()` entry point.

### Phase 2 — JWKS-only, identity-issued (next ADR)

- All authentication flows route through the identity service. The web tier
  stops signing tokens; `signToken()` becomes a thin wrapper around the
  identity-service mint endpoint or is removed entirely.
- `LEGACY_HS256_FALLBACK` is removed. Existing 15-minute HS256 cookies expire
  naturally; users re-authenticate against the identity service.
- The shared `JWT_SECRET` is rotated and demoted to a development convenience
  variable.

## Consequences

Positive:
- Asymmetric keys mean only the identity service can mint; key rotation is
  decoupled from web-tier deploys.
- 15-minute access TTL caps the blast radius of any leaked cookie.
- The cutover is reversible — flipping `LEGACY_HS256_FALLBACK=true` in
  production restores the old verify path.

Negative / risks:
- JWKS fetch failures (DNS, identity service down) now block the verify
  path for asymmetric tokens. `jose`'s `createRemoteJWKSet` caches keys, so
  steady-state cost is zero, but a cold start during an identity-service
  outage will fail closed. Acceptable: failing closed on auth is correct.
- Phase 1 does not eliminate the HS256 secret. Phase 2 must follow within
  one release cycle to actually retire the symmetric key.

## Configuration

| Var                       | Default                                              | Purpose                                                |
|---------------------------|------------------------------------------------------|--------------------------------------------------------|
| `AUTH_JWKS_URL`           | `http://identity:4011/.well-known/jwks.json`         | Remote JWKS endpoint                                   |
| `LEGACY_HS256_FALLBACK`   | `true` in dev/test, `false` in prod                  | Allow HS256 cookies during the cutover                 |
| `JWT_SECRET`              | required (16+ chars in prod)                         | HS256 sign + verify key (legacy)                       |

## References

- ADR 0016 — leetrank-auth-service
- ADR 0017 — auth-go rewrite
- `services/auth-go/internal/auth/handler.go` (issuer)
- `src/lib/auth.ts`, `src/middleware.ts`
