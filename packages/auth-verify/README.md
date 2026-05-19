# @leetrank/auth-verify

Shared JWT verification and Hono middleware for LeetRank services. Used by `apps/api` and every future service to verify user JWTs locally without round-tripping to the auth service on every request.

See [ADR 0013](../../docs/adr/0013-service-to-service-auth.md) for the rationale.

## Two modes

| Mode | When | How |
|------|------|-----|
| **HS256** | Today (Phase 2) | Pass `kind: "hs256"` and the shared `JWT_SECRET`. Matches the cookies `apps/web` issues. |
| **JWKS** | Phase 3.1.1+ | Pass `kind: "jwks"` and the auth service JWKS URL. The key set is fetched once and cached with a 30 s cooldown. |

## Quickstart — HS256

```ts
import { verifyToken } from "@leetrank/auth-verify";

const result = await verifyToken(token, {
  kind: "hs256",
  secret: process.env.JWT_SECRET!,
});

console.log(result.payload.sub);      // user ID
console.log(result.payload.role);     // "user" | "admin" | undefined
console.log(result.expiresAt);        // Date
```

## Quickstart — JWKS (Phase 3.1.1)

```ts
import { verifyToken } from "@leetrank/auth-verify";

const result = await verifyToken(token, {
  kind: "jwks",
  jwksUrl: new URL("http://identity:4011/.well-known/jwks.json"),
  expectedIssuer: "https://leetrank.io",
  expectedAudience: "leetrank-api",
});
```

The JWKS fetcher is cached per URL — multiple calls reuse the same cached key set.

## Typed errors

All errors extend `Error` and carry a `code` property for `switch` dispatch.

| Class | `code` | HTTP status | Meaning |
|-------|--------|-------------|---------|
| `TokenInvalidError` | `TOKEN_INVALID` | 401 | Malformed, missing `sub`/`exp`, or signature mismatch |
| `TokenExpiredError` | `TOKEN_EXPIRED` | 401 | Token past its `exp` claim |
| `TokenAudienceError` | `TOKEN_AUDIENCE` | 403 | `aud` claim does not match `expectedAudience` |
| `TokenIssuerError` | `TOKEN_ISSUER` | 403 | `iss` claim does not match `expectedIssuer` |

```ts
import {
  verifyToken,
  TokenExpiredError,
  TokenInvalidError,
  TokenAudienceError,
  TokenIssuerError,
} from "@leetrank/auth-verify";

try {
  const result = await verifyToken(token, opts);
} catch (err) {
  if (err instanceof TokenExpiredError) {
    // prompt re-login
  } else if (err instanceof TokenAudienceError || err instanceof TokenIssuerError) {
    // 403 — token is valid but not for this service
  } else if (err instanceof TokenInvalidError) {
    // 401 — bad token
  }
}
```

## Hono middleware

### `requireAuth`

Requires a valid token. Returns `401` (or `403` for audience/issuer mismatch) and short-circuits the handler chain when verification fails.

```ts
import { requireAuth } from "@leetrank/auth-verify";
import type { VerifiedPayload } from "@leetrank/auth-verify";
import { Hono } from "hono";

type AppEnv = { Variables: { auth: VerifiedPayload } };
const app = new Hono<AppEnv>();

const authMiddleware = requireAuth({
  verify: { kind: "hs256", secret: process.env.JWT_SECRET! },
});

app.get("/me", authMiddleware, (c) => {
  const { sub, role } = c.get("auth");
  return c.json({ userId: sub, role });
});
```

### `optionalAuth`

Best-effort verification. Attaches `auth` to the context if the token is valid; lets the request through without `auth` if no token is present or verification fails. Useful for routes that vary their response based on login state.

```ts
import { optionalAuth } from "@leetrank/auth-verify";

app.get("/problems", optionalAuth({ verify: opts }), (c) => {
  const auth = c.get("auth"); // VerifiedPayload | undefined
  // show editorial only to logged-in users
});
```

## Cookie name customisation

Both middleware factories accept an optional `cookieName`. The default is `"leetrank_session"`, which matches the cookie `apps/web` sets today.

```ts
requireAuth({
  cookieName: "my_session",
  verify: { kind: "hs256", secret: process.env.JWT_SECRET! },
});
```

Token lookup order: `Authorization: Bearer <token>` header first, then the named cookie.

## Peer dependencies

```json
{
  "hono": "^4.0.0",
  "jose": "^5.0.0"
}
```

Both must be installed in the consuming service. They are not bundled.

---

**Author:** Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)
