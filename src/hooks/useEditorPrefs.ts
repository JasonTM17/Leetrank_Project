"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_EDITOR_PREFS,
  EDITOR_PREFS_KEY,
  readEditorPrefs,
  writeEditorPrefs,
  type EditorPrefs,
} from "@/lib/editor-prefs";

/**
 * Subscribes to editor preferences with localStorage durability.
 *
 * The first render returns {@link DEFAULT_EDITOR_PREFS} so SSR and the
 * pre-hydration client agree — the persisted value lands on the second
 * render via `useEffect`. This avoids hydration mismatches in the
 * Monaco editor toolbar, which renders inside an RSC tree.
 *
 * Cross-tab sync rides on the native `storage` event so two open
 * problem tabs stay in lock-step without a custom broadcaster.
 */
export function useEditorPrefs(): {
  prefs: EditorPrefs;
  setPrefs: (next: Partial<EditorPrefs>) => void;
  reset: () => void;
} {
  const [prefs, setPrefsState] = useState<EditorPrefs>(DEFAULT_EDITOR_PREFS);

  // Hydrate after mount so SSR + first-paint render the defaults; this
  // matches every other client-only setting in the app.
  useEffect(() => {
    setPrefsState(readEditorPrefs());
  }, []);

  // Cross-tab sync. Ignore unrelated storage events to keep this cheap.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== EDITOR_PREFS_KEY) return;
      setPrefsState(readEditorPrefs());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPrefs = useCallback((next: Partial<EditorPrefs>) => {
    setPrefsState((prev) => {
      const merged = { ...prev, ...next };
      writeEditorPrefs(merged);
      return merged;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefsState(DEFAULT_EDITOR_PREFS);
    writeEditorPrefs(DEFAULT_EDITOR_PREFS);
  }, []);

  return { prefs, setPrefs, reset };
}
