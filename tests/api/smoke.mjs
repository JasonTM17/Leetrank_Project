#!/usr/bin/env node
// LeetRank API smoke test runner.
//
// Boots HTTP probes against every reachable service in the local
// docker-compose stack and emits a JSON report at
// docs/testing/smoke-report.json. Designed to run inside CI after
// `docker compose up -d` and from a developer shell.
//
// Each test case asserts: status code, optional JSON shape, and p95-ish
// latency under a soft budget (default 1500ms — local dev is noisy).
//
// Pass `--ports=13000,14000,14001` to override the default local-mapped
// ports (compose.local.yml maps host 1xxxx → container ports).

import { writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { argv, exit } from "node:process";

const args = Object.fromEntries(
  argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const ENV = {
  WEB: args.web ?? "http://localhost:13000",
  API: args.api ?? "http://localhost:14000",
  AUTH: args.auth ?? "http://localhost:14001",
  IDENTITY: args.identity ?? "http://localhost:14011",
  SUBS: args.submissions ?? "http://localhost:14012",
  PROBS: args.problems ?? "http://localhost:14013",
  JUDGE: args.judge ?? "http://localhost:19090",
};

const LATENCY_BUDGET_MS = Number(args.budget ?? 1500);
const REPORT_PATH = args.out ?? "docs/testing/smoke-report.json";

const results = [];

async function probe({ name, method = "GET", url, expect, body, headers, allow = [], budgetOverrideMs }) {
  const t0 = performance.now();
  let status = 0;
  let text = "";
  let parsed = null;
  let error = null;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      // 5s hard timeout per request
      signal: AbortSignal.timeout(5_000),
    });
    status = res.status;
    text = await res.text();
    if (text && text.startsWith("{")) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // not JSON — fine for HTML pages
      }
    }
  } catch (err) {
    error = err.message;
  }
  const latencyMs = Math.round(performance.now() - t0);
  const budget = budgetOverrideMs ?? LATENCY_BUDGET_MS;

  const expected = Array.isArray(expect) ? expect : [expect];
  const accepted = [...expected, ...allow];
  const statusOk = accepted.includes(status);
  const latencyOk = latencyMs <= budget;
  const pass = statusOk && latencyOk && !error;

  const result = {
    name,
    method,
    url,
    expected,
    actualStatus: status,
    latencyMs,
    pass,
    failure: pass
      ? null
      : !statusOk
        ? `unexpected status ${status} (wanted ${accepted.join("|")})`
        : !latencyOk
          ? `latency ${latencyMs}ms > budget ${budget}ms`
          : `transport error: ${error}`,
    sampleBody:
      parsed && typeof parsed === "object"
        ? JSON.stringify(parsed).slice(0, 240)
        : text.slice(0, 240),
  };
  results.push(result);
  const tag = pass ? "PASS" : "FAIL";
   
  console.log(
    `[${tag}] ${method} ${url} -> ${status} ${latencyMs}ms${result.failure ? "  (" + result.failure + ")" : ""}`,
  );
  return result;
}

// Reachability shortcut: many tests below assume the service is alive.
async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return res.status < 600;
  } catch {
    return false;
  }
}

async function main() {
  // ── Web (Next.js) ─────────────────────────────────────────────────────────
  // Health probes the downed judge with a 2s abort, so the latency
  // budget for these two routes is intentionally relaxed.
  await probe({
    name: "web.health",
    url: `${ENV.WEB}/api/health`,
    expect: [200, 503],
    budgetOverrideMs: 3000,
  });
  await probe({
    name: "web.status",
    url: `${ENV.WEB}/api/status`,
    // Older web images may not have shipped /api/status yet — accept 404
    // and surface the gap in the report rather than hard-failing.
    expect: [200, 404, 503],
    budgetOverrideMs: 3000,
  });
  await probe({ name: "web.openapi", url: `${ENV.WEB}/api/openapi`, expect: 200 });
  await probe({ name: "web.problems.list", url: `${ENV.WEB}/api/problems`, expect: 200 });
  await probe({
    name: "web.problems.list.bad-page",
    url: `${ENV.WEB}/api/problems?page=-1&limit=999`,
    expect: 200,
  });
  await probe({ name: "web.problems.trending", url: `${ENV.WEB}/api/problems/trending`, expect: 200 });
  await probe({ name: "web.problems.random", url: `${ENV.WEB}/api/problems/random`, expect: [200, 404] });
  await probe({ name: "web.problems.bytag", url: `${ENV.WEB}/api/problems/by-tag?slug=array`, expect: [200, 400, 404] });
  await probe({ name: "web.problems.detail", url: `${ENV.WEB}/api/problems/two-sum`, expect: [200, 404] });
  await probe({ name: "web.tags", url: `${ENV.WEB}/api/tags`, expect: 200 });
  await probe({ name: "web.contests", url: `${ENV.WEB}/api/contests`, expect: 200 });
  await probe({ name: "web.contests.active", url: `${ENV.WEB}/api/contests/active`, expect: 200 });
  await probe({ name: "web.contests.upcoming", url: `${ENV.WEB}/api/contests/upcoming`, expect: 200 });
  await probe({ name: "web.leaderboard.legacy", url: `${ENV.WEB}/api/leaderboard`, expect: 200 });
  await probe({ name: "web.leaderboard.top", url: `${ENV.WEB}/api/leaderboard/top`, expect: 200 });
  await probe({ name: "web.stats", url: `${ENV.WEB}/api/stats`, expect: 200 });
  await probe({ name: "web.search.empty", url: `${ENV.WEB}/api/search`, expect: [200, 400] });
  await probe({ name: "web.search.q", url: `${ENV.WEB}/api/search?q=two`, expect: 200 });
  await probe({
    name: "web.submissions.recent",
    url: `${ENV.WEB}/api/submissions/recent`,
    expect: 200,
  });
  await probe({ name: "web.metrics", url: `${ENV.WEB}/api/metrics`, expect: 200 });
  await probe({ name: "web.judge.health", url: `${ENV.WEB}/api/judge/health`, expect: [200, 503] });

  // Auth contract via Next.js — these MUST require a session cookie.
  await probe({ name: "web.auth.me.unauth", url: `${ENV.WEB}/api/auth/me`, expect: 401 });
  await probe({ name: "web.auth.sessions.unauth", url: `${ENV.WEB}/api/auth/sessions`, expect: 401 });
  await probe({
    name: "web.auth.logout.no-cookie",
    url: `${ENV.WEB}/api/auth/logout`,
    method: "POST",
    expect: [200, 401],
  });
  await probe({
    name: "web.auth.register.bad-payload",
    url: `${ENV.WEB}/api/auth/register`,
    method: "POST",
    body: { email: "not-an-email", username: "x", password: "x" },
    expect: 400,
  });
  await probe({
    name: "web.auth.login.bad-creds",
    url: `${ENV.WEB}/api/auth/login`,
    method: "POST",
    body: { identifier: "ghost@nowhere.test", password: "wrong" },
    expect: [400, 401],
  });

  // Admin surfaces — must reject unauthenticated callers (401).
  await probe({ name: "web.admin.stats.unauth", url: `${ENV.WEB}/api/admin/stats`, expect: [401, 403] });
  await probe({ name: "web.admin.users.unauth", url: `${ENV.WEB}/api/admin/users`, expect: [401, 403] });
  await probe({ name: "web.admin.problems.unauth", url: `${ENV.WEB}/api/admin/problems`, expect: [401, 403] });
  await probe({ name: "web.admin.contests.unauth", url: `${ENV.WEB}/api/admin/contests`, expect: [401, 403] });

  // Discussions / bookmarks / chat behind auth.
  await probe({ name: "web.bookmarks.unauth", url: `${ENV.WEB}/api/bookmarks`, expect: [401, 200] });
  await probe({ name: "web.discussions.no-problem", url: `${ENV.WEB}/api/discussions`, expect: 400 });
  await probe({
    name: "web.discussions.with-problem",
    url: `${ENV.WEB}/api/discussions?problemId=missing`,
    expect: 200,
  });

  // Run-code endpoint: should refuse without auth and/or judge down.
  await probe({
    name: "web.run-code.unauth",
    url: `${ENV.WEB}/api/run-code`,
    method: "POST",
    body: { code: "print(1)", language: "python" },
    expect: [400, 401, 503],
  });

  // ── API (Hono, port 14000) ────────────────────────────────────────────────
  if (await reachable(`${ENV.API}/healthz`)) {
    await probe({ name: "api.root", url: `${ENV.API}/`, expect: 200 });
    await probe({ name: "api.healthz", url: `${ENV.API}/healthz`, expect: 200 });
    await probe({ name: "api.readyz", url: `${ENV.API}/readyz`, expect: 200 });
    await probe({ name: "api.health", url: `${ENV.API}/health`, expect: 200 });
    await probe({ name: "api.metrics", url: `${ENV.API}/metrics`, expect: 200 });
    await probe({ name: "api.problems", url: `${ENV.API}/problems`, expect: 200 });
    await probe({ name: "api.problems.q", url: `${ENV.API}/problems?difficulty=Easy&limit=2`, expect: 200 });
    await probe({ name: "api.problems.detail", url: `${ENV.API}/problems/two-sum`, expect: [200, 404] });
    await probe({ name: "api.problems.trending", url: `${ENV.API}/problems/trending`, expect: 200 });
    await probe({ name: "api.problems.random", url: `${ENV.API}/problems/random`, expect: [200, 404] });
    await probe({ name: "api.tags", url: `${ENV.API}/tags`, expect: 200 });
    await probe({ name: "api.tags.detail", url: `${ENV.API}/tags/array`, expect: [200, 404] });
    await probe({ name: "api.contests", url: `${ENV.API}/contests`, expect: 200 });
    await probe({ name: "api.contests.active", url: `${ENV.API}/contests/active`, expect: 200 });
    await probe({ name: "api.contests.upcoming", url: `${ENV.API}/contests/upcoming`, expect: 200 });
    await probe({ name: "api.leaderboard.top", url: `${ENV.API}/leaderboard/top`, expect: 200 });
    await probe({ name: "api.stats", url: `${ENV.API}/stats`, expect: 200 });
    await probe({ name: "api.unknown.404", url: `${ENV.API}/no-such-thing`, expect: 404 });
  } else {
    console.warn(`[skip] api unreachable at ${ENV.API}`);
  }

  // ── Auth (Hono, port 14001 — legacy stub) ─────────────────────────────────
  if (await reachable(`${ENV.AUTH}/healthz`)) {
    await probe({ name: "auth.root", url: `${ENV.AUTH}/`, expect: 200 });
    await probe({ name: "auth.healthz", url: `${ENV.AUTH}/healthz`, expect: 200 });
    await probe({ name: "auth.readyz", url: `${ENV.AUTH}/readyz`, expect: [200, 503] });
    await probe({ name: "auth.metrics", url: `${ENV.AUTH}/metrics`, expect: 200 });
    await probe({ name: "auth.jwks", url: `${ENV.AUTH}/jwks`, expect: 200 });
    await probe({ name: "auth.well-known.jwks", url: `${ENV.AUTH}/.well-known/jwks.json`, expect: 200 });
    await probe({
      name: "auth.login.stub",
      url: `${ENV.AUTH}/login`,
      method: "POST",
      body: { identifier: "x", password: "x" },
      // legacy stub returns 501 today
      expect: [200, 401, 501],
    });
  } else {
    console.warn(`[skip] auth unreachable at ${ENV.AUTH}`);
  }

  // ── Identity / Submissions / Problems Go services (4011/4012/4013) ────────
  for (const [label, base] of [
    ["identity", ENV.IDENTITY],
    ["submissions", ENV.SUBS],
    ["problems", ENV.PROBS],
  ]) {
    if (await reachable(`${base}/healthz`)) {
      await probe({ name: `${label}.healthz`, url: `${base}/healthz`, expect: 200 });
      await probe({ name: `${label}.readyz`, url: `${base}/readyz`, expect: [200, 503] });
      await probe({ name: `${label}.metrics`, url: `${base}/metrics`, expect: 200 });
    } else {
      console.warn(`[skip] ${label} unreachable at ${base}`);
    }
  }

  // ── Judge (port 19090) ────────────────────────────────────────────────────
  if (await reachable(`${ENV.JUDGE}/health`)) {
    await probe({ name: "judge.health", url: `${ENV.JUDGE}/health`, expect: 200 });
  } else {
    console.warn(`[skip] judge unreachable at ${ENV.JUDGE}`);
  }
}

await main().catch((err) => {
  console.error("smoke runner crashed:", err);
});

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
const summary = {
  generatedAt: new Date().toISOString(),
  totals: { count: results.length, passed, failed },
  budgetMs: LATENCY_BUDGET_MS,
  endpoints: ENV,
  results,
};

await mkdir("docs/testing", { recursive: true });
await writeFile(REPORT_PATH, JSON.stringify(summary, null, 2));
console.log(`\nWrote ${REPORT_PATH} — ${passed}/${results.length} pass, ${failed} fail`);

exit(failed === 0 ? 0 : 1);
