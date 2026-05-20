/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */
"use client";

/**
 * Code playback viewer.
 *
 * Renders a recorded coding session with a play / pause / scrub timeline.
 * The component fetches the event stream lazily on mount so it ships
 * zero bytes for sessions with no recording (the API returns an empty
 * array, and we just render an empty-state).
 *
 * Frame computation lives in `@/lib/code-playback` so the same logic
 * runs in unit tests and on the server. We materialise frames once on
 * load — sessions are bounded to MAX_EVENTS_PER_FLUSH so this is cheap.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Pause, Play, Rewind, Film } from "lucide-react";
import { playbackToArray, type PlaybackEvent, type PlaybackFrame } from "@/lib/code-playback";

interface ApiResponse {
  events: PlaybackEvent[];
  count: number;
  durationMs: number;
}

interface Props {
  submissionId: string;
  /** Initial code shown at t=0 if the timeline doesn't open with a snapshot. */
  initialCode?: string;
}

const SPEEDS = [0.5, 1, 2, 4] as const;

export function PlaybackViewer({ submissionId, initialCode = "" }: Props) {
  const t = useTranslations("playback");
  const [events, setEvents] = useState<PlaybackEvent[] | null>(null);
  const [error, setError] = useState<"unauthorized" | "not_found" | null>(null);
  const [loading, setLoading] = useState(true);

  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const tickRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/submissions/${encodeURIComponent(submissionId)}/playback`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) { setError("unauthorized"); return; }
        if (r.status === 404) { setError("not_found"); return; }
        if (!r.ok) { setError("not_found"); return; }
        const data = (await r.json()) as ApiResponse;
        setEvents(data.events ?? []);
      })
      .catch(() => { if (!cancelled) setError("not_found"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (tickRef.current) clearTimeout(tickRef.current); };
  }, [submissionId]);

  const frames = useMemo<PlaybackFrame[]>(() => {
    if (!events || events.length === 0) return [];
    return playbackToArray(events, { initialCode, speed });
  }, [events, initialCode, speed]);

  const totalMs = frames.length === 0 ? 0 : frames[frames.length - 1]!.ts;
  const current = frames[frameIndex];

  // Drive playback with setTimeout aligned to frame deltas. We don't use
  // requestAnimationFrame because frame intervals can be 100ms-10s apart
  // and a 60fps render loop would just sleep most of the time.
  useEffect(() => {
    if (tickRef.current) clearTimeout(tickRef.current);
    if (!playing || frames.length === 0) return;
    if (frameIndex >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const next = frames[frameIndex + 1]!;
    const here = frames[frameIndex]!;
    const delta = Math.max(16, next.ts - here.ts);
    tickRef.current = setTimeout(() => setFrameIndex((i) => i + 1), delta);
    return () => { if (tickRef.current) clearTimeout(tickRef.current); };
  }, [playing, frameIndex, frames]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>{t("title")}</CardTitle></CardHeader>
        <CardContent className="space-y-2"><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  if (error || !events || events.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{t("title")}</CardTitle></CardHeader>
        <CardContent>
          <EmptyState icon={Film} title={t("emptyTitle")} description={t("emptyDescription")} />
        </CardContent>
      </Card>
    );
  }

  const code = current?.code ?? initialCode;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{t("title")}</CardTitle>
        <span className="text-xs text-muted-foreground">
          {t("durationLabel", { seconds: Math.round(totalMs / 1000) })}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="rounded-md border bg-muted/40 p-4 text-xs font-mono overflow-auto max-h-[420px] whitespace-pre">
          <code>{code}</code>
        </pre>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setFrameIndex(0); setPlaying(false); }}
            aria-label={t("rewind")}
          >
            <Rewind className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? t("pause") : t("play")}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span className="ml-2">{playing ? t("pause") : t("play")}</span>
          </Button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="rounded-md border bg-background px-2 py-1 text-xs"
            aria-label={t("speed")}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>{s}x</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">
            {t("frameLabel", { current: frameIndex + 1, total: frames.length })}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={frameIndex}
          onChange={(e) => { setFrameIndex(Number(e.target.value)); setPlaying(false); }}
          className="w-full accent-primary"
          aria-label={t("scrub")}
        />
      </CardContent>
    </Card>
  );
}

export default PlaybackViewer;
