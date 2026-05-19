import type { CiRunsOutcome } from "@/lib/devops/aggregator";
import { cn } from "@/lib/utils";

const CONCLUSION_PILL: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  failure: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  skipped: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

const STATUS_PILL: Record<string, string> = {
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  queued: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
};

interface Props {
  outcome: CiRunsOutcome;
}

function pillClasses(status: string, conclusion: string | null): string {
  if (conclusion && CONCLUSION_PILL[conclusion]) return CONCLUSION_PILL[conclusion];
  if (STATUS_PILL[status]) return STATUS_PILL[status];
  return "bg-muted text-muted-foreground border-border";
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function CiRunsTile({ outcome }: Props) {
  if (!outcome.ok) {
    if ("reason" in outcome && outcome.reason === "tokenMissing") {
      return (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          GH token unset. Set <code className="font-mono">GH_DEVOPS_TOKEN</code> to view recent CI runs.
        </div>
      );
    }
    return (
      <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
        CI runs unavailable: {"error" in outcome ? outcome.error : "unknown"}
      </div>
    );
  }
  const { runs, repo } = outcome.data;
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        No recent runs for <span className="font-mono">{repo}</span>.
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {runs.map((run) => {
        const label = run.conclusion ?? run.status;
        return (
          <li key={run.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums",
                pillClasses(run.status, run.conclusion)
              )}
            >
              {label}
            </span>
            <a
              href={run.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 truncate font-medium hover:text-primary"
            >
              {run.name}
            </a>
            <span className="hidden md:inline font-mono text-xs text-muted-foreground">
              {run.headBranch}@{run.headSha}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {relativeTime(run.createdAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
