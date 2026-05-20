/**
 * Stress profile — ramp up to find the saturation point.
 *
 *   k6 run scripts/loadtest/stress.js
 *
 * Goes from 0 → 200 VUs over 10 minutes hitting the same public surface
 * as smoke.js. Useful to find the throughput knee before a release. NOT
 * safe in CI — intended to run from a workstation against a staging URL.
 */
import http from "k6/http";
import { check, group, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 20 },
        { duration: "2m", target: 50 },
        { duration: "3m", target: 100 },
        { duration: "2m", target: 200 },
        { duration: "2m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // Looser bounds than smoke — we expect tail latency to grow at 200 VUs.
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    http_req_failed: ["rate<0.05"],
  },
};

const WEIGHTED = [
  { path: "/api/problems?page=1&limit=20", weight: 40 },
  { path: "/api/leaderboard/top", weight: 20 },
  { path: "/api/contests", weight: 15 },
  { path: "/api/tags", weight: 10 },
  { path: "/api/problems/trending", weight: 10 },
  { path: "/api/health", weight: 5 },
];

function pickWeighted() {
  const total = WEIGHTED.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const entry of WEIGHTED) {
    if ((r -= entry.weight) < 0) return entry.path;
  }
  return WEIGHTED[0].path;
}

export default function stressTest() {
  group("weighted reads", () => {
    const path = pickWeighted();
    const res = http.get(`${BASE_URL}${path}`, { tags: { name: path } });
    check(res, { "ok": (r) => r.status === 200 });
  });
  sleep(Math.random() * 0.5);
}
