import { describe, it, expect } from "vitest";
import {
  serializeEvent,
  serializeEvents,
  deserializeEvents,
  debounceEvents,
  playback,
  playbackToArray,
  applyEdit,
  durationMs,
  MAX_EVENTS_PER_FLUSH,
  type PlaybackEvent,
} from "@/lib/code-playback";

const range = (
  sl: number,
  sc: number,
  el: number,
  ec: number,
) => ({ startLineNumber: sl, startColumn: sc, endLineNumber: el, endColumn: ec });

const keystroke = (
  ts: number,
  text: string,
  r = range(1, 1, 1, 1),
): PlaybackEvent => ({
  type: "keystroke",
  ts,
  payload: { range: r, text, rangeLength: 0 },
});

describe("code-playback :: serializeEvent", () => {
  it("rejects unknown event types", () => {
    expect(() =>
      // @ts-expect-error invalid type for the test
      serializeEvent({ type: "explode", ts: 0, payload: { code: "" } }),
    ).toThrow(/unknown playback event type/);
  });

  it("rejects negative ts", () => {
    expect(() =>
      serializeEvent({ type: "snapshot", ts: -1, payload: { code: "" } }),
    ).toThrow(/non-negative/);
  });

  it("floors ts to integer milliseconds", () => {
    const out = serializeEvent({
      type: "snapshot",
      ts: 12.9,
      payload: { code: "x" },
    });
    expect(out.ts).toBe(12);
  });

  it("canonicalizes range numbers to integers >= 1", () => {
    const out = serializeEvent(keystroke(0, "x", range(0.7, 0.2, 1.4, 2.9)));
    const p = out.payload as { range: ReturnType<typeof range> };
    expect(p.range).toEqual({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 2,
    });
  });

  it("rejects oversize batches", () => {
    const big: PlaybackEvent[] = Array.from(
      { length: MAX_EVENTS_PER_FLUSH + 1 },
      (_, i) => keystroke(i, "a"),
    );
    expect(() => serializeEvents(big)).toThrow(/exceeds MAX_EVENTS_PER_FLUSH/);
  });
});

describe("code-playback :: deserializeEvents", () => {
  it("drops corrupt rows and sorts by ts", () => {
    const rows = [
      { type: "keystroke", ts: 200, payload: { range: range(1, 1, 1, 1), text: "b", rangeLength: 0 } },
      { type: "bogus", ts: 100, payload: {} },
      { type: "keystroke", ts: 50, payload: null },
      { type: "snapshot", ts: 10, payload: { code: "x" } },
    ];
    const out = deserializeEvents(rows);
    expect(out.map((e) => e.ts)).toEqual([10, 200]);
    expect(out[0]!.type).toBe("snapshot");
  });
});

describe("code-playback :: debounceEvents", () => {
  it("collapses runs of keystrokes inside the window into the latest one", () => {
    const events = [
      keystroke(0, "a"),
      keystroke(50, "b"),
      keystroke(120, "c"),
      keystroke(900, "d"),
    ];
    const debounced = debounceEvents(events, 500);
    expect(debounced).toHaveLength(2);
    expect(debounced[0]!.ts).toBe(120);
    expect(debounced[1]!.ts).toBe(900);
  });

  it("never collapses across non-keystroke types", () => {
    const events: PlaybackEvent[] = [
      keystroke(0, "a"),
      { type: "select", ts: 100, payload: { selection: range(1, 1, 1, 2) } },
      keystroke(150, "b"),
    ];
    const debounced = debounceEvents(events, 500);
    expect(debounced).toHaveLength(3);
  });

  it("returns input unchanged when window is non-positive", () => {
    const events = [keystroke(0, "a"), keystroke(10, "b")];
    expect(debounceEvents(events, 0)).toHaveLength(2);
  });
});

describe("code-playback :: playback frames", () => {
  it("applies inserts at line 1 col 1 sequentially", () => {
    const events = [
      keystroke(0, "h", range(1, 1, 1, 1)),
      keystroke(100, "i", range(1, 2, 1, 2)),
    ];
    const frames = playbackToArray(events);
    expect(frames).toHaveLength(2);
    expect(frames[0]!.code).toBe("h");
    expect(frames[1]!.code).toBe("hi");
  });

  it("respects starter code as the initial buffer", () => {
    const frames = playbackToArray([keystroke(0, "X", range(1, 1, 1, 1))], {
      initialCode: "abc",
    });
    expect(frames[0]!.code).toBe("Xabc");
  });

  it("scales ts by speed", () => {
    const frames = playbackToArray(
      [keystroke(1000, "a", range(1, 1, 1, 1))],
      { speed: 2 },
    );
    expect(frames[0]!.ts).toBe(500);
  });

  it("snapshot events overwrite the buffer", () => {
    const events: PlaybackEvent[] = [
      keystroke(0, "abc", range(1, 1, 1, 1)),
      { type: "snapshot", ts: 200, payload: { code: "fresh" } },
    ];
    const frames = playbackToArray(events);
    expect(frames[1]!.code).toBe("fresh");
  });

  it("can be consumed lazily via the generator", () => {
    const gen = playback([keystroke(0, "a"), keystroke(1, "b")]);
    expect(gen.next().value?.code).toBe("a");
    // Stop iteration early — no error / infinite loop.
    gen.return?.(undefined);
  });
});

describe("code-playback :: applyEdit + durationMs", () => {
  it("applies multi-line replacements", () => {
    const code = "line1\nline2\nline3";
    const out = applyEdit(code, range(2, 1, 2, 6), "LINE2");
    expect(out).toBe("line1\nLINE2\nline3");
  });

  it("returns 0 duration for an empty timeline", () => {
    expect(durationMs([])).toBe(0);
  });

  it("returns the last event ts as total duration", () => {
    expect(durationMs([keystroke(0, "a"), keystroke(750, "b")])).toBe(750);
  });
});
