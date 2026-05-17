// In-memory HTTP counters. Reset on process restart (Prometheus's counter
// model handles resets via rate() so this is fine). Backed by a single
// shared object so route handlers can record without going through the
// global namespace.

interface Counters {
  total: number;
  byStatus: Map<number, number>;
}

const counters: Counters = {
  total: 0,
  byStatus: new Map(),
};

export function recordHttp(status: number): void {
  counters.total += 1;
  counters.byStatus.set(status, (counters.byStatus.get(status) ?? 0) + 1);
}

export function snapshotHttp(): { total: number; byStatus: Record<string, number> } {
  const byStatus: Record<string, number> = {};
  for (const [status, count] of counters.byStatus) {
    byStatus[String(status)] = count;
  }
  return { total: counters.total, byStatus };
}
