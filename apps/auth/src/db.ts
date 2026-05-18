import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

/**
 * Singleton Prisma client for the auth service.
 *
 * Shares the same Postgres instance as apps/api during the phase-3 migration.
 * The schema in `prisma/schema.prisma` at the repo root is the single source
 * of truth until auth owns its own write paths.
 *
 * connection_limit=5 — auth is a lower-traffic service than api; 5 connections
 * is sufficient and leaves headroom for other services sharing the pool.
 */
function withPoolParams(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "5");
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "20");
  }
  return url.toString();
}

declare global {
  // eslint-disable-next-line no-var
  var __leetrankAuthPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__leetrankAuthPrisma ??
  new PrismaClient({
    datasourceUrl: withPoolParams(env.DATABASE_URL),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalThis.__leetrankAuthPrisma = prisma;
}
