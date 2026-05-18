import { describe, it, expect } from "vitest";
import { LANGUAGES, LANGUAGE_BY_ID, LANGUAGE_IDS, languageLabel, monacoLanguageFor } from "@/lib/languages";

describe("language manifest", () => {
  it("exposes the languages the judge actually accepts", () => {
    // The Go judge currently handles python, javascript, ruby, and go.
    // Adding more here without a runner + Dockerfile install + main.go
    // entry would put us back in the "Unsupported language" UX hole.
    expect(LANGUAGES.map((l) => l.id).sort()).toEqual(
      ["go", "javascript", "python", "ruby"]
    );
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
    expect(languageLabel("go")).toBe("Go");
  });

  it("languageLabel falls back to the raw id for unknowns", () => {
    expect(languageLabel("haskell")).toBe("haskell");
  });

  it("monacoLanguageFor maps to the Monaco mode", () => {
    expect(monacoLanguageFor("javascript")).toBe("javascript");
    expect(monacoLanguageFor("ruby")).toBe("ruby");
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
