// Frontend mirror of judge-service/languages.json. Keeps the Monaco editor
// and the language dropdown in sync with what the judge actually accepts.
// Runtime mismatch between the two would leave users staring at a "language
// X not supported" error from the API. Edit both files together.
//
// Today the Go judge only handles python, javascript, ruby, and go end-to-end.
// The previous list of 15 languages was aspirational — selecting any of the
// other 11 in the editor produced an "Unsupported language" error from the
// judge. The languages.go registry scaffold is staged to drive a wider
// language set without hard-coding the switch in main.go.

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
  { id: "ruby", label: "Ruby", extension: ".rb", monacoLanguage: "ruby", category: "scripting" },
  { id: "go", label: "Go", extension: ".go", monacoLanguage: "go", category: "compiled" },
];

export const LANGUAGE_BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id);

export function languageLabel(id: string): string {
  return LANGUAGE_BY_ID.get(id)?.label ?? id;
}

export function monacoLanguageFor(id: string): string {
  return LANGUAGE_BY_ID.get(id)?.monacoLanguage ?? "plaintext";
}
