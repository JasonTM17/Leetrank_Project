# 0004. JWT with jose, not jsonwebtoken

Date: 2026-05-17
Status: Accepted

## Context

LeetRank uses JWTs for session management. The token is set as an HTTP-only cookie on login and verified in two places:

1. **Next.js Middleware** (`src/middleware.ts`) — runs on the Edge Runtime to protect `/dashboard` and `/admin` routes before the request reaches any server component or API route.
2. **Server-side helpers** (`src/lib/auth.ts`) — `signToken` and `verifyToken` used in API route handlers.

The Edge Runtime does not support Node.js built-ins (`crypto`, `Buffer`, `fs`, etc.). The popular `jsonwebtoken` package relies on Node's `crypto` module synchronously and cannot run in an edge context. Attempting to import it in middleware throws at build time.

Additionally, `jsonwebtoken`'s API is callback/sync-only; it predates the Web Crypto API and does not expose `Promise`-based methods, making it awkward in an `async` middleware function.

## Decision

Use **`jose`** (v6, see `package.json`) for all JWT operations. `jose` is built on the Web Crypto API, works in Node.js, Edge Runtime, Deno, and browsers without polyfills. Both `src/lib/auth.ts` and `src/middleware.ts` import `SignJWT` and `jwtVerify` from `jose`.

The signing algorithm is HS256 with a secret derived from `process.env.JWT_SECRET` via `TextEncoder` (Web Crypto compatible). Tokens expire after 7 days (`setExpirationTime("7d")`).

## Consequences

- **Easier:** Middleware JWT verification works on the Edge Runtime without any webpack configuration or polyfills. The async API fits naturally into `async function middleware`.
- **Harder:** `jose` has a more verbose API than `jsonwebtoken` (builder pattern for `SignJWT`). Developers familiar with `jsonwebtoken` need to learn the new API.
- **Note:** `jsonwebtoken` remains in `package.json` as a transitive dependency but is not imported anywhere in application code. It should be removed to avoid confusion.

## Alternatives considered

- **`jsonwebtoken`** — cannot run in Edge Runtime; sync API; rejected.
- **`next-auth` / `auth.js`** — full authentication framework; heavier than needed for a simple JWT cookie flow. Rejected to keep the auth layer minimal and explicit.
- **`@auth/core`** — same concern as next-auth; also requires adapter configuration for Prisma that adds indirection.
