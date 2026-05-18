/**
 * @file load-test.mjs
 * Deterministic load-test harness for the LeetRank API.
 *
 * Usage:
 *   node scripts/load-test.mjs [--target <url>] [--scenario <name>] [--duration <s>]
 *
 * Requires: autocannon (npm install --save-dev autocannon)
 */

import autocannon from "autocannon";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  smokeUrls,
  stressUrls,
  contestStormUrl,
} from "./load-test-fixtures.mjs";

// ── ANSI colour helpers ───────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

/**
 * Wraps text in ANSI colour codes.
 *
 * @param {string} text
 * @param {string} colour - One of the keys in the C object.
 * @returns {string}
 */
function colour(text, colour) {
  return `${colour}${text}${C.reset}`;
}

// ── CLI argument parsing ──────────────────────────────────────────────────────

/**
 * @typedef {'smoke' | 'stress' | 'contest-storm'} ScenarioName
 */

/**
 * @typedef {Object} CliOptions
 * @property {string} target    - Base URL of the API under test.
 * @property {ScenarioName} scenario - Which scenario to run.
 * @property {number} duration  - Duration in seconds (overrides scenario default).
 */

/**
 * Parses `--key value` pairs from process.argv.
 *
 * @returns {CliOptions}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  /** @type {Record<string, string>} */
  const map = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const val = args[i + 1];
    if (key && key.startsWith("--") && val !== undefined) {
      map[key.slice(2)] = val;
    }
  }

  const validScenarios = /** @type {ScenarioName[]} */ ([
    "smoke",
    "stress",
    "contest-storm",
  ]);
  const scenario = /** @type {ScenarioName} */ (map.scenario ?? "smoke");
  if (!validScenarios.includes(scenario)) {
    console.error(
      colour(
        `Unknown scenario "${scenario}". Valid: ${validScenarios.join(", ")}`,
        C.red
      )
    );
    process.exit(1);
  }

  return {
    target: map.target ?? "http://localhost:4000",
    scenario,
    duration: map.duration ? parseInt(map.duration, 10) : 0,
  };
}

// ── SLO definitions ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} Slo
 * @property {number} p95Ms        - Maximum allowed p95 latency in milliseconds.
 * @property {number} errorRatePct - Maximum allowed error rate as a percentage.
 */

/** @type {Record<ScenarioName, Slo>} */
const SLOS = {
  smoke: { p95Ms: 200, errorRatePct: 0.1 },
  stress: { p95Ms: 500, errorRatePct: 1 },
  "contest-storm": { p95Ms: 800, errorRatePct: 5 },
};

// ── Result helpers ────────────────────────────────────────────────────────────

/**
 * @typedef {import('autocannon').Result} AutocannonResult
 */

/**
 * Computes the error rate percentage from an autocannon result.
 *
 * @param {AutocannonResult} result
 * @returns {number}
 */
function errorRatePct(result) {
  const total = result.requests.total;
  if (total === 0) return 0;
  return ((result.errors + result.non2xx) / total) * 100;
}

/**
 * Checks a single result against the SLO and returns a pass/fail verdict.
 *
 * @param {AutocannonResult} result
 * @param {Slo} slo
 * @returns {{ passed: boolean; p95Ms: number; errPct: number }}
 */
function checkSlo(result, slo) {
  const p95Ms = result.latency.p95;
  const errPct = errorRatePct(result);
  const passed = p95Ms <= slo.p95Ms && errPct <= slo.errorRatePct;
  return { passed, p95Ms, errPct };
}

/**
 * Prints a formatted summary table for a single autocannon result.
 *
 * @param {string} label
 * @param {AutocannonResult} result
 * @param {Slo} slo
 */
function printSummary(label, result, slo) {
  const { passed, p95Ms, errPct } = checkSlo(result, slo);
  const status = passed
    ? colour("PASS", C.green)
    : colour("FAIL", C.red);

  console.log(`\n${colour(label, C.bold + C.cyan)}`);
  console.log(colour("─".repeat(60), C.dim));
  console.log(
    `  Requests/sec : ${colour(String(Math.round(result.requests.mean)), C.bold)}`
  );
  console.log(
    `  Latency p50  : ${result.latency.p50} ms`
  );
  console.log(
    `  Latency p95  : ${
      p95Ms > slo.p95Ms
        ? colour(`${p95Ms} ms  (SLO: ${slo.p95Ms} ms)`, C.red)
        : colour(`${p95Ms} ms`, C.green)
    }`
  );
  console.log(
    `  Latency p99  : ${result.latency.p99} ms`
  );
  console.log(
    `  Errors       : ${result.errors}  |  Non-2xx: ${result.non2xx}`
  );
  console.log(
    `  Error rate   : ${
      errPct > slo.errorRatePct
        ? colour(`${errPct.toFixed(3)}%  (SLO: ${slo.errorRatePct}%)`, C.red)
        : colour(`${errPct.toFixed(3)}%`, C.green)
    }`
  );
  console.log(`  Total reqs   : ${result.requests.total}`);
  console.log(`  Duration     : ${result.duration} s`);
  console.log(`  SLO          : ${status}`);
}

// ── Output persistence ────────────────────────────────────────────────────────

/**
 * Writes the results array to a timestamped JSON file under load-test-results/.
 *
 * @param {ScenarioName} scenario
 * @param {AutocannonResult[]} results
 * @returns {string} Absolute path of the written file.
 */
function persistResults(scenario, results) {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const outDir = join(__dir, "..", "load-test-results");
  mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${scenario}-${timestamp}.json`;
  const outPath = join(outDir, filename);

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        scenario,
        generatedAt: new Date().toISOString(),
        slo: SLOS[scenario],
        results: results.map((r) => ({
          title: r.title,
          url: r.url,
          duration: r.duration,
          connections: r.connections,
          requests: r.requests,
          latency: r.latency,
          throughput: r.throughput,
          errors: r.errors,
          non2xx: r.non2xx,
          timeouts: r.timeouts,
        })),
      },
      null,
      2
    )
  );

  return outPath;
}

// ── Scenario runners ──────────────────────────────────────────────────────────

/**
 * Wraps autocannon in a promise.
 *
 * @param {import('autocannon').Options} opts
 * @returns {Promise<AutocannonResult>}
 */
function run(opts) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(opts, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    autocannon.track(instance, { renderProgressBar: true });
  });
}

/**
 * Smoke scenario: 10 RPS for `duration` seconds on each of the four core
 * endpoints, run sequentially.
 *
 * @param {string} target
 * @param {number} duration - Seconds per endpoint.
 * @returns {Promise<AutocannonResult[]>}
 */
async function runSmoke(target, duration) {
  const urls = smokeUrls(target);
  /** @type {AutocannonResult[]} */
  const results = [];

  for (const { name, url } of urls) {
    console.log(
      `\n${colour(`[smoke] ${name}`, C.cyan)}  ${colour(url, C.dim)}`
    );
    const result = await run({
      title: `smoke:${name}`,
      url,
      connections: 1,
      // rate: requests per second per connection
      // With connections=1 this gives exactly 10 RPS.
      rate: 10,
      duration,
    });
    results.push(result);
  }

  return results;
}

/**
 * Stress scenario: ramp from 50 to 500 connections over `duration` seconds
 * across /problems and /contests, run in parallel phases.
 *
 * @param {string} target
 * @param {number} duration - Total seconds for the ramp.
 * @returns {Promise<AutocannonResult[]>}
 */
async function runStress(target, duration) {
  const urls = stressUrls(target);
  const phases = [50, 150, 300, 500];
  const phaseSeconds = Math.max(1, Math.floor(duration / phases.length));

  /** @type {AutocannonResult[]} */
  const results = [];

  for (const connections of phases) {
    console.log(
      `\n${colour(`[stress] connections=${connections}`, C.cyan)}  (${phaseSeconds}s)`
    );
    // Run all stress URLs in parallel within each phase.
    const phaseResults = await Promise.all(
      urls.map(({ name, url }) =>
        run({
          title: `stress:${name}:conn${connections}`,
          url,
          connections,
          duration: phaseSeconds,
        })
      )
    );
    results.push(...phaseResults);
  }

  return results;
}

/**
 * Contest-storm scenario: 50 concurrent virtual users hitting /problems/random
 * for `duration` seconds.
 *
 * @param {string} target
 * @param {number} duration
 * @returns {Promise<AutocannonResult[]>}
 */
async function runContestStorm(target, duration) {
  const url = contestStormUrl(target);
  console.log(
    `\n${colour("[contest-storm] /problems/random", C.cyan)}  ${colour(url, C.dim)}`
  );
  const result = await run({
    title: "contest-storm:random",
    url,
    connections: 50,
    duration,
  });
  return [result];
}

// ── SLO aggregation ───────────────────────────────────────────────────────────

/**
 * Aggregates multiple results into a single worst-case SLO check.
 * Uses the maximum p95 and maximum error rate across all results.
 *
 * @param {AutocannonResult[]} results
 * @param {Slo} slo
 * @returns {{ passed: boolean; worstP95Ms: number; worstErrPct: number }}
 */
function aggregateSlo(results, slo) {
  let worstP95Ms = 0;
  let worstErrPct = 0;

  for (const r of results) {
    const p95Ms = r.latency.p95;
    const errPct = errorRatePct(r);
    if (p95Ms > worstP95Ms) worstP95Ms = p95Ms;
    if (errPct > worstErrPct) worstErrPct = errPct;
  }

  const passed =
    worstP95Ms <= slo.p95Ms && worstErrPct <= slo.errorRatePct;
  return { passed, worstP95Ms, worstErrPct };
}

// ── Entry point ───────────────────────────────────────────────────────────────

/** Default durations per scenario in seconds. */
const DEFAULT_DURATIONS = {
  smoke: 30,
  stress: 60,
  "contest-storm": 30,
};

async function main() {
  const opts = parseArgs();
  const duration =
    opts.duration > 0 ? opts.duration : DEFAULT_DURATIONS[opts.scenario];
  const slo = SLOS[opts.scenario];

  console.log(colour("\nLeetRank API Load Test", C.bold));
  console.log(colour("═".repeat(60), C.dim));
  console.log(`  Target   : ${colour(opts.target, C.cyan)}`);
  console.log(`  Scenario : ${colour(opts.scenario, C.bold)}`);
  console.log(`  Duration : ${duration}s`);
  console.log(
    `  SLO      : p95 < ${slo.p95Ms}ms, error-rate < ${slo.errorRatePct}%`
  );

  /** @type {AutocannonResult[]} */
  let results;

  switch (opts.scenario) {
    case "smoke":
      results = await runSmoke(opts.target, duration);
      break;
    case "stress":
      results = await runStress(opts.target, duration);
      break;
    case "contest-storm":
      results = await runContestStorm(opts.target, duration);
      break;
    default:
      // Exhaustive check — TypeScript would catch this; JSDoc narrows it.
      console.error(colour(`Unhandled scenario: ${opts.scenario}`, C.red));
      process.exit(1);
  }

  // ── Per-result summaries ──────────────────────────────────────────────────

  console.log(colour("\n\nResults", C.bold));
  console.log(colour("═".repeat(60), C.dim));
  for (const r of results) {
    printSummary(r.title ?? r.url, r, slo);
  }

  // ── Aggregate SLO verdict ─────────────────────────────────────────────────

  const { passed, worstP95Ms, worstErrPct } = aggregateSlo(results, slo);

  console.log(colour("\n\nAggregate SLO", C.bold));
  console.log(colour("═".repeat(60), C.dim));
  console.log(
    `  Worst p95    : ${
      worstP95Ms > slo.p95Ms
        ? colour(`${worstP95Ms} ms  (limit: ${slo.p95Ms} ms)`, C.red)
        : colour(`${worstP95Ms} ms`, C.green)
    }`
  );
  console.log(
    `  Worst err%   : ${
      worstErrPct > slo.errorRatePct
        ? colour(
            `${worstErrPct.toFixed(3)}%  (limit: ${slo.errorRatePct}%)`,
            C.red
          )
        : colour(`${worstErrPct.toFixed(3)}%`, C.green)
    }`
  );
  console.log(
    `  Verdict      : ${
      passed
        ? colour("ALL SLOs PASSED", C.bold + C.green)
        : colour("SLO BREACH — see details above", C.bold + C.red)
    }`
  );

  // ── Persist JSON report ───────────────────────────────────────────────────

  const outPath = persistResults(opts.scenario, results);
  console.log(
    `\n  Report saved : ${colour(outPath, C.dim)}\n`
  );

  if (!passed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(colour(`\nFatal error: ${err.message}`, C.red));
  process.exit(1);
});
