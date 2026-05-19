import { logger } from "./logger";

const warned = new Set<string>();

/**
 * Read an environment variable with a development fallback.
 *
 * If the variable is set, it is returned verbatim. If it is missing, the
 * supplied dev fallback is returned. In production (`NODE_ENV === "production"`)
 * a missing variable also emits a one-shot warning so misconfigured deploys
 * surface in the logs instead of silently calling localhost endpoints.
 *
 * Designed to drop into module-scope lookups that previously used
 * `process.env.X || "http://localhost:..."`. Keeps dev DX intact while
 * making prod misconfiguration visible.
 */
export function envOr(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;

  if (process.env.NODE_ENV === "production" && !warned.has(name)) {
    warned.add(name);
    logger.warn("env: required variable missing in production, using fallback", {
      name,
      fallback: devFallback,
    });
  }
  return devFallback;
}
