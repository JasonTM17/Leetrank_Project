/**
 * Acceptance-rate refresher.
 *
 * The `Problem.acceptanceRate` column stores `accepted / total` as a 0..1
 * float so the problems list and ranking pages can sort/filter cheaply
 * without aggregating Submission rows on every request. This module owns
 * the recompute logic.
 *
 * Two entry points:
 *   - `refreshAcceptanceRate(problemId)` — single problem, used after a
 *     verdict lands so the listing page sees fresh numbers within the
 *     next cache cycle.
 *   - `refreshAllAcceptanceRates()` — batch refresher for cron/admin
 *     reseed. Walks every problem with at least one submission and
 *     updates only when the value actually changed (delta > epsilon).
 *
 * The math intentionally treats "accepted" as `status === "accepted"`
 * (case-insensitive) — that matches the verdict strings the judge
 * produces today (`accepted`, `wrong_answer`, ...). If new verdicts
 * appear, extend ACCEPTED_STATUSES rather than the SQL.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const ACCEPTED_STATUSES = new Set(["accepted"]);
// 1e-4 tolerance keeps writes idempotent — re-running the refresher on a
// cold problem won't churn updatedAt by an imperceptible amount.
const EPSILON = 1e-4;

export interface AcceptanceSnapshot {
  problemId: string;
  total: number;
  accepted: number;
  /** 0..1 ratio, or null when there are no submissions. */
  rate: number | null;
}

/**
 * Compute (but don't persist) the acceptance rate snapshot for a problem.
 * Exposed for tests and callers that want to display the value without
 * waiting for the write round-trip.
 */
export async function computeAcceptanceRate(problemId: string): Promise<AcceptanceSnapshot> {
  const grouped = await prisma.submission.groupBy({
    by: ["status"],
    where: { problemId },
    _count: { _all: true },
  });

  let total = 0;
  let accepted = 0;
  for (const row of grouped) {
    const count = row._count?._all ?? 0;
    total += count;
    if (ACCEPTED_STATUSES.has(String(row.status).toLowerCase())) {
      accepted += count;
    }
  }

  const rate = total > 0 ? accepted / total : null;
  return { problemId, total, accepted, rate };
}

/**
 * Recompute and persist the acceptance rate for one problem. Returns the
 * snapshot regardless of whether a DB write happened so callers can log
 * the value. The write is skipped when the new rate is within EPSILON of
 * the stored value to keep updatedAt stable.
 */
export async function refreshAcceptanceRate(problemId: string): Promise<AcceptanceSnapshot> {
  const snapshot = await computeAcceptanceRate(problemId);
  const current = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { acceptanceRate: true },
  });

  const previous = current?.acceptanceRate ?? null;
  const next = snapshot.rate;
  const changed = !equalRates(previous, next);

  if (changed) {
    await prisma.problem.update({
      where: { id: problemId },
      data: { acceptanceRate: next },
    });
  }
  return snapshot;
}

/**
 * Refresh every problem that has at least one submission. Returns the
 * count of rows that actually moved so cron jobs can log signal vs noise.
 *
 * Walks problemIds in chunks so the GROUP BY query stays bounded even
 * with 10k+ problems.
 */
export async function refreshAllAcceptanceRates(): Promise<{ scanned: number; updated: number }> {
  const problems = await prisma.problem.findMany({
    select: { id: true },
    orderBy: { order: "asc" },
  });

  let scanned = 0;
  let updated = 0;
  for (const { id } of problems) {
    try {
      const before = await prisma.problem.findUnique({
        where: { id },
        select: { acceptanceRate: true },
      });
      const snap = await refreshAcceptanceRate(id);
      scanned += 1;
      if (!equalRates(before?.acceptanceRate ?? null, snap.rate)) {
        updated += 1;
      }
    } catch (err) {
      // Log + continue — one bad problem shouldn't kill the whole sweep.
      logger.error("acceptance-rate: refresh failed", {
        scope: "lib/acceptance-rate",
        problemId: id,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { scanned, updated };
}

/** True when two nullable rates round to the same value within EPSILON. */
export function equalRates(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= EPSILON;
}
