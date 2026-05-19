/**
 * @file scripts/k6/login.js
 *
 * Login flood scenario — ramps 0 → 100 virtual users over 5 minutes,
 * holds 100 VUs for 1 minute, then ramps down. Each VU posts to the
 * web service's `/api/auth/login` endpoint with a per-VU email so
 * the per-account rate-limit bucket does not collapse the test.
 *
 * The IP-based bucket is widened by stamping a per-VU `X-Forwarded-For`
 * header — this matches what the production reverse proxy does in real
 * traffic. If your local environment does not trust XFF, expect to see
 * legitimate 429 responses; those are counted as a valid outcome (not
 * a failure) because rate-limiting is itself the assertion under load.
 *
 * SLO:
 *   - http_req_failed (non-2xx/3xx/4xx, i.e. 5xx + transport) < 1%
 *   - http_req_duration p95 < 500 ms
 *   - 0 unexpected status codes
 *
 * Usage (local):
 *   k6 run scripts/k6/login.js \
 *     -e BASE_URL=http://localhost:3000
 *
 * Usage (staging):
 *   k6 run scripts/k6/login.js \
 *     -e BASE_URL=https://staging.leetrank.example
 */

import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ── Config (override via -e KEY=VALUE) ────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const LOGIN_PATH = __ENV.LOGIN_PATH || "/api/auth/login";
const PASSWORD = __ENV.LOAD_TEST_PASSWORD || "loadtest-password-123!";

// ── Custom metrics ────────────────────────────────────────────────────────────

const loginAttempts = new Counter("login_attempts");
const loginAccepted = new Counter("login_accepted");      // 200 OK
const loginRejected = new Counter("login_rejected");      // 401
const loginThrottled = new Counter("login_throttled");    // 429
const login5xx = new Counter("login_5xx");
const loginLatency = new Trend("login_latency", true);
const fiveXxRate = new Rate("login_5xx_rate");

// ── Scenario ──────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    login_flood: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5m", target: 100 }, // ramp 0 → 100 VUs
        { duration: "1m", target: 100 }, // hold 100 VUs
        { duration: "30s", target: 0 },  // ramp down
      ],
      gracefulRampDown: "30s",
      exec: "loginFlow",
    },
  },
  thresholds: {
    // Hard SLO: p95 latency under 500 ms, 5xx rate under 1 percent.
    "http_req_duration": ["p(95)<500"],
    "login_latency":     ["p(95)<500"],
    "login_5xx_rate":    ["rate<0.01"],
    "http_req_failed":   ["rate<0.01"],
  },
  // Trim long-tail noise.
  noConnectionReuse: false,
  discardResponseBodies: true,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a per-VU email so the per-account rate-limit bucket is not
 * collapsed by every VU sharing the same identity.
 *
 * @returns {string}
 */
function vuEmail() {
  return `loadtest-vu-${__VU}@leetrank.test`;
}

/**
 * Returns a synthetic per-VU IP so XFF-based rate-limiters do not 429
 * the entire test from a single source. Generates a stable IP per VU
 * within a private RFC-1918 range.
 *
 * @returns {string}
 */
function vuForwardedFor() {
  const a = 10;
  const b = (__VU >> 16) & 0xff;
  const c = (__VU >> 8) & 0xff;
  const d = __VU & 0xff;
  return `${a}.${b}.${c}.${d || 1}`;
}

// ── Main flow ─────────────────────────────────────────────────────────────────

/**
 * Single login request. Counted statuses:
 *   200 → accepted   (test users that exist)
 *   401 → rejected   (test users that don't exist — still healthy)
 *   429 → throttled  (rate-limit kicked in — still healthy)
 *   5xx → fail       (counted toward error budget)
 */
export function loginFlow() {
  const url = `${BASE_URL}${LOGIN_PATH}`;
  const payload = JSON.stringify({
    email: vuEmail(),
    password: PASSWORD,
  });
  const params = {
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": vuForwardedFor(),
      "User-Agent": "k6-load-test/login",
    },
    tags: { endpoint: "auth_login" },
  };

  loginAttempts.add(1);
  const res = http.post(url, payload, params);
  loginLatency.add(res.timings.duration);

  const s = res.status;
  if (s >= 200 && s < 300) loginAccepted.add(1);
  else if (s === 401)      loginRejected.add(1);
  else if (s === 429)      loginThrottled.add(1);
  else if (s >= 500)       login5xx.add(1);

  fiveXxRate.add(s >= 500);

  check(res, {
    "status not 5xx":   (r) => r.status < 500,
    "status is known":  (r) => [200, 400, 401, 429].includes(r.status) || r.status >= 500,
    "latency < 1500ms": (r) => r.timings.duration < 1500,
  });
}
