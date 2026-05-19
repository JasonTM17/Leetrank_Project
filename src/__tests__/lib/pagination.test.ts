import { describe, it, expect } from "vitest";
import { parseLimit, parsePage } from "@/lib/pagination";

describe("parseLimit", () => {
  it("returns the fallback when ?limit is missing", () => {
    const u = new URL("http://x/list");
    expect(parseLimit(u)).toBe(50);
  });

  it("returns the fallback when ?limit is non-numeric", () => {
    const u = new URL("http://x/list?limit=abc");
    expect(parseLimit(u)).toBe(50);
  });

  it("returns max when ?limit exceeds the cap", () => {
    const u = new URL("http://x/list?limit=999");
    expect(parseLimit(u, { max: 25 })).toBe(25);
  });

  it("falls back when ?limit is zero or negative (treated as missing)", () => {
    // parsed <= 0 returns Math.min(Math.max(1, fallback), max).
    // With default fallback=50, max=50 → 50.
    expect(parseLimit(new URL("http://x/list?limit=0"))).toBe(50);
    expect(parseLimit(new URL("http://x/list?limit=-5"))).toBe(50);
  });

  it("clamps a tiny fallback up to 1 when zero/negative limit is passed", () => {
    // fallback=0 → Math.max(1, 0)=1, then min(1, max=10)=1.
    expect(parseLimit(new URL("http://x/list?limit=-1"), { max: 10, fallback: 0 })).toBe(1);
  });

  it("respects an explicit fallback when limit is missing", () => {
    const u = new URL("http://x/list");
    expect(parseLimit(u, { max: 100, fallback: 10 })).toBe(10);
  });

  it("caps the fallback to max when fallback > max", () => {
    const u = new URL("http://x/list");
    // fallback 200, max 50 → returns 50 (capped)
    expect(parseLimit(u, { max: 50, fallback: 200 })).toBe(50);
  });

  it("passes through valid in-range values", () => {
    const u = new URL("http://x/list?limit=27");
    expect(parseLimit(u, { max: 100 })).toBe(27);
  });

  it("uses min(DEFAULT, max) as fallback when fallback omitted", () => {
    // DEFAULT_LIMIT=50, max=10 → fallback should resolve to 10
    const u = new URL("http://x/list");
    expect(parseLimit(u, { max: 10 })).toBe(10);
  });
});

describe("parsePage", () => {
  it("returns 1 when ?page is absent", () => {
    expect(parsePage(new URL("http://x/list"))).toBe(1);
  });

  it("returns 1 when ?page is non-numeric", () => {
    expect(parsePage(new URL("http://x/list?page=foo"))).toBe(1);
  });

  it("returns 1 when ?page is < 1", () => {
    expect(parsePage(new URL("http://x/list?page=0"))).toBe(1);
    expect(parsePage(new URL("http://x/list?page=-3"))).toBe(1);
  });

  it("returns the page number when valid", () => {
    expect(parsePage(new URL("http://x/list?page=7"))).toBe(7);
  });
});
