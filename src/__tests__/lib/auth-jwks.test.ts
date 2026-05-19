import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SignJWT } from "jose";
import { signToken, verifyTokenJwks, verifyToken } from "@/lib/auth";

const SECRET = new TextEncoder().encode("test-secret-32-chars-minimum-aaaa");

async function signHs256(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(SECRET);
}

describe("auth — JWKS verify path branches", () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-32-chars-minimum-aaaa";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("returns null when token is malformed (decodeProtectedHeader throws)", async () => {
    expect(await verifyTokenJwks("not.a.token")).toBeNull();
    expect(await verifyToken("garbage")).toBeNull();
  });

  it("returns null when alg=HS256 but legacy fallback disabled in production", async () => {
    const token = await signHs256({ userId: "u1", email: "u@x.c", username: "u", role: "user" });
    process.env.NODE_ENV = "production";
    process.env.LEGACY_HS256_FALLBACK = "false";
    expect(await verifyTokenJwks(token)).toBeNull();
  });

  it("verifies HS256 token via legacy fallback in non-production", async () => {
    const token = await signToken({ userId: "u1", email: "u@x.c", username: "u", role: "user" });
    process.env.NODE_ENV = "test";
    delete process.env.LEGACY_HS256_FALLBACK;
    const payload = await verifyTokenJwks(token);
    expect(payload?.userId).toBe("u1");
    expect(payload?.email).toBe("u@x.c");
  });

  it("verifies HS256 token when LEGACY_HS256_FALLBACK=true even in production", async () => {
    const token = await signToken({ userId: "u2", email: "u2@x.c", username: "u2", role: "admin" });
    process.env.NODE_ENV = "production";
    process.env.LEGACY_HS256_FALLBACK = "true";
    const payload = await verifyTokenJwks(token);
    expect(payload?.userId).toBe("u2");
    expect(payload?.role).toBe("admin");
  });

  it("rejects an HS256 token signed with a different secret", async () => {
    const otherSecret = new TextEncoder().encode("a-totally-different-secret-key-aa");
    const bad = await new SignJWT({ userId: "u" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(otherSecret);
    expect(await verifyTokenJwks(bad)).toBeNull();
  });

  it("returns null when JWKS verification fails (non-HS256 alg)", async () => {
    // Token with alg=none-style header bypass attempt — jose rejects.
    // gitleaks:allow — test fixture, signature is literal "invalid-sig"
    const token = "eyJhbGciOiJSUzI1NiJ9.eyJ1c2VySWQiOiJ4In0.invalid-sig";
    const result = await verifyTokenJwks(token);
    expect(result).toBeNull();
  });
});
