import type { Context, MiddlewareHandler } from "hono";
import {
  verifyToken,
  TokenInvalidError,
  TokenExpiredError,
  TokenAudienceError,
  TokenIssuerError,
  type VerifyOptions,
  type VerifiedPayload,
} from "./verify.js";

/**
 * Hono middleware factories for token-based auth.
 *
 * Reads the bearer token from the Authorization header first, falls back
 * to a configurable cookie. On success, attaches the verified payload at
 * c.set("auth", ...).
 *
 * Consumers extend the Hono Variables type at the app level:
 *   type AppEnv = { Variables: { auth: VerifiedPayload } };
 *   const app = new Hono<AppEnv>();
 * We don't ship a global declaration to avoid clobbering app-specific
 * Variables types.
 */

export interface AuthMiddlewareOptions {
  /**
   * Cookie name to fall back to when no Authorization header is present.
   * Default: "leetrank_session" (matches the cookie apps/web sets today).
   */
  cookieName?: string;
  /**
   * Verification options — passed straight through to verifyToken.
   */
  verify: VerifyOptions;
}

const DEFAULT_COOKIE_NAME = "leetrank_session";

function readToken(c: Context, cookieName: string): string | null {
  const auth = c.req.header("authorization") ?? c.req.header("Authorization");
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match && match[1]) return match[1].trim();
  }

  // Hono's c.req.header("cookie") returns the raw Cookie header. Parse out
  // the named cookie ourselves — bringing in `hono/cookie` is fine but the
  // single-cookie lookup is cheap and dependency-free.
  const cookieHeader = c.req.header("cookie") ?? c.req.header("Cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name === cookieName) {
      const value = trimmed.slice(eq + 1).trim();
      return value.length > 0 ? decodeURIComponent(value) : null;
    }
  }
  return null;
}

function jsonError(c: Context, status: 401 | 403, error: string): Response {
  return c.json({ error }, status);
}

function classifyError(err: unknown): 401 | 403 {
  // Audience and issuer mismatches are 403 (token is valid, just not for us).
  // Everything else is 401 (caller has no usable identity).
  if (err instanceof TokenAudienceError) return 403;
  if (err instanceof TokenIssuerError) return 403;
  return 401;
}

/**
 * Require a valid token. On failure, returns 401 (or 403 for audience/issuer
 * mismatch) and short-circuits the handler chain.
 */
export function requireAuth(opts: AuthMiddlewareOptions): MiddlewareHandler {
  const cookieName = opts.cookieName ?? DEFAULT_COOKIE_NAME;
  return async (c, next) => {
    const token = readToken(c, cookieName);
    if (!token) {
      return jsonError(c, 401, "Unauthorized");
    }
    try {
      const verified = await verifyToken(token, opts.verify);
      c.set("auth", verified.payload satisfies VerifiedPayload);
      await next();
    } catch (err) {
      const status = classifyError(err);
      const reason =
        err instanceof TokenExpiredError
          ? "Token expired"
          : err instanceof TokenAudienceError || err instanceof TokenIssuerError
            ? "Forbidden"
            : err instanceof TokenInvalidError
              ? "Unauthorized"
              : "Unauthorized";
      return jsonError(c, status, reason);
    }
  };
}

/**
 * Best-effort verification. Attaches `auth` if the token is valid, otherwise
 * lets the request through without setting `auth`. Useful for routes that
 * vary their response based on whether the caller is logged in.
 */
export function optionalAuth(opts: AuthMiddlewareOptions): MiddlewareHandler {
  const cookieName = opts.cookieName ?? DEFAULT_COOKIE_NAME;
  return async (c, next) => {
    const token = readToken(c, cookieName);
    if (token) {
      try {
        const verified = await verifyToken(token, opts.verify);
        c.set("auth", verified.payload satisfies VerifiedPayload);
      } catch {
        // Swallow — best-effort.
      }
    }
    await next();
  };
}
