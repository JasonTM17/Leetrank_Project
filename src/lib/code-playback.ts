/**
 * LeetCode-style code playback.
 *
 * Pure helpers for the "record editor events while a user codes, replay
 * them on the submission detail page" feature. The split between this
 * module and the React surface is deliberate:
 *
 * - This file is pure TypeScript with no DOM / Monaco / React imports so
 *   it can be unit-tested in isolation and reused on the server (the API
 *   route serializes/deserializes events on read & write).
 * - The Monaco-aware recording UI lives at
 *   `src/components/editor/playback-recorder.tsx`.
 * - The viewer UI lives at
 *   `src/components/submission/playback-viewer.tsx`.
 *
 * Wire format and DB shape are the same so the API route is a thin
 * pass-through. See ADR-style notes inline.
 */

export type PlaybackEventType = "keystroke" | "paste" | "select" | "snapshot";

export interface PlaybackRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface KeystrokePayload {
  range: PlaybackRange;
  text: string;
  rangeLength: number;
}

export interface SelectPayload {
  selection: PlaybackRange;
}

export interface SnapshotPayload {
  code: string;
}

export type PlaybackPayload =
  | KeystrokePayload
  | SelectPayload
  | SnapshotPayload;

export interface PlaybackEvent {
  type: PlaybackEventType;
  /** Milliseconds since the session start (`startedAt`). Always >= 0. */
  ts: number;
  payload: PlaybackPayload;
}

export interface PlaybackFrame {
  /** Same wall-clock offset as the originating event. */
  ts: number;
  /** Cumulative source after applying every event with `ts <= this.ts`. */
  code: string;
  /** Selection at this frame. Defaults to start-of-document. */
  selection: PlaybackRange;
  /** Index of the event that produced this frame. */
  eventIndex: number;
}

const DEFAULT_SELECTION: PlaybackRange = {
  startLineNumber: 1,
  startColumn: 1,
  endLineNumber: 1,
  endColumn: 1,
};

/** Maximum payload size accepted from the client per flush. Keeps the
 *  upload bounded if a session ran for hours. */
export const MAX_EVENTS_PER_FLUSH = 5000;

/** Default keystroke debounce window in milliseconds. The recorder
 *  buffers Monaco onDidChangeContent calls into batches before posting
 *  events into the queue so we don't end up with one event per keypress. */
export const DEFAULT_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Validate + canonicalize a single event for transport. Throws on
 * unknown event types so the API layer can return 400 cleanly. Numeric
 * fields are coerced to integers so floats from `Date.now()` arithmetic
 * never sneak into the DB.
 */
export function serializeEvent(ev: PlaybackEvent): PlaybackEvent {
  if (!isPlaybackEventType(ev.type)) {
    throw new Error(`unknown playback event type: ${String(ev.type)}`);
  }
  if (!Number.isFinite(ev.ts) || ev.ts < 0) {
    throw new Error("playback event ts must be a non-negative number");
  }
  return {
    type: ev.type,
    ts: Math.max(0, Math.floor(ev.ts)),
    payload: canonicalPayload(ev.type, ev.payload),
  };
}

export function serializeEvents(events: PlaybackEvent[]): PlaybackEvent[] {
  if (events.length > MAX_EVENTS_PER_FLUSH) {
    throw new Error(
      `playback flush exceeds MAX_EVENTS_PER_FLUSH (${MAX_EVENTS_PER_FLUSH})`,
    );
  }
  return events.map(serializeEvent);
}

/**
 * Inverse of `serializeEvents`. Tolerant: rows whose `payload` is null,
 * not-an-object, or whose `type` is unknown are dropped rather than
 * thrown so a single corrupt row never wipes a viewer.
 */
export function deserializeEvents(
  rows: ReadonlyArray<{ type: string; ts: number; payload: unknown }>,
): PlaybackEvent[] {
  const out: PlaybackEvent[] = [];
  for (const row of rows) {
    if (!isPlaybackEventType(row.type)) continue;
    if (!row.payload || typeof row.payload !== "object") continue;
    try {
      out.push({
        type: row.type,
        ts: Math.max(0, Math.floor(row.ts)),
        payload: canonicalPayload(row.type, row.payload as PlaybackPayload),
      });
    } catch {
      // skip corrupt row
    }
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

function isPlaybackEventType(t: unknown): t is PlaybackEventType {
  return t === "keystroke" || t === "paste" || t === "select" || t === "snapshot";
}

function canonicalPayload(
  type: PlaybackEventType,
  payload: PlaybackPayload,
): PlaybackPayload {
  if (type === "keystroke" || type === "paste") {
    const p = payload as KeystrokePayload;
    if (!p.range || typeof p.text !== "string") {
      throw new Error(`${type} payload missing range or text`);
    }
    return {
      range: canonicalRange(p.range),
      text: p.text,
      rangeLength: Math.max(0, Math.floor(p.rangeLength ?? 0)),
    };
  }
  if (type === "select") {
    const p = payload as SelectPayload;
    if (!p.selection) throw new Error("select payload missing selection");
    return { selection: canonicalRange(p.selection) };
  }
  // snapshot
  const p = payload as SnapshotPayload;
  if (typeof p.code !== "string") throw new Error("snapshot payload missing code");
  return { code: p.code };
}

function canonicalRange(r: PlaybackRange): PlaybackRange {
  return {
    startLineNumber: Math.max(1, Math.floor(r.startLineNumber)),
    startColumn: Math.max(1, Math.floor(r.startColumn)),
    endLineNumber: Math.max(1, Math.floor(r.endLineNumber)),
    endColumn: Math.max(1, Math.floor(r.endColumn)),
  };
}

// ---------------------------------------------------------------------------
// Debounce / batching
// ---------------------------------------------------------------------------

/**
 * Coalesce a sequence of keystroke events that fall inside the same
 * debounce window into a single `paste`-like batch event. We don't
 * actually merge their *content* — that requires Monaco model state —
 * we just thin the timeline so the viewer doesn't replay 60+ frames
 * for one second of typing. This runs client-side before flush.
 */
export function debounceEvents(
  events: PlaybackEvent[],
  windowMs: number = DEFAULT_DEBOUNCE_MS,
): PlaybackEvent[] {
  if (windowMs <= 0 || events.length <= 1) return [...events];
  const out: PlaybackEvent[] = [];
  let lastKept: PlaybackEvent | null = null;
  for (const ev of events) {
    if (
      lastKept &&
      lastKept.type === "keystroke" &&
      ev.type === "keystroke" &&
      ev.ts - lastKept.ts < windowMs
    ) {
      // Replace the last kept keystroke with the newer one so the
      // viewer sees the most recent state without intermediate noise.
      out[out.length - 1] = ev;
      lastKept = ev;
      continue;
    }
    out.push(ev);
    lastKept = ev;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

export interface PlaybackOptions {
  /** Multiplier applied to `ts` when rendering. >1 fast-forwards. */
  speed?: number;
  /** Code present at session start (e.g., the problem starter snippet). */
  initialCode?: string;
}

/**
 * Iterate over the timeline as discrete frames the viewer can render.
 * Frames are produced in event order; consumers drive playback by
 * scheduling the next frame at `frame.ts / speed` ms after start.
 *
 * The function is a generator so a viewer can stop iteration early
 * (user paused, scrubbed, etc.) without computing every frame upfront.
 */
export function* playback(
  events: PlaybackEvent[],
  opts: PlaybackOptions = {},
): Generator<PlaybackFrame> {
  const speed = opts.speed && opts.speed > 0 ? opts.speed : 1;
  let code = opts.initialCode ?? "";
  let selection: PlaybackRange = { ...DEFAULT_SELECTION };
  let i = 0;
  for (const ev of events) {
    if (ev.type === "snapshot") {
      code = (ev.payload as SnapshotPayload).code;
    } else if (ev.type === "select") {
      selection = (ev.payload as SelectPayload).selection;
    } else {
      // keystroke / paste — apply the edit using line/column math.
      const k = ev.payload as KeystrokePayload;
      code = applyEdit(code, k.range, k.text);
      selection = collapsedAfter(k.range, k.text);
    }
    yield {
      ts: Math.floor(ev.ts / speed),
      code,
      selection,
      eventIndex: i,
    };
    i += 1;
  }
}

/**
 * Synchronous helper for tests / non-streaming consumers. Materializes
 * every frame in one shot. Cap at 10k frames so a malicious payload can
 * never blow up the server.
 */
export function playbackToArray(
  events: PlaybackEvent[],
  opts: PlaybackOptions = {},
): PlaybackFrame[] {
  const out: PlaybackFrame[] = [];
  let n = 0;
  for (const f of playback(events, opts)) {
    out.push(f);
    n += 1;
    if (n >= 10_000) break;
  }
  return out;
}

/**
 * Apply a Monaco-style range replacement to a code string. Exported so
 * tests can hit it directly; consumers should prefer `playback`.
 */
export function applyEdit(
  code: string,
  range: PlaybackRange,
  text: string,
): string {
  const start = offsetForPosition(code, range.startLineNumber, range.startColumn);
  const end = offsetForPosition(code, range.endLineNumber, range.endColumn);
  if (start > end) return code;
  return code.slice(0, start) + text + code.slice(end);
}

function offsetForPosition(code: string, line: number, column: number): number {
  // Monaco columns/lines are 1-indexed. Convert to a string offset.
  if (line <= 1) return Math.max(0, Math.min(code.length, column - 1));
  let offset = 0;
  let l = 1;
  while (l < line && offset < code.length) {
    const nl = code.indexOf("\n", offset);
    if (nl === -1) {
      offset = code.length;
      break;
    }
    offset = nl + 1;
    l += 1;
  }
  return Math.max(0, Math.min(code.length, offset + (column - 1)));
}

function collapsedAfter(range: PlaybackRange, text: string): PlaybackRange {
  const lines = text.split("\n");
  const lineDelta = lines.length - 1;
  const endLine = range.startLineNumber + lineDelta;
  const endColumn =
    lineDelta === 0
      ? range.startColumn + lines[0]!.length
      : lines[lines.length - 1]!.length + 1;
  return {
    startLineNumber: endLine,
    startColumn: endColumn,
    endLineNumber: endLine,
    endColumn: endColumn,
  };
}

/**
 * Total wall-clock duration of a session in milliseconds. The viewer
 * uses this to render a scrub slider.
 */
export function durationMs(events: PlaybackEvent[]): number {
  if (events.length === 0) return 0;
  return Math.max(0, events[events.length - 1]!.ts);
}
