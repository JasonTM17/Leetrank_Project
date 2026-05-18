// Frontend mirror of judge-service/languages.json. Keeps the Monaco editor
// and the language dropdown in sync with what the judge actually accepts.
// Runtime mismatch between the two would leave users staring at a "language
// X not supported" error from the API. Edit both files together.

export interface LanguageDef {
  id: string;
  label: string;
  extension: string;
  monacoLanguage: string;
  // "scripting"  — interpreted dynamic languages (python, ruby, lua, ...)
  // "compiled"   — produce a native binary (c, cpp, rust, go, d, pascal, ...)
  // "jvm"        — emit JVM bytecode (java, kotlin, scala, groovy, clojure)
  // "functional" — primarily functional, often with their own runtime (haskell,
  //                ocaml, racket, sbcl, erlang, fsharp)
  // "data"       — query / numeric / DSL languages (sql, r, julia, octave)
  // "esoteric"   — niche / historical (forth, awk, sed, tcl)
  category: "scripting" | "compiled" | "jvm" | "functional" | "data" | "esoteric";
}

export const LANGUAGES: LanguageDef[] = [
  // ── Scripting ──────────────────────────────────────────────────────────────
  { id: "python", label: "Python 3", extension: ".py", monacoLanguage: "python", category: "scripting" },
  { id: "javascript", label: "JavaScript (Node)", extension: ".js", monacoLanguage: "javascript", category: "scripting" },
  { id: "typescript", label: "TypeScript", extension: ".ts", monacoLanguage: "typescript", category: "scripting" },
  { id: "ruby", label: "Ruby", extension: ".rb", monacoLanguage: "ruby", category: "scripting" },
  { id: "php", label: "PHP", extension: ".php", monacoLanguage: "php", category: "scripting" },
  { id: "bash", label: "Bash", extension: ".sh", monacoLanguage: "shell", category: "scripting" },
  { id: "lua", label: "Lua", extension: ".lua", monacoLanguage: "lua", category: "scripting" },
  { id: "perl", label: "Perl", extension: ".pl", monacoLanguage: "perl", category: "scripting" },
  { id: "elixir", label: "Elixir", extension: ".ex", monacoLanguage: "elixir", category: "scripting" },

  // ── Compiled (native) ──────────────────────────────────────────────────────
  { id: "go", label: "Go", extension: ".go", monacoLanguage: "go", category: "compiled" },
  { id: "rust", label: "Rust", extension: ".rs", monacoLanguage: "rust", category: "compiled" },
  { id: "c", label: "C (gcc)", extension: ".c", monacoLanguage: "c", category: "compiled" },
  { id: "cpp", label: "C++ (g++)", extension: ".cpp", monacoLanguage: "cpp", category: "compiled" },
  { id: "csharp", label: "C# (Mono)", extension: ".cs", monacoLanguage: "csharp", category: "compiled" },
  { id: "d", label: "D (gdc)", extension: ".d", monacoLanguage: "d", category: "compiled" },
  { id: "pascal", label: "Pascal (fpc)", extension: ".pas", monacoLanguage: "pascal", category: "compiled" },
  { id: "nim", label: "Nim", extension: ".nim", monacoLanguage: "nim", category: "compiled" },
  { id: "fortran", label: "Fortran (gfortran)", extension: ".f90", monacoLanguage: "fortran", category: "compiled" },

  // ── JVM ────────────────────────────────────────────────────────────────────
  { id: "java", label: "Java", extension: ".java", monacoLanguage: "java", category: "jvm" },
  { id: "kotlin", label: "Kotlin", extension: ".kt", monacoLanguage: "kotlin", category: "jvm" },
  { id: "scala", label: "Scala", extension: ".scala", monacoLanguage: "scala", category: "jvm" },
  { id: "groovy", label: "Groovy", extension: ".groovy", monacoLanguage: "groovy", category: "jvm" },
  { id: "clojure", label: "Clojure", extension: ".clj", monacoLanguage: "clojure", category: "jvm" },

  // ── Functional ─────────────────────────────────────────────────────────────
  { id: "haskell", label: "Haskell", extension: ".hs", monacoLanguage: "haskell", category: "functional" },
  { id: "ocaml", label: "OCaml", extension: ".ml", monacoLanguage: "ocaml", category: "functional" },
  { id: "racket", label: "Racket", extension: ".rkt", monacoLanguage: "racket", category: "functional" },
  { id: "sbcl", label: "Common Lisp (SBCL)", extension: ".lisp", monacoLanguage: "lisp", category: "functional" },
  { id: "erlang", label: "Erlang", extension: ".erl", monacoLanguage: "erlang", category: "functional" },
  { id: "fsharp", label: "F# (Mono)", extension: ".fsx", monacoLanguage: "fsharp", category: "functional" },

  // ── Data / numeric ─────────────────────────────────────────────────────────
  { id: "sql", label: "SQL (sqlite)", extension: ".sql", monacoLanguage: "sql", category: "data" },
  { id: "r", label: "R", extension: ".r", monacoLanguage: "r", category: "data" },
  { id: "julia", label: "Julia", extension: ".jl", monacoLanguage: "julia", category: "data" },

  // ── Esoteric / classic Unix ────────────────────────────────────────────────
  { id: "tcl", label: "Tcl", extension: ".tcl", monacoLanguage: "tcl", category: "esoteric" },
  { id: "awk", label: "AWK (gawk)", extension: ".awk", monacoLanguage: "plaintext", category: "esoteric" },
];

export const LANGUAGE_BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id);

export function languageLabel(id: string): string {
  return LANGUAGE_BY_ID.get(id)?.label ?? id;
}

export function monacoLanguageFor(id: string): string {
  return LANGUAGE_BY_ID.get(id)?.monacoLanguage ?? "plaintext";
}
