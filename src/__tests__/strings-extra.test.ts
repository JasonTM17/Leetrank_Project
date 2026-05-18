import { describe, it, expect } from "vitest";
import { slugify, truncate, pluralize } from "@/lib/strings";

describe("slugify (extra)", () => {
  it("handles unicode emoji by stripping non-ascii", () => {
    expect(slugify("Hello 👋 World")).toBe("hello-world");
  });

  it("preserves digits", () => {
    expect(slugify("Problem 42 Easy")).toBe("problem-42-easy");
  });

  it("collapses underscores into a single dash", () => {
    expect(slugify("foo_bar___baz")).toBe("foo-bar-baz");
  });

  it("returns lowercase even when input is all caps", () => {
    expect(slugify("ALL CAPS NAME")).toBe("all-caps-name");
  });

  it("works on the empty string", () => {
    expect(slugify("")).toBe("");
  });
});

describe("truncate (extra)", () => {
  it("returns input unchanged when exactly at limit", () => {
    expect(truncate("12345", 5)).toBe("12345");
  });

  it("preserves the ellipsis as a single character (one codepoint)", () => {
    const out = truncate("hello world", 5);
    expect(out.endsWith("…")).toBe(true);
    // The ellipsis must be the unicode horizontal ellipsis, not three dots,
    // so screen readers narrate it as a single pause.
    expect(out.charCodeAt(out.length - 1)).toBe(8230);
  });
});

describe("pluralize (extra)", () => {
  it("handles negative counts (treats as not-1)", () => {
    expect(pluralize(-1, "problem")).toBe("-1 problems");
  });

  it("handles fractional counts (treats as not-1)", () => {
    expect(pluralize(1.5, "problem")).toBe("1.5 problems");
  });
});
