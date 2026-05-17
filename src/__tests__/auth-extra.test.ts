import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "@/lib/auth";

describe("auth (extra)", () => {
  it("preserves all four payload fields through the round trip", async () => {
    const token = await signToken({
      userId: "u-1",
      email: "u1@example.com",
      username: "u1",
      role: "admin",
    });
    const decoded = await verifyToken(token);
    expect(decoded?.userId).toBe("u-1");
    expect(decoded?.email).toBe("u1@example.com");
    expect(decoded?.username).toBe("u1");
    expect(decoded?.role).toBe("admin");
  });

  it("issues different tokens for different payloads", async () => {
    const a = await signToken({ userId: "a", email: "a@x.c", username: "a", role: "user" });
    const b = await signToken({ userId: "b", email: "b@x.c", username: "b", role: "user" });
    expect(a).not.toBe(b);
  });

  it("issues a token of the JWT shape (three dot-separated segments)", async () => {
    const token = await signToken({ userId: "u", email: "u@x.c", username: "u", role: "user" });
    expect(token.split(".")).toHaveLength(3);
  });

  it("rejects a wrong-shape token without throwing", async () => {
    expect(await verifyToken("only-one-segment")).toBeNull();
    expect(await verifyToken("two.segments")).toBeNull();
  });
});
