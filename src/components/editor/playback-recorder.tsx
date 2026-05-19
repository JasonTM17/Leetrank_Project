"use client";

/**
 * LeetCode-style code playback recorder.
 *
 * Mounts onto a Monaco editor instance and:
 *   1. Records onDidChangeContent / onDidChangeCursorSelection events
 *      with millisecond offsets from session start.
 *   2. Debounces the keystroke stream client-side so a 60-key burst
 *      collapses into a single "current state" frame instead of 60
 *      replay frames.
 *   3. Exposes a `flush(submissionId)` callback the submit handler
 *      calls when the user posts code. The component itself never
 *      knows about the submission id — that's only known after POST
 *      /api/submissions returns.
 *
 * Lazy-loadable: the parent page should `dynamic(() => import(...),
 * { ssr: false })` this so the recorder ships only when the feature
 * flag is enabled and the page is hydrated.
 *
 * Pure side-effect-free buffer logic lives in `@/lib/code-playback`.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  debounceEvents,
  serializeEvents,
  DEFAULT_DEBOUNCE_MS,
  MAX_EVENTS_PER_FLUSH,
  type PlaybackEvent,
  type PlaybackRange,
} from "@/lib/code-playback";

// We intentionally type Monaco surface narrowly — the heavy
// `monaco-editor` types pull in the whole DOM API and we only need
// these shapes. The runtime behavior is the same.
type MaybeRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

interface MonacoChange {
  range: MaybeRange;
  text: string;
  rangeLength: number;
}

interface MonacoChangeContentEvent {
  changes: MonacoChange[];
  isFlush?: boolean;
}

interface MonacoSelectionEvent {
  selection: MaybeRange;
}

interface MonacoModel {
  getValue(): string;
}

export interface MonacoEditor {
  getModel(): MonacoModel | null;
  onDidChangeModelContent(cb: (e: MonacoChangeContentEvent) => void): { dispose(): void };
  onDidChangeCursorSelection(cb: (e: MonacoSelectionEvent) => void): { dispose(): void };
}

export interface PlaybackRecorderHandle {
  /**
   * POST every buffered event to /api/submissions/[id]/events. Safe to
   * call multiple times — already-flushed events are dropped from the
   * buffer.
   */
  flush(submissionId: string): Promise<void>;
  /** Drop the buffer (e.g., when switching languages). */
  reset(): void;
  /** Read-only snapshot for tests / debugging. */
  size(): number;
}

interface Props {
  editor: MonacoEditor | null;
  /** When false, the recorder is a no-op. Defaults to true. */
  enabled?: boolean;
  /** Debounce window in ms. Defaults to 500. */
  debounceMs?: number;
  /** Callback ref so parents can keep the handle without re-renders. */
  onReady?: (handle: PlaybackRecorderHandle) => void;
}

export function PlaybackRecorder({ editor, enabled = true, debounceMs = DEFAULT_DEBOUNCE_MS, onReady }: Props) {
  const bufferRef = useRef<PlaybackEvent[]>([]);
  const startedAtRef = useRef<number>(0);

  // Stable methods exposed via onReady — the parent stores this in a ref
  // and calls flush(id) once POST /api/submissions returns.
  const flush = useCallback(async (submissionId: string) => {
    const events = debounceEvents(bufferRef.current, debounceMs);
    if (events.length === 0) return;
    let serialized: PlaybackEvent[];
    try {
      serialized = serializeEvents(events.slice(-MAX_EVENTS_PER_FLUSH));
    } catch {
      bufferRef.current = [];
      return;
    }
    bufferRef.current = [];
    try {
      await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: serialized }),
        keepalive: true,
      });
    } catch {
      // Swallow — playback is best-effort. We don't surface errors to
      // the user because the submission itself already succeeded.
    }
  }, [debounceMs]);

  const reset = useCallback(() => {
    bufferRef.current = [];
    startedAtRef.current = 0;
  }, []);

  const size = useCallback(() => bufferRef.current.length, []);

  // Notify parent once on mount with a stable handle. The parent
  // captures this in a ref and uses it from its submit handler.
  useEffect(() => {
    onReady?.({ flush, reset, size });
  }, [onReady, flush, reset, size]);

  // Subscribe to Monaco when both `enabled` and `editor` are present.
  useEffect(() => {
    if (!enabled || !editor) return;
    if (startedAtRef.current === 0) {
      startedAtRef.current = Date.now();
      // Record the starter buffer as a snapshot so playback has an
      // accurate t=0 frame even if the user pastes before typing.
      const model = editor.getModel();
      if (model) {
        bufferRef.current.push({
          type: "snapshot",
          ts: 0,
          payload: { code: model.getValue() },
        });
      }
    }

    const contentSub = editor.onDidChangeModelContent((e) => {
      const ts = Date.now() - startedAtRef.current;
      const isPaste = e.changes.length > 1 || e.changes.some((c) => c.text.length > 32);
      const type = isPaste ? "paste" : "keystroke";
      for (const change of e.changes) {
        if (bufferRef.current.length >= MAX_EVENTS_PER_FLUSH) return;
        bufferRef.current.push({
          type,
          ts,
          payload: {
            range: cloneRange(change.range),
            text: change.text,
            rangeLength: change.rangeLength,
          },
        });
      }
    });

    const selectionSub = editor.onDidChangeCursorSelection((e) => {
      if (bufferRef.current.length >= MAX_EVENTS_PER_FLUSH) return;
      const ts = Date.now() - startedAtRef.current;
      bufferRef.current.push({
        type: "select",
        ts,
        payload: { selection: cloneRange(e.selection) },
      });
    });

    return () => {
      contentSub.dispose();
      selectionSub.dispose();
    };
  }, [editor, enabled]);

  // Render nothing — the component is purely effectful.
  return null;
}

function cloneRange(r: MaybeRange): PlaybackRange {
  return {
    startLineNumber: r.startLineNumber,
    startColumn: r.startColumn,
    endLineNumber: r.endLineNumber,
    endColumn: r.endColumn,
  };
}

export default PlaybackRecorder;
