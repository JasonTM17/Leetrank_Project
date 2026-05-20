import { describe, it, expect } from "vitest";
import {
  generateCsrfToken,
  isCsrfSafeMethod,
  verifyCsrfDoubleSubmit,
  verifyOrigin,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_NAME,
} from "@/lib/csrf";

describe("generateCsrfToken", () => {
  it("returns a 43-character base64url string", () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns unique tokens on successive calls", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });
});

describe("isCsrfSafeMethod", () => {
  it.each(["GET", "HEAD", "OPTIONS"])("returns true for %s", (method) => {
    expect(isCsrfSafeMethod(method)).toBe(true);
  });

  it.each(["get", "head", "options"])("returns true for lowercase %s", (method) => {
    expect(isCsrfSafeMethod(method)).toBe(true);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("returns false for %s", (method) => {
    expect(isCsrfSafeMethod(method)).toBe(false);
  });
});

describe("verifyCsrfDoubleSubmit", () => {
  it("returns true when header and cookie tokens match", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfDoubleSubmit(token, token)).toBe(true);
  });

  it("returns false when tokens differ", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(verifyCsrfDoubleSubmit(a, b)).toBe(false);
  });

  it("returns false when header token is null", () => {
    expect(verifyCsrfDoubleSubmit(null, "abc")).toBe(false);
  });

  it("returns false when cookie token is null", () => {
    expect(verifyCsrfDoubleSubmit("abc", null)).toBe(false);
  });

  it("returns false when both are null", () => {
    expect(verifyCsrfDoubleSubmit(null, null)).toBe(false);
  });

  it("returns false when tokens have different lengths", () => {
    expect(verifyCsrfDoubleSubmit("short", "muchlongertoken")).toBe(false);
  });
});

describe("verifyOrigin", () => {
  const allowed = ["https://leetrank.io", "http://localhost:3000"];

  it("returns true when origin is in allowedOrigins", () => {
    expect(verifyOrigin("https://leetrank.io", null, allowed)).toBe(true);
  });

  it("returns true when origin host matches host param", () => {
    expect(verifyOrigin("https://example.com:8443/path", "example.com:8443", [])).toBe(true);
  });

  it("returns false when origin is null", () => {
    expect(verifyOrigin(null, "leetrank.io", allowed)).toBe(false);
  });

  it("returns false when origin does not match allowed or host", () => {
    expect(verifyOrigin("https://evil.com", "leetrank.io", allowed)).toBe(false);
  });

  it("returns false for malformed origin", () => {
    expect(verifyOrigin("not-a-url", "leetrank.io", allowed)).toBe(false);
  });

  it("returns true for localhost in allowed list", () => {
    expect(verifyOrigin("http://localhost:3000/some/path", null, allowed)).toBe(true);
  });
});

describe("exported constants", () => {
  it("CSRF_HEADER_NAME is x-csrf-token", () => {
    expect(CSRF_HEADER_NAME).toBe("x-csrf-token");
  });

  it("CSRF_COOKIE_NAME is csrf-token", () => {
    expect(CSRF_COOKIE_NAME).toBe("csrf-token");
  });
});
