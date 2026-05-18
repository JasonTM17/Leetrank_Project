// env MUST be the first import — it validates process.env and exits on failure.
import "./env.js";
import { env } from "./env.js";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { requestContext } from "./middleware/request-context.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthHandler } from "./routes/health.js";
import { metricsHandler } from "./routes/metrics.js";
import { leaderboardTopHandler } from "./routes/leaderboard.js";
import { tagsHandler } from "./routes/tags.js";
import { tagDetailHandler } from "./routes/tags-detail.js";
import { contestsHandler } from "./routes/contests.js";
import { contestsActiveHandler } from "./routes/contests-active.js";
import { contestsUpcomingHandler } from "./routes/contests-upcoming.js";
import { contestDetailHandler } from "./routes/contests-detail.js";
import { problemsListHandler, problemDetailHandler } from "./routes/problems.js";
import { trendingHandler, randomHandler } from "./routes/trending.js";
import { statsHandler } from "./routes/stats.js";
import logger from "./logger.js";

/**
 * LeetRank API service.
 *
 * Standalone HTTP server consumed by apps/web and external clients.
 */

const app = new Hono();

// ── Middleware (order matters) ────────────────────────────────────────────────

// 1. Structured request logging + request-ID + Prometheus counters.
app.use("*", requestContext);

// 2. CORS — tightened defaults.
const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  logger.warn(
    "CORS_ALLOWED_ORIGINS is empty in production — all cross-origin requests will be rejected"
  );
}

app.use(
  "*",
  cors({
    origin: (origin) => {
      // No Origin header = same-origin or non-browser request; no CORS needed.
      if (!origin) return null;

      // Explicit allowlist takes precedence in all environments.
      if (allowedOrigins.length > 0) {
        return allowedOrigins.includes(origin) ? origin : null;
      }

      // Production with empty allowlist → reject all cross-origin.
      if (env.NODE_ENV === "production") {
        return null;
      }

      // Dev/test: allow localhost and 127.0.0.1 on any port.
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return origin;
      }

      return null;
    },
    credentials: true,
  })
);

// 3. Body size limit — 512 KB ceiling on mutating methods (preventative).
app.on(
  ["POST", "PUT", "PATCH"],
  "*",
  bodyLimit({
    maxSize: 512 * 1024,
    onError: (c) => c.json({ error: "Request body too large" }, 413),
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/", (c) =>
  c.json({
    service: "leetrank-api",
    version: "0.1.0",
    docs: "/api/openapi",
  })
);

app.get("/health", healthHandler);
app.get("/metrics", metricsHandler);

app.get("/stats", statsHandler);
app.get("/leaderboard/top", leaderboardTopHandler);
app.get("/tags", tagsHandler);
// Static sub-paths must register before the :slug catch-all.
app.get("/tags/:slug", tagDetailHandler);
app.get("/contests", contestsHandler);
// Static sub-paths must register before the :slug catch-all so they
// don't get swallowed as values for the slug param.
app.get("/contests/active", contestsActiveHandler);
app.get("/contests/upcoming", contestsUpcomingHandler);
app.get("/contests/:slug", contestDetailHandler);
app.get("/problems", problemsListHandler);
app.get("/problems/trending", trendingHandler);
app.get("/problems/random", randomHandler);
app.get("/problems/:slug", problemDetailHandler);

// ── Error handling ────────────────────────────────────────────────────────────

app.onError(errorHandler);
app.notFound(notFoundHandler);

// ── Server bootstrap ──────────────────────────────────────────────────────────

if (env.NODE_ENV !== "test") {
  const httpServer = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
    logger.info("leetrank-api started", { port: info.port });
  });

  // Graceful shutdown: SIGTERM (k8s/compose stop) and SIGINT (Ctrl-C).
  // Drain in-flight requests, then close prisma, then exit. Bounded by a
  // 15s hard timeout — the orchestrator's own SIGKILL window is usually 30s.
  const SHUTDOWN_TIMEOUT_MS = 15_000;
  const shutdown = (signal: NodeJS.Signals) => {
    logger.info("shutting down", { signal });
    const killTimer = setTimeout(() => {
      logger.error("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    killTimer.unref();

    httpServer.close(async (closeErr) => {
      if (closeErr) {
        logger.error("http server close error", { error: closeErr.message });
      }
      try {
        // Side-effect import — db.ts singleton may or may not be loaded
        // depending on which routes were hit. Disconnect best-effort.
        const { prisma } = await import("./db.js");
        await prisma.$disconnect();
      } catch (err) {
        logger.error("prisma disconnect error", {
          error: err instanceof Error ? err.message : "unknown",
        });
      }
      logger.info("shutdown complete");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export { app };
