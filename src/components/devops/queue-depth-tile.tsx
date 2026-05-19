import type { Result, QueueDepth } from "@/lib/devops/aggregator";

interface Props {
  result: Result<QueueDepth>;
  submissionsLastHour: number | null;
}

export function QueueDepthTile({ result, submissionsLastHour }: Props) {
  const depth = result.ok ? result.data.depth : null;
  const source = result.ok ? result.data.source : "placeholder";
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Queue depth</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">
          {depth === null ? <span className="text-muted-foreground">—</span> : depth}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {source === "prometheus" ? "submissions /metrics" : "no metric source"}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Submissions / hr</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">
          {submissionsLastHour === null ? <span className="text-muted-foreground">—</span> : submissionsLastHour}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">last 60 min</div>
      </div>
    </div>
  );
}
