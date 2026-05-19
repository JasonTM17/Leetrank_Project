#!/usr/bin/env node
/**
 * @file scripts/perf/compare.mjs
 *
 * Compares the current k6 summary export against a stored baseline and
 * fails the process if p95 latency or error rate has regressed by more
 * than the configured percentage.
 *
 * Used by .github/workflows/perf.yml.
 *
 * Usage:
 *   node scripts/perf/compare.mjs \
 *     --current perf-results/login.json \
 *     --baseline baseline/login.json \
 *     --threshold 20
 *
 * Exit codes:
 *   0 — within threshold
 *   1 — regression detected
 *   2 — input error
 */

import { readFileSync, existsSync } from "node:fs";

function parseArgs() {
  const args = process.argv.slice(2);
  const map = {};
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i];
    const v = args[i + 1];
    if (k && k.startsWith("--") && v !== undefined) map[k.slice(2)] = v;
  }
  if (!map.current || !map.baseline) {
    console.error("usage: compare.mjs --current <file> --baseline <file> [--threshold <pct>]");
    process.exit(2);
  }
  return {
    current: map.current,
    baseline: map.baseline,
    threshold: Number(map.threshold ?? 20),
  };
}

/**
 * Reads a k6 summary-export JSON and pulls out the metrics we care about.
 *
 * @param {string} path
 * @returns {{ p95: number; errRate: number }}
 */
function load(path) {
  if (!existsSync(path)) {
    console.error(`File not found: ${path}`);
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(path, "utf8"));
  const metrics = data.metrics ?? {};
  const dur = metrics.http_req_duration?.values ?? {};
  const failed = metrics.http_req_failed?.values ?? {};
  return {
    p95: Number(dur["p(95)"] ?? dur.p95 ?? 0),
    errRate: Number(failed.rate ?? 0),
  };
}

function pct(curr, base) {
  if (base === 0) return curr === 0 ? 0 : Infinity;
  return ((curr - base) / base) * 100;
}

function main() {
  const opts = parseArgs();
  const cur = load(opts.current);
  const base = load(opts.baseline);

  const p95Delta = pct(cur.p95, base.p95);
  const errDelta = pct(cur.errRate, base.errRate);

  console.log("=== Perf comparison ===");
  console.log(`p95 latency : ${base.p95.toFixed(1)}ms -> ${cur.p95.toFixed(1)}ms (${p95Delta >= 0 ? "+" : ""}${p95Delta.toFixed(1)}%)`);
  console.log(`error rate  : ${(base.errRate * 100).toFixed(3)}% -> ${(cur.errRate * 100).toFixed(3)}% (${errDelta >= 0 ? "+" : ""}${errDelta.toFixed(1)}%)`);
  console.log(`threshold   : ${opts.threshold}%`);

  const regressed =
    p95Delta > opts.threshold ||
    errDelta > opts.threshold;

  if (regressed) {
    console.error(`REGRESSION: change exceeds ${opts.threshold}% threshold`);
    process.exit(1);
  }
  console.log("OK: no regression beyond threshold");
}

main();
