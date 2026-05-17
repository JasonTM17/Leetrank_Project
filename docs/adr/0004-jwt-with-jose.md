# 4. JWT with jose, not jsonwebtoken

Date: 2026-05-17
Status: Accepted

## Context

We need to mint and verify session JWTs in three places:

1. The Next.js API route handlers running on Node (`src/lib/auth.ts`).
2. The Edge runtime middleware that gates `/dashboard` and `/admin`
   (`src/middleware.ts`).
3. Future tests and tooling.

The original prototype used `jsonwebtoken`, which is synchronous, ships
CommonJS, and depends on Node `crypto`. The Edge runtime supports neither
synchronous crypto nor Node's `crypto` module — only the Web Crypto API.

## Decision

Use **`jose`** for both signing (`SignJWT`) and verification (`jwtVerify`).
It's promise-based, ships ESM with type definitions, and uses Web Crypto so it
runs identically in Node and Edge.

## Consequences

- Single library across all three call sites.
- All token operations are async; route handlers are already async so this
  costs nothing.
- `jose` is roughly 1/4 the size of `jsonwebtoken` once tree-shaken.
- `jsonwebtoken` is no longer imported anywhere but is still in `package.json`
  as a transitive dependency of `bcryptjs`. We don't need to remove it
  manually; npm dedup keeps things clean.

## Alternatives considered

- **`jsonwebtoken`** — the legacy choice; doesn't run in Edge, sync API.
- **`@panva/jose` (the same project, older entry point)** — superseded.
- **Roll-our-own with Web Crypto** — possible (HS256 is just HMAC-SHA256 over
  base64url-encoded segments) but yields nothing besides a maintenance burden.
