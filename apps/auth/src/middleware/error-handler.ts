import type { Context, NotFoundHandler, ErrorHandler } from "hono";
import logger from "../logger.js";

/**
 * Central error handler — catches any unhandled error thrown in a route.
 *
 * Security: stack traces and raw error messages are NEVER sent to the client.
 * Stack traces are also NOT logged in production — they leak code paths and
 * line numbers that help attackers map the codebase. In dev they're useful;
 * in prod we log message + class only.
 */
const isDev = process.env.NODE_ENV !== "production";

export const errorHandler: ErrorHandler = (err, c: Context) => {
  const requestId = (c.get("requestId") as string | undefined) ?? "unknown";

  logger.error("unhandled error", {
    requestId,
    error: err.message,
    errorClass: err.constructor.name,
    ...(isDev ? { stack: err.stack } : {}),
  });

  return c.json(
    { error: "Internal server error", requestId },
    500
  );
};

/**
 * 404 handler for routes that don't match any registered path.
 */
export const notFoundHandler: NotFoundHandler = (c: Context) => {
  const requestId = (c.get("requestId") as string | undefined) ?? "unknown";
  return c.json({ error: "Not Found", requestId }, 404);
};
