import { SignJWT, jwtVerify, createRemoteJWKSet, decodeProtectedHeader } from "jose";
import { cookies } from "next/headers";

function loadSecret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set to a 16+ character value in production");
    }
    return new TextEncoder().encode("dev-only-insecure-secret-change-me");
  }
  return new TextEncoder().encode(value);
}

const secret = loadSecret();

// JWKS verify path (Phase 1 of cutover — see docs/adr/0030-web-tier-jwt-cutover.md).
// Identity service publishes its asymmetric public keys at AUTH_JWKS_URL; we
// cache the remote set at module level so verification is a single network
// request per key-rotation interval. Falls back to HS256 only when the token
// header explicitly says HS256 AND LEGACY_HS256_FALLBACK is enabled — the
// fallback is on by default in development/test and off in production.
const JWKS_URL = process.env.AUTH_JWKS_URL ?? "http://identity:4011/.well-known/jwks.json";
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

function legacyFallbackEnabled(): boolean {
  if (process.env.LEGACY_HS256_FALLBACK === "true") return true;
  // Dev/test default: keep HS256 working so existing flows don't break before
  // the identity service is wired up. Production must opt in explicitly.
  return process.env.NODE_ENV !== "production";
}

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .setIssuedAt()
    .sign(secret);
}

/**
 * Verify a JWT against the identity-service JWKS first; only fall back to the
 * legacy HS256 secret if the token's `alg` header is HS256 AND the legacy
 * fallback is enabled (default in dev/test, opt-in via LEGACY_HS256_FALLBACK
 * in production). This is the entry point all session checks should use.
 */
export async function verifyTokenJwks(token: string): Promise<JWTPayload | null> {
  let header: { alg?: string };
  try {
    header = decodeProtectedHeader(token) as { alg?: string };
  } catch {
    return null;
  }

  if (header.alg && header.alg !== "HS256") {
    try {
      const { payload } = await jwtVerify(token, JWKS);
      return payload as unknown as JWTPayload;
    } catch {
      return null;
    }
  }

  if (!legacyFallbackEnabled()) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// Back-compat alias — existing callers keep working but now go through the
// JWKS-first path.
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  return verifyTokenJwks(token);
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyTokenJwks(token);
}
