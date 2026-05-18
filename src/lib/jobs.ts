/**
 * Job-type registry. Each handler runs on the WorkerQueue without
 * blocking the request handler that enqueued it.
 *
 * Register all handlers here so a single import boots the queue with
 * the production set. Tests can register their own handlers on a fresh
 * WorkerQueue instance and ignore this module.
 */
import { queue } from "./queue";
import { invalidateProblemsCache, invalidateLeaderboardCache } from "./cache-invalidate";
import { logger } from "./logger";

// Side-effect import: registers the judge-submission handler on the queue.
import "./submission-jobs";

const log = logger.with({ scope: "jobs" });

interface RecomputeStatsPayload {
  reason: string;
}

interface CacheBustPayload {
  scope: "problems" | "leaderboard" | "all";
}

queue.on<RecomputeStatsPayload>("recompute-stats", async ({ reason }) => {
  // Real implementation will rebuild rolling acceptance counts and
  // refresh the materialised /trending key. Stub for now so the
  // contract is exercised end-to-end.
  log.info("recompute-stats invoked", { reason });
});

queue.on<CacheBustPayload>("cache-bust", async ({ scope }) => {
  if (scope === "problems" || scope === "all") invalidateProblemsCache();
  if (scope === "leaderboard" || scope === "all") invalidateLeaderboardCache();
  log.info("cache-bust invoked", { scope });
});

export function enqueueRecomputeStats(reason: string) {
  return queue.enqueue<RecomputeStatsPayload>("recompute-stats", { reason });
}

export function enqueueCacheBust(scope: CacheBustPayload["scope"]) {
  return queue.enqueue<CacheBustPayload>("cache-bust", { scope });
}
