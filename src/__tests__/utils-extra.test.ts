import { describe, it, expect } from "vitest";
import { cn, formatDate, formatRelativeTime, getDifficultyColor, getDifficultyBg } from "@/lib/utils";

describe("cn (extra)", () => {
  it("handles deeply nested objects, last wins on conflict", () => {
    // text-sm + text-lg are conflicting Tailwind utilities; twMerge keeps the
    // last one. We're asserting the merge resolves the conflict, not just
    // string concatenation.
    expect(cn({ "p-2": true, "p-4": false }, ["text-sm", { "text-lg": true }])).toBe("p-2 text-lg");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("ignores undefined and null", () => {
    expect(cn(undefined, null, "a")).toBe("a");
  });
});

describe("formatRelativeTime edge cases", () => {
  it("handles future timestamps without throwing", () => {
    const future = new Date(Date.now() + 60_000);
    expect(() => formatRelativeTime(future)).not.toThrow();
  });

  it("clamps minutes at 59 when boundary is exact", () => {
    const t = new Date(Date.now() - 59 * 60_000);
    expect(formatRelativeTime(t)).toMatch(/^59m ago$/);
  });

  it("crosses into hours at 60 minutes", () => {
    const t = new Date(Date.now() - 60 * 60_000);
    expect(formatRelativeTime(t)).toMatch(/^1h ago$/);
  });
});

describe("getDifficultyColor / getDifficultyBg coverage", () => {
  it("ignores leading/trailing whitespace via inputs already trimmed", () => {
    // The helper does not trim — behaviour is documented as 'pass clean strings'
    // but we still want to know what the unknown branch returns in practice.
    expect(getDifficultyColor(" easy")).toContain("gray");
    expect(getDifficultyBg(" easy")).toContain("gray");
  });

  it("is case-insensitive for the three known levels", () => {
    expect(getDifficultyColor("EASY")).toBe(getDifficultyColor("easy"));
    expect(getDifficultyColor("Medium")).toBe(getDifficultyColor("medium"));
    expect(getDifficultyColor("HARD")).toBe(getDifficultyColor("hard"));
  });
});

describe("formatDate stable shape", () => {
  it("produces a string with the year", () => {
    expect(formatDate("2026-01-15")).toMatch(/2026/);
  });
});
