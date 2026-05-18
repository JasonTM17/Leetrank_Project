import { describe, it, expect } from "vitest";
import { LANGUAGE_BY_ID } from "@/lib/languages";

describe("language manifest extra coverage", () => {
  it("includes every category we ship", () => {
    const categories = new Set<string>();
    for (const lang of LANGUAGE_BY_ID.values()) {
      categories.add(lang.category);
    }
    expect(categories.has("scripting")).toBe(true);
    expect(categories.has("compiled")).toBe(true);
    expect(categories.has("jvm")).toBe(true);
    expect(categories.has("functional")).toBe(true);
    expect(categories.has("data")).toBe(true);
    expect(categories.has("esoteric")).toBe(true);
  });

  it("each language declares a non-empty extension starting with a dot", () => {
    for (const lang of LANGUAGE_BY_ID.values()) {
      expect(lang.extension.startsWith(".")).toBe(true);
      expect(lang.extension.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("each language has a unique extension", () => {
    const exts = [...LANGUAGE_BY_ID.values()].map((l) => l.extension);
    expect(new Set(exts).size).toBe(exts.length);
  });

  it("monaco language ids are URL-safe lower-case ascii", () => {
    for (const lang of LANGUAGE_BY_ID.values()) {
      expect(lang.monacoLanguage).toMatch(/^[a-z]+$/);
    }
  });
});
