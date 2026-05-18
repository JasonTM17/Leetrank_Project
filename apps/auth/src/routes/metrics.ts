import type { Context } from "hono";
import { renderPrometheus } from "../metrics.js";

/**
 * GET /metrics — Prometheus text exposition format.
 *
 * No authentication here; in production this endpoint should be
 * protected at the network/ingress layer (not exposed publicly).
 */
export function metricsHandler(c: Context) {
  const body = renderPrometheus();
  return c.text(body, 200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
  });
}
