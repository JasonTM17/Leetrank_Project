/**
 * @file scripts/k6/submission-storm.js
 *
 * Submission storm scenario — 50 concurrent virtual users posting code
 * submissions over 2 minutes. Mirrors what happens during the opening
 * minute of a contest when every contestant submits at once.
 *
 * What it tests:
 *   - The Next.js `/api/submissions` route (or, when configured via
 *     SUBMISSIONS_PATH, the Go submissions service directly).
 *   - The judge fan-out: queue → worker → callback.
 *   - The auth path under load (each VU acquires a JWT first, then reuses it).
 *
 * SLO:
 *   - http_req_duration p95 < 500 ms (dispatch latency, not judge latency)
 *   - http_req_failed (5xx + transport) < 1%
 *   - submission_5xx_rate < 1%
 *
 * Note on auth: the script first calls /api/auth/login and reuses the
 * cookie. If login fails (e.g. test users not seeded), the VU falls
 * back to anonymous mode and counts the inevitable 401s separately
 * — the SLO only fails on 5xx.
 *
 * Usage:
 *   k6 run scripts/k6/submission-storm.js \
 *     -e BASE_URL=http://localhost:3000
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const LOGIN_PATH = __ENV.LOGIN_PATH || "/api/auth/login";
const SUBMISSIONS_PATH = __ENV.SUBMISSIONS_PATH || "/api/submissions";
const PASSWORD = __ENV.LOAD_TEST_PASSWORD || "loadtest-password-123!";
const PROBLEM_ID = __ENV.PROBLEM_ID || "two-sum";

// ── Custom metrics ────────────────────────────────────────────────────────────

const submissionAttempts = new Counter("submission_attempts");
const submissionAccepted = new Counter("submission_accepted");
const submissionThrottled = new Counter("submission_throttled");
const submissionUnauth = new Counter("submission_unauth");
const submission5xx = new Counter("submission_5xx");
const submissionLatency = new Trend("submission_latency", true);
const fiveXxRate = new Rate("submission_5xx_rate");

// ── Scenario ──────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    submission_storm: {
      executor: "constant-vus",
      vus: 50,
      duration: "2m",
      exec: "submitFlow",
    },
  },
  thresholds: {
    "http_req_duration":     ["p(95)<500"],
    "submission_latency":    ["p(95)<500"],
    "submission_5xx_rate":   ["rate<0.01"],
    "http_req_failed":       ["rate<0.01"],
  },
};

// ── Reference solution per language. Intentionally minimal — judge
// behaviour is not what we're measuring; dispatch latency is. ────────────────

const SOLUTIONS = {
  python: `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
`,
  javascript: `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
}
`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function vuEmail() {
  return `loadtest-vu-${__VU}@leetrank.test`;
}

function vuForwardedFor() {
  const b = (__VU >> 16) & 0xff;
  const c = (__VU >> 8) & 0xff;
  const d = __VU & 0xff;
  return `10.${b}.${c}.${d || 1}`;
}

function pickLanguage() {
  return Math.random() < 0.5 ? "python" : "javascript";
}

/**
 * Logs the VU in once and caches the cookie jar for the rest of the run.
 * If login fails, returns null and the VU runs anonymously.
 *
 * @returns {string | null}
 */
function loginOnce() {
  const res = http.post(
    `${BASE_URL}${LOGIN_PATH}`,
    JSON.stringify({ email: vuEmail(), password: PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": vuForwardedFor(),
      },
      tags: { endpoint: "auth_login_setup" },
    }
  );
  if (res.status === 200) {
    // k6 keeps cookies in the per-VU jar automatically; return a marker so
    // the caller knows we are authenticated.
    return "ok";
  }
  return null;
}

// Per-VU one-time setup. k6 calls this once at VU start, not per iteration.
let authState = "uninit";

// ── Main flow ─────────────────────────────────────────────────────────────────

export function submitFlow() {
  if (authState === "uninit") {
    authState = loginOnce() ?? "anon";
  }

  const lang = pickLanguage();
  const payload = JSON.stringify({
    problemId: PROBLEM_ID,
    language: lang,
    code: SOLUTIONS[lang],
  });
  const params = {
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": vuForwardedFor(),
      "User-Agent": "k6-load-test/submission-storm",
    },
    tags: { endpoint: "submissions" },
  };

  submissionAttempts.add(1);
  const res = http.post(`${BASE_URL}${SUBMISSIONS_PATH}`, payload, params);
  submissionLatency.add(res.timings.duration);

  const s = res.status;
  if (s >= 200 && s < 300)      submissionAccepted.add(1);
  else if (s === 401 || s === 403) submissionUnauth.add(1);
  else if (s === 429)           submissionThrottled.add(1);
  else if (s >= 500)            submission5xx.add(1);

  fiveXxRate.add(s >= 500);

  check(res, {
    "status not 5xx":  (r) => r.status < 500,
    "latency < 2s":    (r) => r.timings.duration < 2000,
  });

  // Light think-time so we don't melt the host CPU.
  sleep(Math.random() * 0.5);
}
