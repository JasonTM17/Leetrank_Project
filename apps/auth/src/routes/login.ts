import type { Context } from "hono";

/**
 * Login endpoint — Phase 3.1 placeholder.
 *
 * Returns 501 Not Implemented so that:
 *  1. Caddy can already route /api/v1/auth/* to this service.
 *  2. The frontend receives a structured error rather than a 404 or
 *     connection refused, making the migration state visible.
 *  3. The real implementation (Phase 3.1.5) can be dropped in here
 *     without any routing or infrastructure changes.
 *
 * Both GET and POST are handled so browser preflight + form submissions
 * both get a clean response.
 */

const NOT_IMPLEMENTED = {
  error: "Not implemented yet — auth migration in progress",
} as const;

export function loginHandler(c: Context) {
  return c.json(NOT_IMPLEMENTED, 501);
}
