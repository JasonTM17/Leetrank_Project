import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import logger from "../logger.js";
import {
  incRequestsTotal,
  observeRequestDuration,
  incInFlight,
  decInFlight,
} from "../metrics.js";

/**
 * Request-context middleware.
 *
 * - Reads or generates a request ID.
 * - Sets it on the context and response header.
 * - Logs one structured line per request on completion.
 * - Wires Prometheus counters/histograms.
 *
 * Replaces Hono's built-in `logger()` middleware.
 */
export const requestContext: MiddlewareHandler = createMiddleware(
  async (c, next) => {
    const requestId =
      c.req.header("x-request-id") ?? crypto.randomUUID();

    c.set("requestId", requestId);
    c.header("x-request-id", requestId);

    const startMs = Date.now();
    incInFlight();

    try {
      await next();
    } finally {
      decInFlight();

      const durationMs = Date.now() - startMs;
      const status = c.res.status;
      // Use the route pattern (e.g. /problems/:slug) to avoid label cardinality explosion.
      const routePath: string = c.req.routePath ?? c.req.path;
      const method = c.req.method;

      incRequestsTotal(method, routePath, status);
      observeRequestDuration(method, routePath, durationMs / 1000);

      logger.info("request", {
        method,
        path: c.req.path,
        route: routePath,
        status,
        durationMs,
        requestId,
        userAgent: c.req.header("user-agent") ?? "",
      });
    }
  }
);
