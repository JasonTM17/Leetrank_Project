import { randomBytes, timingSafeEqual } from "node:crypto";

const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isCsrfSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

export function verifyCsrfDoubleSubmit(
  headerToken: string | null,
  cookieToken: string | null
): boolean {
  if (!headerToken || !cookieToken) return false;
  if (headerToken.length !== cookieToken.length) return false;
  try {
    return timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken));
  } catch {
    return false;
  }
}

export function verifyOrigin(
  origin: string | null,
  host: string | null,
  allowedOrigins: string[]
): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (allowedOrigins.includes(u.origin)) return true;
    if (host && u.host === host) return true;
    return false;
  } catch {
    return false;
  }
}

export const CSRF_HEADER_NAME = CSRF_HEADER;
export const CSRF_COOKIE_NAME = CSRF_COOKIE;
