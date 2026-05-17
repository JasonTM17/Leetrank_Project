import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, _resetRateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => _resetRateLimit());

  it("allows up to max requests within the window", () => {
    for (let i = 0; i < 5; i++) {
      const r = rateLimit("k1", 5, 60_000);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(5 - 1 - i);
    }
    const r = rateLimit("k1", 5, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("isolates buckets per key", () => {
    rateLimit("a", 1, 60_000);
    const second = rateLimit("a", 1, 60_000);
    expect(second.allowed).toBe(false);

    const otherKey = rateLimit("b", 1, 60_000);
    expect(otherKey.allowed).toBe(true);
  });

  it("resets the bucket once the window elapses", async () => {
    const r1 = rateLimit("k", 1, 5);
    expect(r1.allowed).toBe(true);
    const r2 = rateLimit("k", 1, 5);
    expect(r2.allowed).toBe(false);

    await new Promise((r) => setTimeout(r, 12));
    const r3 = rateLimit("k", 1, 5);
    expect(r3.allowed).toBe(true);
  });

  it("returns a future resetAt timestamp", () => {
    const r = rateLimit("rk", 3, 1000);
    expect(r.resetAt).toBeGreaterThan(Date.now());
  });
});
