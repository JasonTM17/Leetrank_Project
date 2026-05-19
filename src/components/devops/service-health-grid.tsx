import { cn } from "@/lib/utils";
import type { ServiceHealthSnapshot, ServiceHealth } from "@/lib/devops/aggregator";

const STATUS_DOT: Record<ServiceHealth, string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
  unknown: "bg-zinc-400",
};

const STATUS_LABEL: Record<ServiceHealth, string> = {
  operational: "OK",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

interface Props {
  snapshot: ServiceHealthSnapshot | null;
  error?: string;
}

/**
 * Visual grid of all services. Renders 10 tiles in a responsive grid;
 * each tile shows name, status dot, status label, and last-observed
 * latency. Aggregator failures collapse the grid to a single error
 * panel — but per-service "down" still renders within the grid so an
 * operator can see which one is the problem at a glance.
 */
export function ServiceHealthGrid({ snapshot, error }: Props) {
  if (!snapshot) {
    return (
      <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
        Service health unavailable{error ? `: ${error}` : "."}
      </div>
    );
  }
  return (
    <div data-testid="service-health-grid" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {snapshot.services.map((svc) => (
        <div
          key={svc.id}
          data-testid={`tile-${svc.id}`}
          data-status={svc.status}
          className={cn(
            "rounded-lg border bg-card p-3 transition-all motion-safe:duration-200 hover:border-primary/30",
            "flex flex-col gap-2"
          )}
        >
          <div className="flex items-center gap-2">
            <span
              data-testid={`dot-${svc.id}`}
              aria-hidden="true"
              className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[svc.status])}
            />
            <span className="text-sm font-medium truncate">{svc.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{STATUS_LABEL[svc.status]}</span>
            <span className="tabular-nums">{svc.latencyMs !== undefined ? `${svc.latencyMs}ms` : "—"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
