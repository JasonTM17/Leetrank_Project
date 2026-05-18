import {
  jwtVerify,
  createRemoteJWKSet,
  errors as joseErrors,
  type JWTPayload,
  type JWTVerifyOptions,
  type JWTVerifyResult,
} from "jose";

/**
 * Shared JWT verification — symmetric (HS256) today, JWKS-ready for Phase 3.1.
 *
 * Two modes:
 *   - HS256: pass `secret` (string). Used by every service while leetrank-auth
 *     still issues HS256 cookies. Consumers wrap the existing JWT_SECRET.
 *   - JWKS: pass `jwksUrl` (URL). Used after the auth split lands. The JWKS
 *     endpoint is fetched once and cached by jose with a 30 s cooldown
 *     between revalidations.
 *
 * Errors are typed so callers can switch on `err.code`. Network/jose
 * exceptions are normalised so consumers don't have to import jose's
 * internal error types.
 */

export type VerifyOptions =
  | {
      kind: "hs256";
      secret: string;
      expectedAudience?: string | string[];
      expectedIssuer?: string;
    }
  | {
      kind: "jwks";
      jwksUrl: URL;
      expectedAudience?: string | string[];
      expectedIssuer?: string;
    };

export interface VerifiedPayload extends JWTPayload {
  sub: string;
  role?: string;
  exp: number;
}

export interface VerifiedToken {
  payload: VerifiedPayload;
  expiresAt: Date;
}

// ── Typed errors ─────────────────────────────────────────────────────────────

export class TokenInvalidError extends Error {
  readonly code = "TOKEN_INVALID";
  constructor(message = "Token invalid") {
    super(message);
    this.name = "TokenInvalidError";
  }
}

export class TokenExpiredError extends Error {
  readonly code = "TOKEN_EXPIRED";
  constructor(message = "Token expired") {
    super(message);
    this.name = "TokenExpiredError";
  }
}

export class TokenAudienceError extends Error {
  readonly code = "TOKEN_AUDIENCE";
  constructor(message = "Token audience mismatch") {
    super(message);
    this.name = "TokenAudienceError";
  }
}

export class TokenIssuerError extends Error {
  readonly code = "TOKEN_ISSUER";
  constructor(message = "Token issuer mismatch") {
    super(message);
    this.name = "TokenIssuerError";
  }
}

// ── JWKS cache ───────────────────────────────────────────────────────────────
//
// createRemoteJWKSet builds a fetcher with internal caching; we cache the
// fetcher itself per URL so multiple verifyToken calls reuse the cache
// instead of re-fetching the JWKS on every request.

type RemoteJWKSet = ReturnType<typeof createRemoteJWKSet>;
const jwksCache = new Map<string, RemoteJWKSet>();

function getJWKS(url: URL): RemoteJWKSet {
  const key = url.toString();
  let jwks = jwksCache.get(key);
  if (!jwks) {
    jwks = createRemoteJWKSet(url, { cooldownDuration: 30_000 });
    jwksCache.set(key, jwks);
  }
  return jwks;
}

// ── Verification ─────────────────────────────────────────────────────────────

export async function verifyToken(
  token: string,
  opts: VerifyOptions
): Promise<VerifiedToken> {
  if (typeof token !== "string" || token.length === 0) {
    throw new TokenInvalidError("Empty token");
  }

  const verifyOptions: JWTVerifyOptions = {};
  if (opts.expectedAudience !== undefined) {
    verifyOptions.audience = opts.expectedAudience;
  }
  if (opts.expectedIssuer !== undefined) {
    verifyOptions.issuer = opts.expectedIssuer;
  }

  let result: JWTVerifyResult<JWTPayload>;
  try {
    if (opts.kind === "hs256") {
      const key = new TextEncoder().encode(opts.secret);
      result = await jwtVerify(token, key, verifyOptions);
    } else {
      const jwks = getJWKS(opts.jwksUrl);
      result = await jwtVerify(token, jwks, verifyOptions);
    }
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new TokenExpiredError(err.message);
    }
    if (err instanceof joseErrors.JWTClaimValidationFailed) {
      if (err.claim === "aud") {
        throw new TokenAudienceError(err.message);
      }
      if (err.claim === "iss") {
        throw new TokenIssuerError(err.message);
      }
      throw new TokenInvalidError(err.message);
    }
    if (err instanceof Error) {
      throw new TokenInvalidError(err.message);
    }
    throw new TokenInvalidError("Token verification failed");
  }

  const payload = result.payload as JWTPayload;
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new TokenInvalidError("Token missing sub claim");
  }
  if (typeof payload.exp !== "number") {
    throw new TokenInvalidError("Token missing exp claim");
  }

  const verified: VerifiedPayload = {
    ...payload,
    sub: payload.sub,
    exp: payload.exp,
  };

  return {
    payload: verified,
    expiresAt: new Date(payload.exp * 1000),
  };
}

// Test helper — clear the JWKS cache between tests so a stale URL doesn't
// bleed across runs. Not exported from index.ts; kept for the package's
// own future test suite.
export function _clearJWKSCache(): void {
  jwksCache.clear();
}
