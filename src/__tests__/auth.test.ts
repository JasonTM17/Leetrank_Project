import { describe, it, expect, beforeEach } from "vitest";
import { signToken, verifyToken } from "@/lib/auth";

const ORIGINAL_SECRET = process.env.JWT_SECRET;

beforeEach(() => {
  process.env.JWT_SECRET = ORIGINAL_SECRET ?? "test-secret-32-chars-minimum-aaaa";
});

describe("auth tokens", () => {
  it("round-trips a signed payload", async () => {
    const token = await signToken({
      userId: "u1",
      email: "u1@example.com",
      username: "u1",
      role: "user",
    });
    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe("u1");
    expect(decoded?.email).toBe("u1@example.com");
    expect(decoded?.role).toBe("user");
  });

  it("rejects a tampered token", async () => {
    const token = await signToken({
      userId: "u1",
      email: "u1@example.com",
      username: "u1",
      role: "user",
    });
    const tampered = token.slice(0, -3) + "AAA";
    const decoded = await verifyToken(tampered);
    expect(decoded).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifyToken("not-a-jwt")).toBeNull();
    expect(await verifyToken("")).toBeNull();
    expect(await verifyToken("aaa.bbb.ccc")).toBeNull();
  });
});
