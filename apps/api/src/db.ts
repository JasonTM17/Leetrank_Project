import { PrismaClient } from "@prisma/client";

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

declare global {
  // eslint-disable-next-line no-var
  var __leetrankApiPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__leetrankApiPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__leetrankApiPrisma = prisma;
}
