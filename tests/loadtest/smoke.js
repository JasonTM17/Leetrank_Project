/**
 * Smoke load test for the public API.
 *
 *   docker run --rm -i grafana/k6 run - < scripts/loadtest/smoke.js
 *
 * Targets the read-only public surface so it's safe to run against any
 * environment (no writes, no auth). Fails the run if p95 > 500ms or
 * error rate > 1%, so CI can gate on it.
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const errorRate = new Rate("errors");

export const options = {
  scenarios: {
    smoke: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.01"],
  },
};

export default function smokeTest() {
  group("public reads", () => {
    const endpoints = [
      "/api/health",
      "/api/problems?page=1&limit=20",
      "/api/contests",
      "/api/leaderboard/top",
      "/api/tags",
      "/api/problems/trending",
    ];
    for (const path of endpoints) {
      const res = http.get(`${BASE_URL}${path}`, { tags: { name: path } });
      const ok = check(res, {
        [`${path} status 200`]: (r) => r.status === 200,
        [`${path} json`]: (r) => r.headers["Content-Type"]?.includes("application/json"),
      });
      errorRate.add(!ok);
    }
  });

  sleep(1);
}
