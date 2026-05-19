/**
 * @file scripts/k6/leaderboard-read.js
 *
 * Leaderboard read scenario — 200 concurrent virtual users hitting
 * `GET /api/leaderboard` continuously for 3 minutes. The leaderboard
 * is the heaviest read-only path on the platform and is also the one
 * users hit most frequently during contests, so we exercise it at a
 * higher VU count than login or submissions.
 *
 * SLO:
 *   - http_req_duration p95 < 500 ms
 *   - http_req_failed (5xx + transport) < 1%
 *   - leaderboard_5xx_rate < 1%
 *
 * Behaviour notes:
 *   - Mixes pagination (`page`, `limit`) and timeframe filters
 *     (`scope=global|weekly|monthly`) to avoid an unrealistically
 *     hot single-key cache hit pattern.
 *   - Honours both the Next.js `/api/leaderboard` route and, when
 *     LEADERBOARD_PATH is overridden, the Rust leaderboard service
 *     directly (typically port 4014).
 *
 * Usage:
 *   k6 run scripts/k6/leaderboard-read.js \
 *     -e BASE_URL=http://localhost:3000
 *
 * Hit the Rust service directly:
 *   k6 run scripts/k6/leaderboard-read.js \
 *     -e BASE_URL=http://localhost:4014 \
 *     -e LEADERBOARD_PATH=/leaderboard/top
 */

import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const LEADERBOARD_PATH = __ENV.LEADERBOARD_PATH || "/api/leaderboard";

// ── Custom metrics ────────────────────────────────────────────────────────────

const requests = new Counter("leaderboard_requests");
const ok2xx = new Counter("leaderboard_2xx");
const client4xx = new Counter("leaderboard_4xx");
const fail5xx = new Counter("leaderboard_5xx");
const latency = new Trend("leaderboard_latency", true);
const fiveXxRate = new Rate("leaderboard_5xx_rate");

// ── Scenario ──────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    leaderboard_read: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 200 }, // ramp up
        { duration: "3m",  target: 200 }, // sustained read pressure
        { duration: "30s", target: 0 },   // ramp down
      ],
      gracefulRampDown: "20s",
      exec: "readLeaderboard",
    },
  },
  thresholds: {
    "http_req_duration":      ["p(95)<500"],
    "leaderboard_latency":    ["p(95)<500"],
    "leaderboard_5xx_rate":   ["rate<0.01"],
    "http_req_failed":        ["rate<0.01"],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCOPES = ["global", "weekly", "monthly"];
const PAGE_SIZES = [10, 20, 50];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Builds a varied query string so each request exercises a different
 * cache key — otherwise the test degenerates into a single hot path.
 *
 * @returns {string}
 */
function leaderboardQuery() {
  const params = new URLSearchParams();
  params.set("page", String(randInt(1, 20)));
  params.set("limit", String(pick(PAGE_SIZES)));
  // ~40 percent of requests scope to a non-global window.
  if (Math.random() < 0.4) {
    params.set("scope", pick(SCOPES));
  }
  return `?${params.toString()}`;
}

// ── Main flow ─────────────────────────────────────────────────────────────────

export function readLeaderboard() {
  const url = `${BASE_URL}${LEADERBOARD_PATH}${leaderboardQuery()}`;
  const params = {
    headers: {
      "Accept": "application/json",
      "User-Agent": "k6-load-test/leaderboard-read",
    },
    tags: { endpoint: "leaderboard" },
  };

  requests.add(1);
  const res = http.get(url, params);
  latency.add(res.timings.duration);

  const s = res.status;
  if (s >= 200 && s < 300)      ok2xx.add(1);
  else if (s >= 400 && s < 500) client4xx.add(1);
  else if (s >= 500)            fail5xx.add(1);
  fiveXxRate.add(s >= 500);

  check(res, {
    "status 200":      (r) => r.status === 200,
    "latency < 1s":    (r) => r.timings.duration < 1000,
    "body has data":   (r) => r.body && r.body.length > 0,
  });
}
