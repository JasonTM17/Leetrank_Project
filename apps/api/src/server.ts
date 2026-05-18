import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
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

const port = Number(process.env.API_PORT ?? 4000);

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port }, (info) => {
    // eslint-disable-next-line no-console
    console.log(`leetrank-api listening on :${info.port}`);
  });
}

export { app };
