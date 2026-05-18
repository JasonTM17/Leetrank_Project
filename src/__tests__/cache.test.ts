import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TTLCache } from "@/lib/cache";

describe("TTLCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for missing keys and counts as a miss", () => {
    const c = new TTLCache<number>(10);
    expect(c.get("missing")).toBeUndefined();
    expect(c.stats().misses).toBe(1);
    expect(c.stats().hits).toBe(0);
  });

  it("returns a fresh value and counts as a hit", () => {
    const c = new TTLCache<number>(10);
    c.set("a", 1, 1000);
    expect(c.get("a")).toBe(1);
    expect(c.stats().hits).toBe(1);
  });

  it("treats an expired entry as a miss and removes it", () => {
    const c = new TTLCache<number>(10);
    c.set("a", 1, 1000);
    vi.advanceTimersByTime(1500);
    expect(c.get("a")).toBeUndefined();
    expect(c.stats().size).toBe(0);
    expect(c.stats().misses).toBe(1);
  });

  it("evicts the oldest entry when the cap is hit", () => {
    const c = new TTLCache<number>(2);
    c.set("a", 1, 60_000);
    c.set("b", 2, 60_000);
    c.set("c", 3, 60_000);
    expect(c.get("a")).toBeUndefined(); // evicted
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
  });

  it("bumps LRU order on get", () => {
    const c = new TTLCache<number>(2);
    c.set("a", 1, 60_000);
    c.set("b", 2, 60_000);
    c.get("a"); // a becomes most-recently-used
    c.set("c", 3, 60_000); // should evict b, not a
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
  });

  it("delete removes the entry", () => {
    const c = new TTLCache<number>(10);
    c.set("a", 1, 1000);
    c.delete("a");
    expect(c.get("a")).toBeUndefined();
  });

  it("clear empties stats and entries", () => {
    const c = new TTLCache<number>(10);
    c.set("a", 1, 1000);
    c.get("a");
    c.clear();
    expect(c.stats().size).toBe(0);
    expect(c.stats().hits).toBe(0);
    expect(c.stats().misses).toBe(0);
  });

  it("hitRate reports 0 with no traffic and the right ratio after", () => {
    const c = new TTLCache<number>(10);
    expect(c.stats().hitRate).toBe(0);
    c.set("a", 1, 1000);
    c.get("a"); // hit
    c.get("b"); // miss
    expect(c.stats().hitRate).toBeCloseTo(0.5);
  });

  it("remember dedupes concurrent loader calls (single-flight)", async () => {
    const c = new TTLCache<number>(10);
    const loader = vi.fn().mockResolvedValue(42);

    const [a, b, d] = await Promise.all([
      c.remember("k", 1000, loader),
      c.remember("k", 1000, loader),
      c.remember("k", 1000, loader),
    ]);

    expect([a, b, d]).toEqual([42, 42, 42]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("remember returns the cached value on subsequent calls without invoking loader", async () => {
    const c = new TTLCache<number>(10);
    const loader = vi.fn().mockResolvedValue(7);

    expect(await c.remember("k", 1000, loader)).toBe(7);
    expect(await c.remember("k", 1000, loader)).toBe(7);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("remember releases the inflight slot if the loader rejects", async () => {
    const c = new TTLCache<number>(10);
    const loader = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(99);

    await expect(c.remember("k", 1000, loader)).rejects.toThrow("boom");
    expect(c.stats().inflight).toBe(0);
    // Next call should retry, not be stuck on the prior failure.
    expect(await c.remember("k", 1000, loader)).toBe(99);
  });
});
