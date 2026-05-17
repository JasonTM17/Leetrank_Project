import { describe, it, expect } from "vitest";
import { slugify, truncate, pluralize } from "@/lib/strings";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with dashes", () => {
    expect(slugify("Two Sum!")).toBe("two-sum");
  });

  it("strips diacritics", () => {
    expect(slugify("Café résumé")).toBe("cafe-resume");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("  --hello world--")).toBe("hello-world");
  });

  it("collapses runs of separators", () => {
    expect(slugify("a/b\\c")).toBe("a-b-c");
  });

  it("returns empty string for an all-symbol input", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("caps length at 200", () => {
    const long = "a".repeat(300);
    expect(slugify(long).length).toBeLessThanOrEqual(200);
  });
});

describe("truncate", () => {
  it("returns input unchanged when within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("cuts at the last space when one is reasonably close", () => {
    expect(truncate("hello world friends", 12)).toBe("hello world…");
  });

  it("hard-cuts when no good word boundary exists", () => {
    expect(truncate("supercalifragilistic", 8)).toBe("supercal…");
  });
});

describe("pluralize", () => {
  it("uses singular for count=1", () => {
    expect(pluralize(1, "problem")).toBe("1 problem");
  });

  it("appends s for non-1 counts by default", () => {
    expect(pluralize(0, "problem")).toBe("0 problems");
    expect(pluralize(3, "submission")).toBe("3 submissions");
  });

  it("uses the explicit plural when provided", () => {
    expect(pluralize(2, "person", "people")).toBe("2 people");
  });
});
