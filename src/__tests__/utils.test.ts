import { describe, it, expect } from "vitest";
import {
  cn,
  formatDate,
  formatRelativeTime,
  getDifficultyColor,
  getDifficultyBg,
} from "@/lib/utils";

describe("cn", () => {
  it("merges tailwind classes, last wins on conflict", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", false && "text-blue-500", "text-green-500")).toBe(
      "text-green-500"
    );
  });

  it("filters falsy values", () => {
    expect(cn("a", null, undefined, false, "b")).toBe("a b");
  });
});

describe("formatDate", () => {
  it("formats Date and ISO string consistently", () => {
    const iso = "2026-03-15T12:00:00Z";
    expect(formatDate(iso)).toMatch(/\d{4}/);
    expect(formatDate(new Date(iso))).toBe(formatDate(iso));
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for sub-minute deltas", () => {
    expect(formatRelativeTime(new Date())).toBe("just now");
  });

  it("falls through minutes/hours/days buckets", () => {
    const m5 = new Date(Date.now() - 5 * 60_000);
    const h2 = new Date(Date.now() - 2 * 3_600_000);
    const d3 = new Date(Date.now() - 3 * 86_400_000);
    expect(formatRelativeTime(m5)).toBe("5m ago");
    expect(formatRelativeTime(h2)).toBe("2h ago");
    expect(formatRelativeTime(d3)).toBe("3d ago");
  });

  it("falls back to formatDate after 30 days", () => {
    const old = new Date(Date.now() - 90 * 86_400_000);
    expect(formatRelativeTime(old)).toMatch(/\d{4}/);
  });
});

describe("getDifficultyColor / getDifficultyBg", () => {
  it("maps known difficulties", () => {
    expect(getDifficultyColor("easy")).toContain("green");
    expect(getDifficultyColor("Medium")).toContain("yellow");
    expect(getDifficultyColor("HARD")).toContain("red");
    expect(getDifficultyBg("easy")).toContain("green");
    expect(getDifficultyBg("hard")).toContain("red");
  });

  it("falls back to gray on unknown", () => {
    expect(getDifficultyColor("expert")).toContain("gray");
    expect(getDifficultyBg("???")).toContain("gray");
  });
});
