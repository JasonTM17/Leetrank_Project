import type { Result, SecurityEvents } from "@/lib/devops/aggregator";

interface Props {
  result: Result<SecurityEvents>;
}

export function SecurityEventsTile({ result }: Props) {
  if (!result.ok) {
    return (
      <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
        Security events unavailable: {result.error}
      </div>
    );
  }
  const { sandboxEscapes, lockoutsLastHour } = result.data;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Sandbox escapes</div>
        <div className={`mt-1 text-3xl font-bold tabular-nums ${sandboxEscapes > 0 ? "text-rose-600" : ""}`}>
          {sandboxEscapes}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">last 24h</div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Account lockouts</div>
        <div className={`mt-1 text-3xl font-bold tabular-nums ${lockoutsLastHour > 5 ? "text-amber-600" : ""}`}>
          {lockoutsLastHour}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">last hour</div>
      </div>
    </div>
  );
}
