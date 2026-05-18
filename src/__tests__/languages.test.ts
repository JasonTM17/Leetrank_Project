import { describe, it, expect } from "vitest";
import { LANGUAGES, LANGUAGE_BY_ID, LANGUAGE_IDS, languageLabel, monacoLanguageFor } from "@/lib/languages";

describe("language manifest", () => {
  it("exposes the languages the judge actually accepts", () => {
    // Source of truth lives in judge-service/languages.json; this list
    // must match. Adding a language without updating both files puts us
    // back in the "Unsupported language" UX hole.
    expect(LANGUAGES.map((l) => l.id).sort()).toEqual([
      "awk",
      "bash",
      "c",
      "clojure",
      "cpp",
      "csharp",
      "d",
      "elixir",
      "erlang",
      "fortran",
      "fsharp",
      "go",
      "groovy",
      "haskell",
      "java",
      "javascript",
      "julia",
      "kotlin",
      "lua",
      "nim",
      "ocaml",
      "pascal",
      "perl",
      "php",
      "python",
      "r",
      "racket",
      "ruby",
      "rust",
      "sbcl",
      "scala",
      "sql",
      "tcl",
      "typescript",
    ]);
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
    expect(languageLabel("haskell")).toBe("Haskell");
  });

  it("languageLabel falls back to the raw id for unknowns", () => {
    expect(languageLabel("brainfuck")).toBe("brainfuck");
  });

  it("monacoLanguageFor maps to the Monaco mode", () => {
    expect(monacoLanguageFor("typescript")).toBe("typescript");
    expect(monacoLanguageFor("haskell")).toBe("haskell");
  });

  it("monacoLanguageFor falls back to plaintext for unknowns", () => {
    expect(monacoLanguageFor("brainfuck")).toBe("plaintext");
  });

  it("each language declares a non-empty extension and label", () => {
    for (const lang of LANGUAGES) {
      expect(lang.extension.length).toBeGreaterThan(0);
      expect(lang.label.length).toBeGreaterThan(0);
    }
  });
});
