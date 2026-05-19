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

// Slow query counter — incremented from the Prisma logging hook in
// src/lib/db.ts whenever a query exceeds SLOW_QUERY_MS (default 500ms).
// Lives here so /api/metrics can expose it without a circular import on db.ts.
let slowQueryTotal = 0;

export function recordSlowQuery(): void {
  slowQueryTotal += 1;
}

export function snapshotSlowQueries(): { total: number } {
  return { total: slowQueryTotal };
}

// Requests served without an X-Request-Id header (sign that the
// middleware ID injector did not run — usually a deploy/config mistake).
let missingRequestIdTotal = 0;

export function recordMissingRequestId(): void {
  missingRequestIdTotal += 1;
}

export function snapshotMissingRequestId(): { total: number } {
  return { total: missingRequestIdTotal };
}
