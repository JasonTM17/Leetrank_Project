import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, createRemoteJWKSet, decodeProtectedHeader } from "jose";

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

// JWKS cutover — see docs/adr/0030-web-tier-jwt-cutover.md. Verify against the
// identity service's JWKS first; only fall back to HS256 when the token header
// explicitly says HS256 AND legacy fallback is enabled.
const JWKS_URL = process.env.AUTH_JWKS_URL ?? "http://identity:4011/.well-known/jwks.json";
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

function legacyFallbackEnabled(): boolean {
  if (process.env.LEGACY_HS256_FALLBACK === "true") return true;
  return process.env.NODE_ENV !== "production";
}

async function verifyAny(token: string) {
  let header: { alg?: string };
  try {
    header = decodeProtectedHeader(token) as { alg?: string };
  } catch {
    return null;
  }
  if (header.alg && header.alg !== "HS256") {
    try {
      return await jwtVerify(token, JWKS);
    } catch {
      return null;
    }
  }
  if (!legacyFallbackEnabled()) return null;
  try {
    return await jwtVerify(token, secret);
  } catch {
    return null;
  }
}

const protectedRoutes = ["/dashboard", "/admin"];
const adminRoutes = ["/admin"];

// CORS policy (Bug #26): /api is intentionally first-party-only. We DO NOT
// emit Access-Control-Allow-* headers, so cross-origin browsers preflighting
// OPTIONS get an opaque 204 and the browser refuses to send the real request.
// That's the desired behaviour — the API has cookie auth and no public
// integration story yet. If we later need third-party clients (e.g. a public
// SDK), gate Allow-Origin on an explicit allowlist here, never `*` (would
// break credentialed cookies anyway).
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const verified = await verifyAny(token);
  if (!verified) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isAdmin = adminRoutes.some((route) => pathname.startsWith(route));
  if (isAdmin && verified.payload.role !== "admin") {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
