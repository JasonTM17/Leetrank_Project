// Frontend mirror of judge-service/languages.json. Keeps the Monaco editor
// and the language dropdown in sync with what the judge actually accepts.
// Runtime mismatch between the two would leave users staring at a "language
// X not supported" error from the API. Edit both files together.

export interface LanguageDef {
  id: string;
  label: string;
  extension: string;
  monacoLanguage: string;
  category: "scripting" | "compiled" | "jvm" | "data";
}

export const LANGUAGES: LanguageDef[] = [
  { id: "python", label: "Python 3", extension: ".py", monacoLanguage: "python", category: "scripting" },
  { id: "javascript", label: "JavaScript (Node)", extension: ".js", monacoLanguage: "javascript", category: "scripting" },
  { id: "typescript", label: "TypeScript", extension: ".ts", monacoLanguage: "typescript", category: "scripting" },
  { id: "ruby", label: "Ruby", extension: ".rb", monacoLanguage: "ruby", category: "scripting" },
  { id: "php", label: "PHP", extension: ".php", monacoLanguage: "php", category: "scripting" },
  { id: "bash", label: "Bash", extension: ".sh", monacoLanguage: "shell", category: "scripting" },
  { id: "go", label: "Go", extension: ".go", monacoLanguage: "go", category: "compiled" },
  { id: "rust", label: "Rust", extension: ".rs", monacoLanguage: "rust", category: "compiled" },
  { id: "c", label: "C (gcc)", extension: ".c", monacoLanguage: "c", category: "compiled" },
  { id: "cpp", label: "C++ (g++)", extension: ".cpp", monacoLanguage: "cpp", category: "compiled" },
  { id: "java", label: "Java", extension: ".java", monacoLanguage: "java", category: "jvm" },
  { id: "sql", label: "SQL (sqlite)", extension: ".sql", monacoLanguage: "sql", category: "data" },
];

export const LANGUAGE_BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id);

export function languageLabel(id: string): string {
  return LANGUAGE_BY_ID.get(id)?.label ?? id;
}

export function monacoLanguageFor(id: string): string {
  return LANGUAGE_BY_ID.get(id)?.monacoLanguage ?? "plaintext";
}
