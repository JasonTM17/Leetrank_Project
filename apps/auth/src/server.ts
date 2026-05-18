// env MUST be the first import — it validates process.env and exits on failure.
import "./env.js";
import { env } from "./env.js";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { requestContext } from "./middleware/request-context.js";
import { timeout } from "./middleware/timeout.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthHandler, livenessHandler } from "./routes/health.js";
import { metricsHandler } from "./routes/metrics.js";
import { jwksHandler } from "./routes/jwks.js";
import { loginHandler } from "./routes/login.js";
import logger from "./logger.js";

/**
 * LeetRank auth service.
 *
 * Phase 3.1 scaffold — JWKS endpoint + 501 stubs for login/logout/refresh.
 * Real auth logic lands in Phase 3.1.5 once the migration from apps/web is
 * complete. See docs/adr/0016-leetrank-auth-service.md for the full plan.
 */

const app = new Hono();

// ── Middleware (order matters) ────────────────────────────────────────────────

// 1. Structured request logging + request-ID + Prometheus counters.
app.use("*", requestContext);

// 2. Global request timeout — 15 s is the outer guardrail for all routes.
app.use("*", timeout(15_000));

// 3. CORS — tightened defaults.
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

// 4. Body size limit — 512 KB ceiling on mutating methods (preventative).
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
    service: "leetrank-auth",
    version: "0.1.0",
    phase: "3.1-scaffold",
  })
);

// Health / readiness
app.get("/health", healthHandler);
app.get("/healthz", livenessHandler);
app.get("/readyz", healthHandler);

// Observability
app.get("/metrics", metricsHandler);

// JWKS — Phase 3.1 prereq (empty keys until Phase 3.1.1)
app.get("/jwks", jwksHandler);
app.get("/.well-known/jwks.json", jwksHandler);

// Auth stubs — return 501 until Phase 3.1.5
app.get("/login", loginHandler);
app.post("/login", loginHandler);

// ── Error handling ────────────────────────────────────────────────────────────

app.onError(errorHandler);
app.notFound(notFoundHandler);

// ── Server bootstrap ──────────────────────────────────────────────────────────

if (env.NODE_ENV !== "test") {
  const httpServer = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
    logger.info("leetrank-auth started", { port: info.port });
  });

  // Graceful shutdown: SIGTERM (k8s/compose stop) and SIGINT (Ctrl-C).
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
