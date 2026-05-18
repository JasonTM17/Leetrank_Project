import type { MiddlewareHandler } from "hono";

/**
 * Per-request timeout middleware.
 *
 * Races the downstream handler against a deadline. If the deadline fires first
 * the request is aborted and a 504 is returned. The AbortController signal is
 * available to route handlers that accept it (e.g. Prisma queries via
 * `{ signal: c.get("abortSignal") }`) — wiring that up is a future step.
 *
 * Usage:
 *   app.use("*", timeout(15_000));   // 15 s global guardrail
 *   app.use("/slow-route", timeout(60_000)); // per-route override
 */
export function timeout(ms: number): MiddlewareHandler {
  return async (c, next) => {
    let timer: NodeJS.Timeout | null = null;
    const ac = new AbortController();
    const timeoutPromise = new Promise<Response>((resolve) => {
      timer = setTimeout(() => {
        ac.abort();
        resolve(c.json({ error: "Request timed out" }, 504));
      }, ms);
    });
    try {
      const result = await Promise.race([next().then(() => null), timeoutPromise]);
      if (result) return result;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
