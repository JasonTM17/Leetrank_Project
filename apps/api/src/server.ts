import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { leaderboardTopHandler } from "./routes/leaderboard.js";
import { tagsHandler } from "./routes/tags.js";
import { contestsHandler } from "./routes/contests.js";

/**
 * LeetRank API service.
 *
 * Standalone HTTP server consumed by apps/web and external clients.
 * The first vertical slice migrated here is the read-only leaderboard
 * (planned per docs/adr/0011). Until the migration completes, the
 * canonical handlers continue to live in apps/web/src/app/api — this
 * service is opt-in via WEB_API_PROXY_BASE.
 */

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      // Allow exact-match origins from the env list. In dev the web app
      // is same-origin so an empty allowlist (default) is fine.
      if (allowed.length === 0) return origin ?? "*";
      return allowed.includes(origin ?? "") ? origin ?? null : null;
    },
    credentials: true,
  })
);

app.get("/", (c) =>
  c.json({
    service: "leetrank-api",
    version: "0.1.0",
    docs: "/api/openapi",
  })
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "leetrank-api",
    timestamp: new Date().toISOString(),
  })
);

app.get("/leaderboard/top", leaderboardTopHandler);
app.get("/tags", tagsHandler);
app.get("/contests", contestsHandler);

const port = Number(process.env.API_PORT ?? 4000);

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    // eslint-disable-next-line no-console
    console.log(`leetrank-api listening on :${info.port}`);
  });
}

export { app };
