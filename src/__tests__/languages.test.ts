import { describe, it, expect } from "vitest";
import { LANGUAGES, LANGUAGE_BY_ID, LANGUAGE_IDS, languageLabel, monacoLanguageFor } from "@/lib/languages";

describe("language manifest", () => {
  it("exposes 15 languages", () => {
    expect(LANGUAGES).toHaveLength(15);
  });

  it("every language has a unique id", () => {
    const ids = LANGUAGES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("LANGUAGE_BY_ID maps every id back to its entry", () => {
    for (const lang of LANGUAGES) {
      expect(LANGUAGE_BY_ID.get(lang.id)).toEqual(lang);
    }
  });

  it("LANGUAGE_IDS is the same length as LANGUAGES", () => {
    expect(LANGUAGE_IDS).toHaveLength(LANGUAGES.length);
  });

  it("languageLabel returns the human-readable label", () => {
    expect(languageLabel("python")).toBe("Python 3");
    expect(languageLabel("cpp")).toBe("C++ (g++)");
  });

  it("languageLabel falls back to the raw id for unknowns", () => {
    expect(languageLabel("haskell")).toBe("haskell");
  });

  it("monacoLanguageFor maps to the Monaco mode", () => {
    expect(monacoLanguageFor("typescript")).toBe("typescript");
    expect(monacoLanguageFor("kotlin")).toBe("kotlin");
  });

  it("monacoLanguageFor falls back to plaintext for unknowns", () => {
    expect(monacoLanguageFor("haskell")).toBe("plaintext");
  });

  it("each language declares a non-empty extension and label", () => {
    for (const lang of LANGUAGES) {
      expect(lang.extension.length).toBeGreaterThan(0);
      expect(lang.label.length).toBeGreaterThan(0);
    }
  });
});
