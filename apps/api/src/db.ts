import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

/**
 * Singleton Prisma client.
 *
 * apps/api uses the same Postgres as apps/web during the phase-1 migration —
 * the schema in `prisma/schema.prisma` at the repo root is shared. Once the
 * API owns its own write paths we may move the schema under apps/api/prisma,
 * but for now keeping one source of truth avoids drift.
 *
 * Pattern matches the web app's lib/db.ts: in dev we cache the client on
 * globalThis to survive HMR; in prod we instantiate once.
 */

/**
 * Appends Prisma connection-pool parameters to the DATABASE_URL if they are
 * not already present.
 *
 * connection_limit=10 — Plan 02 §2 targets 10 services sharing one Postgres
 * instance; capping each service at 10 connections keeps the total well under
 * the default max_connections=100. Raise this only if profiling shows pool
 * exhaustion under load.
 *
 * pool_timeout=20 — how long (seconds) a query waits for a free connection
 * before Prisma throws P2024. 20 s is generous; most queries should complete
 * in < 1 s. Pairs with the 15 s HTTP timeout in timeout.ts so the pool error
 * surfaces before the gateway 504.
 */
function withPoolParams(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "10");
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "20");
  }
  return url.toString();
}

declare global {
  // eslint-disable-next-line no-var
  var __leetrankApiPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__leetrankApiPrisma ??
  new PrismaClient({
    datasourceUrl: withPoolParams(env.DATABASE_URL),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalThis.__leetrankApiPrisma = prisma;
}
