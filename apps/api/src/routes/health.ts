import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * GET /health — deep health check that probes Postgres.
 *
 * 200 → service and DB are healthy.
 * 503 → DB is unreachable (service itself is still up).
 */

const startedAt = Date.now();
const VERSION = "0.1.0";

export async function healthHandler(c: Context) {
  const uptimeSeconds = (Date.now() - startedAt) / 1000;
  const timestamp = new Date().toISOString();

  let dbStatus: "ok" | "down" = "ok";
  let dbLatencyMs: number | undefined;
  let dbError: string | undefined;

  const dbStart = Date.now();
  try {
    // AbortSignal.timeout is available in Node 17.3+ / Node 24.
    const signal = AbortSignal.timeout(2000);
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        signal.addEventListener("abort", () =>
          reject(new Error("DB health check timed out"))
        )
      ),
    ]);
    dbLatencyMs = Date.now() - dbStart;
  } catch (err) {
    dbStatus = "down";
    dbLatencyMs = Date.now() - dbStart;
    dbError = err instanceof Error ? err.message : "unknown error";
  }

  const healthy = dbStatus === "ok";

  const body = {
    status: healthy ? "ok" : "down",
    service: "leetrank-api",
    uptimeSeconds,
    version: VERSION,
    timestamp,
    services: {
      database: healthy
        ? { status: "ok" as const, latencyMs: dbLatencyMs }
        : { status: "down" as const, error: dbError },
    },
  };

  return c.json(body, healthy ? 200 : 503);
}
