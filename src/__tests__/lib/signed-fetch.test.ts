import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { signedFetch, verifySignature } from "@/lib/signed-fetch";

describe("signedFetch", () => {
  it("throws if secret is empty", async () => {
    await expect(
      signedFetch({ url: "http://localhost", body: { a: 1 }, secret: "" })
    ).rejects.toThrow("signed-fetch: secret is required (fail-closed)");
  });
});

describe("verifySignature", () => {
  const secret = "test-secret-key-1234";
  const body = JSON.stringify({ event: "test", data: 42 });

  it("returns true for a valid signature", () => {
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifySignature(body, sig, secret)).toBe(true);
  });

  it("returns false for an invalid signature", () => {
    const badSig = createHmac("sha256", "wrong-secret").update(body).digest("hex");
    expect(verifySignature(body, badSig, secret)).toBe(false);
  });

  it("returns false for an empty signature", () => {
    expect(verifySignature(body, "", secret)).toBe(false);
  });

  it("returns false for mismatched length signature", () => {
    expect(verifySignature(body, "abc123", secret)).toBe(false);
  });
});
