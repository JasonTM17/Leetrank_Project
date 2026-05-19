import { Prisma, PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import { recordSlowQuery } from "@/lib/metrics";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Threshold for what counts as a "slow" query. 500ms is the boundary the
// alerting rules in infra/prometheus/alerts.yml are tuned for; tweak via
// SLOW_QUERY_MS without touching code.
const SLOW_QUERY_MS = Number.parseInt(process.env.SLOW_QUERY_MS ?? "500", 10);

function buildClient(): PrismaClient {
  // Wire Prisma's query event log so we can warn on slow queries and feed
  // a Prometheus counter. The `event: "query"` log level is required for
  // $on("query", ...) to fire — without it Prisma silently drops the hook.
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "warn" },
      { emit: "stdout", level: "error" },
    ],
  });

  // Cast to the parametrised event-emitter shape; Prisma's TS types model
  // the log array as a const tuple, so the runtime $on signature can't
  // be inferred narrowly here. The cast is safe — we asked for query events
  // above.
  type QueryEmitter = {
    $on(event: "query", cb: (e: Prisma.QueryEvent) => void): void;
  };
  (client as unknown as QueryEmitter).$on("query", (e: Prisma.QueryEvent) => {
    if (e.duration >= SLOW_QUERY_MS) {
      recordSlowQuery();
      logger.warn("slow_query", {
        durationMs: e.duration,
        query: e.query,
        params: e.params,
        target: e.target,
      });
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
