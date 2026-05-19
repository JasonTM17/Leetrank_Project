import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_EDITOR_PREFS,
  EDITOR_PREFS_KEY,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  normalizeEditorPrefs,
  readEditorPrefs,
  writeEditorPrefs,
  type EditorPrefs,
} from "@/lib/editor-prefs";

/**
 * Lightweight in-memory localStorage so we can drive the codec without
 * pulling jsdom into the node-environment test config. Mirrors the
 * subset of the Storage API the codec actually touches.
 */
function makeStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    get size() {
      return store.size;
    },
    raw: store,
  };
}

describe("normalizeEditorPrefs", () => {
  it("returns defaults for null/undefined/non-object input", () => {
    expect(normalizeEditorPrefs(null)).toEqual(DEFAULT_EDITOR_PREFS);
    expect(normalizeEditorPrefs(undefined)).toEqual(DEFAULT_EDITOR_PREFS);
    expect(normalizeEditorPrefs(42 as unknown)).toEqual(DEFAULT_EDITOR_PREFS);
    expect(normalizeEditorPrefs("oops" as unknown)).toEqual(DEFAULT_EDITOR_PREFS);
  });

  it("preserves a valid full payload", () => {
    const input: EditorPrefs = {
      vimMode: true,
      theme: "vs",
      fontSize: 18,
      tabWidth: 4,
      wordWrap: true,
    };
    expect(normalizeEditorPrefs(input)).toEqual(input);
  });

  it("falls back to default theme when value is unknown", () => {
    const out = normalizeEditorPrefs({ theme: "solarized" });
    expect(out.theme).toBe(DEFAULT_EDITOR_PREFS.theme);
  });

  it("clamps fontSize into the [12, 22] range and rounds floats", () => {
    expect(normalizeEditorPrefs({ fontSize: 4 }).fontSize).toBe(FONT_SIZE_MIN);
    expect(normalizeEditorPrefs({ fontSize: 99 }).fontSize).toBe(FONT_SIZE_MAX);
    expect(normalizeEditorPrefs({ fontSize: 16.7 }).fontSize).toBe(17);
  });

  it("falls back to default fontSize for non-numeric values", () => {
    expect(normalizeEditorPrefs({ fontSize: "huge" }).fontSize).toBe(
      DEFAULT_EDITOR_PREFS.fontSize
    );
    expect(normalizeEditorPrefs({ fontSize: NaN }).fontSize).toBe(
      DEFAULT_EDITOR_PREFS.fontSize
    );
  });

  it("only accepts 2 or 4 for tabWidth — anything else collapses to 2", () => {
    expect(normalizeEditorPrefs({ tabWidth: 4 }).tabWidth).toBe(4);
    expect(normalizeEditorPrefs({ tabWidth: 2 }).tabWidth).toBe(2);
    expect(normalizeEditorPrefs({ tabWidth: 8 }).tabWidth).toBe(2);
    expect(normalizeEditorPrefs({ tabWidth: "wide" }).tabWidth).toBe(2);
  });

  it("treats booleans strictly — only `true` flips vimMode/wordWrap", () => {
    expect(normalizeEditorPrefs({ vimMode: 1 }).vimMode).toBe(false);
    expect(normalizeEditorPrefs({ wordWrap: "yes" }).wordWrap).toBe(false);
    expect(normalizeEditorPrefs({ vimMode: true, wordWrap: true })).toEqual({
      ...DEFAULT_EDITOR_PREFS,
      vimMode: true,
      wordWrap: true,
    });
  });
});

describe("readEditorPrefs / writeEditorPrefs", () => {
  let storage: ReturnType<typeof makeStorageStub>;

  beforeEach(() => {
    storage = makeStorageStub();
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns defaults when storage is empty", () => {
    expect(readEditorPrefs()).toEqual(DEFAULT_EDITOR_PREFS);
  });

  it("round-trips a write through read", () => {
    const prefs: EditorPrefs = {
      vimMode: true,
      theme: "hc-black",
      fontSize: 20,
      tabWidth: 4,
      wordWrap: true,
    };
    writeEditorPrefs(prefs);
    expect(JSON.parse(storage.getItem(EDITOR_PREFS_KEY)!)).toEqual(prefs);
    expect(readEditorPrefs()).toEqual(prefs);
  });

  it("returns defaults when storage holds malformed JSON (no throw)", () => {
    storage.setItem(EDITOR_PREFS_KEY, "{not-json");
    expect(readEditorPrefs()).toEqual(DEFAULT_EDITOR_PREFS);
  });

  it("normalizes legacy / partial payloads on read", () => {
    storage.setItem(
      EDITOR_PREFS_KEY,
      JSON.stringify({ theme: "vs", fontSize: 99 })
    );
    expect(readEditorPrefs()).toEqual({
      ...DEFAULT_EDITOR_PREFS,
      theme: "vs",
      fontSize: FONT_SIZE_MAX,
    });
  });

  it("write swallows quota / privacy-mode failures", () => {
    vi.stubGlobal("window", {
      localStorage: {
        setItem: () => {
          throw new Error("QuotaExceeded");
        },
      },
    });
    expect(() => writeEditorPrefs(DEFAULT_EDITOR_PREFS)).not.toThrow();
  });

  it("read returns defaults on the server (no window)", () => {
    vi.unstubAllGlobals();
    expect(readEditorPrefs()).toEqual(DEFAULT_EDITOR_PREFS);
  });

  it("write is a no-op on the server (no window) — does not throw", () => {
    vi.unstubAllGlobals();
    expect(() => writeEditorPrefs(DEFAULT_EDITOR_PREFS)).not.toThrow();
  });
});
