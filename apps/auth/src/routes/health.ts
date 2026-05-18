import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * Liveness vs readiness — the audit asked for both.
 *
 *  GET /healthz — cheap liveness probe. 200 as long as the process is up.
 *                 Used by orchestrators to decide whether to restart the
 *                 container. Must NOT do DB I/O — a slow Postgres should
 *                 not cause a restart loop.
 *  GET /readyz  — readiness. Probes Postgres with a 2s timeout.
 *                 Returns 503 when DB is unreachable so the load balancer
 *                 stops routing traffic until DB is back.
 *  GET /health  — kept as an alias for /readyz for backwards compat.
 */

const startedAt = Date.now();
const VERSION = "0.1.0";

export function livenessHandler(c: Context) {
  return c.json({
    status: "ok",
    service: "leetrank-auth",
    uptimeSeconds: (Date.now() - startedAt) / 1000,
    timestamp: new Date().toISOString(),
  });
}

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
    service: "leetrank-auth",
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
