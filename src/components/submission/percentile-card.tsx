/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Activity, AlertCircle } from "lucide-react";
import { languageLabel } from "@/lib/languages";
import {
  bucketIndexFor,
  type DistributionBucket,
} from "@/lib/analytics-helpers";

interface PercentilePayload {
  percentile: number;
  runtime: number;
  language: string;
  totalSubmissions: number;
  runtimes: number[];
  distribution: DistributionBucket[];
}

interface PercentileCardProps {
  submissionId: string;
}

/**
 * "Beat X% of submissions" hero card with a runtime distribution
 * histogram. Mirrors LeetCode's submission-success page.
 *
 * Renders three states:
 * - loading: skeleton matching the final layout
 * - error / no data: muted, non-blocking notice
 * - ready: hero number + horizontal histogram
 *
 * The histogram is hand-rolled SVG so we don't drag in a chart
 * library for one chart. The user's own bucket is highlighted in
 * primary.
 */
export function PercentileCard({ submissionId }: PercentileCardProps) {
  const [data, setData] = useState<PercentilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    fetch(`/api/submissions/${encodeURIComponent(submissionId)}/percentile`)
      .then(async (r) => {
        if (!r.ok) {
          if (!cancelled) setErrored(true);
          return null;
        }
        return r.json();
      })
      .then((payload: PercentilePayload | null) => {
        if (!cancelled && payload) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (loading) return <PercentileSkeleton />;

  if (errored || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Couldn&apos;t load runtime stats.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <PercentileBody data={data} />;
}

function PercentileBody({ data }: { data: PercentilePayload }) {
  const userBucket = bucketIndexFor(data.runtime, data.distribution);
  const maxCount = data.distribution.reduce((m, b) => (b.count > m ? b.count : m), 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <PercentileHero data={data} />
        <DistributionChart
          distribution={data.distribution}
          userBucket={userBucket}
          maxCount={maxCount}
          userRuntime={data.runtime}
        />
        <p className="text-xs text-muted-foreground">
          Compared against{" "}
          <span className="font-medium text-foreground">{data.totalSubmissions}</span>{" "}
          accepted {languageLabel(data.language)} submission
          {data.totalSubmissions === 1 ? "" : "s"} for this problem.
        </p>
      </CardContent>
    </Card>
  );
}

function PercentileHero({ data }: { data: PercentilePayload }) {
  // No peers to compare against — hide the big number rather than
  // showing a misleading "Beat 0%".
  if (data.totalSubmissions <= 1) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="text-sm font-medium">First accepted submission</div>
        <div className="text-xs text-muted-foreground mt-1">
          You&apos;re the first to solve this in {languageLabel(data.language)} — no
          comparison available yet.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        Runtime ranking
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="gradient-text text-4xl font-bold tabular-nums">
          Beat {data.percentile}%
        </div>
        <div className="text-sm text-muted-foreground">of submissions</div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Your runtime: <span className="font-medium text-foreground">{data.runtime}ms</span>
      </div>
    </div>
  );
}

function DistributionChart({
  distribution,
  userBucket,
  maxCount,
  userRuntime,
}: {
  distribution: DistributionBucket[];
  userBucket: number;
  maxCount: number;
  userRuntime: number;
}) {
  if (!distribution.length || maxCount === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Not enough submissions yet to chart a distribution.
      </p>
    );
  }

  // Horizontal layout: x-axis = runtime buckets, y-axis = count.
  // Pure SVG, sized via viewBox so it scales fluidly on mobile.
  const width = 600;
  const height = 140;
  const barGap = 2;
  const barWidth = Math.max(1, width / distribution.length - barGap);

  return (
    <div>
      <div className="text-xs font-medium mb-2">Runtime distribution</div>
      <svg
        viewBox={`0 0 ${width} ${height + 20}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Runtime distribution histogram, ${distribution.length} buckets, your submission at ${userRuntime}ms`}
      >
        {distribution.map((b, i) => {
          const h = (b.count / maxCount) * height;
          const x = i * (barWidth + barGap);
          const y = height - h;
          const isUser = i === userBucket;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={1}
                className={isUser ? "fill-primary" : "fill-muted-foreground/40"}
              >
                <title>
                  {`${Math.round(b.min)}-${Math.round(b.max)}ms · ${b.count} submission${b.count === 1 ? "" : "s"}`}
                </title>
              </rect>
              {isUser ? (
                <line
                  x1={x + barWidth / 2}
                  x2={x + barWidth / 2}
                  y1={0}
                  y2={height}
                  className="stroke-primary"
                  strokeDasharray="2 3"
                  strokeWidth={1}
                />
              ) : null}
            </g>
          );
        })}
        {/* Baseline */}
        <line
          x1={0}
          x2={width}
          y1={height}
          y2={height}
          className="stroke-border"
          strokeWidth={1}
        />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{Math.round(distribution[0].min)}ms</span>
        <span className="inline-flex items-center gap-1">
          <span className="dot bg-primary" /> Your submission
        </span>
        <span>{Math.round(distribution[distribution.length - 1].max)}ms</span>
      </div>
    </div>
  );
}

function PercentileSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </CardContent>
    </Card>
  );
}
