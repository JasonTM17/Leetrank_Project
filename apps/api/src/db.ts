import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";
import { withPoolParams } from "./db-utils.js";

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
