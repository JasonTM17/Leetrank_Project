import type { Context } from "hono";

/**
 * JWKS endpoint — Phase 3.1 scaffold.
 *
 * Returns an empty key set for now. Real Ed25519 keys land in Phase 3.1.1
 * when we generate the keypair and store the public key here. The endpoint
 * exists so other services (apps/api, apps/web) can fetch it without 404,
 * and so Caddy routing is already wired before the keys are real.
 *
 * RFC 7517 — JSON Web Key Set format.
 *
 * GET /jwks
 * GET /.well-known/jwks.json  (alias — standard discovery path)
 */

const EMPTY_JWKS = { keys: [] } as const;

export function jwksHandler(c: Context) {
  return c.json(EMPTY_JWKS, 200, {
    // Cache for 5 minutes — short enough to pick up key rotation quickly,
    // long enough to avoid hammering the service on every token verification.
    "Cache-Control": "public, max-age=300",
  });
}
