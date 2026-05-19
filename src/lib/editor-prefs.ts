/**
 * Editor preference schema + localStorage codec.
 *
 * Persists to `leetrank.editor.prefs`. Lives in `src/lib` so both the
 * client hook and any server-rendered pages can `import` types without
 * pulling in `useState`. Schema is intentionally narrow — adding a new
 * key means bumping defaults *and* widening the parse guard, so callers
 * can safely render unsupported old payloads.
 */
export const EDITOR_PREFS_KEY = "leetrank.editor.prefs";

export type EditorTheme = "vs-dark" | "vs" | "hc-black";

export interface EditorPrefs {
  /** Toggles monaco-vim. False = native Monaco keybindings. */
  vimMode: boolean;
  /** Monaco theme id. We restrict to the trio LeetCode exposes. */
  theme: EditorTheme;
  /** Editor font size in px. UI clamps to 12..22. */
  fontSize: number;
  /** Spaces per tab. Two values matches LeetCode premium toggle. */
  tabWidth: 2 | 4;
  /** Soft-wrap long lines vs horizontal scroll. */
  wordWrap: boolean;
}

export const DEFAULT_EDITOR_PREFS: EditorPrefs = {
  vimMode: false,
  theme: "vs-dark",
  fontSize: 14,
  tabWidth: 2,
  wordWrap: false,
};

/** Bounds the popover slider exposes — also enforced on parse. */
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 22;

const VALID_THEMES: ReadonlySet<EditorTheme> = new Set([
  "vs-dark",
  "vs",
  "hc-black",
]);

/**
 * Sanitize a parsed JSON blob into a usable {@link EditorPrefs}.
 * Unknown keys are dropped. Invalid values fall back to defaults so a
 * single corrupt entry never bricks the editor surface.
 */
export function normalizeEditorPrefs(raw: unknown): EditorPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EDITOR_PREFS };
  const r = raw as Record<string, unknown>;

  const theme: EditorTheme =
    typeof r.theme === "string" && VALID_THEMES.has(r.theme as EditorTheme)
      ? (r.theme as EditorTheme)
      : DEFAULT_EDITOR_PREFS.theme;

  const fontSizeRaw = typeof r.fontSize === "number" ? r.fontSize : NaN;
  const fontSize = Number.isFinite(fontSizeRaw)
    ? Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(fontSizeRaw)))
    : DEFAULT_EDITOR_PREFS.fontSize;

  const tabWidth: 2 | 4 = r.tabWidth === 4 ? 4 : 2;

  return {
    vimMode: r.vimMode === true,
    theme,
    fontSize,
    tabWidth,
    wordWrap: r.wordWrap === true,
  };
}

/**
 * Read prefs from `localStorage`. Safe on the server (returns defaults
 * when `window` is undefined) and tolerant of malformed JSON so a
 * partially-written entry never throws during render.
 */
export function readEditorPrefs(): EditorPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_EDITOR_PREFS };
  try {
    const raw = window.localStorage.getItem(EDITOR_PREFS_KEY);
    if (!raw) return { ...DEFAULT_EDITOR_PREFS };
    return normalizeEditorPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_EDITOR_PREFS };
  }
}

/**
 * Persist the full prefs object. Failures (quota exceeded, private
 * mode) are swallowed — the in-memory state is still correct, and the
 * next successful write will catch up.
 */
export function writeEditorPrefs(prefs: EditorPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage quotas / privacy modes — not fatal.
  }
}
