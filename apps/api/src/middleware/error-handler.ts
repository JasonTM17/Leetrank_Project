import type { Context, NotFoundHandler, ErrorHandler } from "hono";
import logger from "../logger.js";

/**
 * Central error handler — catches any unhandled error thrown in a route.
 *
 * Security: stack traces and raw error messages are NEVER sent to the client.
 * They are logged server-side with the requestId for correlation.
 */
export const errorHandler: ErrorHandler = (err, c: Context) => {
  const requestId = (c.get("requestId") as string | undefined) ?? "unknown";

  logger.error("unhandled error", {
    requestId,
    error: err.message,
    stack: err.stack,
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
