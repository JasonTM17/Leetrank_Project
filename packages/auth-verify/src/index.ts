/**
 * @leetrank/auth-verify — shared JWT verification + Hono middleware.
 *
 * HS256 today (matches apps/web's existing cookie auth), JWKS-ready for
 * Phase 3.1 when leetrank-auth becomes a separate service. Used by
 * apps/api and every future service to verify user JWTs without
 * round-tripping to auth on every request.
 *
 * See docs/adr/0013-service-to-service-auth.md.
 */

export {
  verifyToken,
  TokenInvalidError,
  TokenExpiredError,
  TokenAudienceError,
  TokenIssuerError,
} from "./verify.js";
export type { VerifyOptions, VerifiedPayload, VerifiedToken } from "./verify.js";

export { requireAuth, optionalAuth } from "./middleware.js";
export type { AuthMiddlewareOptions } from "./middleware.js";
