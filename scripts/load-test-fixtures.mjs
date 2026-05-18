/**
 * @file load-test-fixtures.mjs
 * Generates realistic URL parameters for each load-test scenario.
 * Imported by load-test.mjs — no side effects on import.
 */

/** @typedef {'easy' | 'medium' | 'hard'} Difficulty */

/** Difficulties supported by /problems/random */
const DIFFICULTIES = /** @type {Difficulty[]} */ (["easy", "medium", "hard"]);

/** Tags that exist in the seed data */
const TAGS = [
  "array",
  "string",
  "hash-table",
  "dynamic-programming",
  "math",
  "sorting",
  "greedy",
  "depth-first-search",
  "binary-search",
  "tree",
];

/**
 * Returns a random integer in [min, max] (inclusive).
 *
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random element from an array.
 *
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a random query string for the /problems list endpoint.
 * Simulates realistic pagination and optional filtering.
 *
 * @returns {string} URL-encoded query string, e.g. "?page=3&limit=20"
 */
export function problemsQuery() {
  const page = randInt(1, 50);
  const limit = pick([10, 20, 25, 50]);
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });

  // ~30% of requests include a difficulty filter
  if (Math.random() < 0.3) {
    params.set("difficulty", pick(DIFFICULTIES));
  }

  // ~20% of requests include a tag filter
  if (Math.random() < 0.2) {
    params.set("tag", pick(TAGS));
  }

  return `?${params.toString()}`;
}

/**
 * Generates a random query string for the /problems/random endpoint.
 * Optionally filters by difficulty.
 *
 * @returns {string} URL-encoded query string, e.g. "?difficulty=medium"
 */
export function randomProblemQuery() {
  // ~60% of requests specify a difficulty
  if (Math.random() < 0.6) {
    return `?difficulty=${pick(DIFFICULTIES)}`;
  }
  return "";
}

/**
 * Generates a random query string for the /contests endpoint.
 * Simulates pagination.
 *
 * @returns {string} URL-encoded query string, e.g. "?page=2&limit=20"
 */
export function contestsQuery() {
  const page = randInt(1, 10);
  const limit = pick([10, 20]);
  return `?page=${page}&limit=${limit}`;
}

/**
 * Generates a random query string for the /leaderboard/top endpoint.
 * Optionally requests a specific page size.
 *
 * @returns {string} URL-encoded query string, e.g. "?limit=10"
 */
export function leaderboardQuery() {
  const limit = pick([10, 20, 50]);
  return `?limit=${limit}`;
}

/**
 * Builds a full URL list for the smoke scenario.
 * Each call returns a fresh set of randomised paths.
 *
 * @param {string} base - Base URL, e.g. "http://localhost:4000"
 * @returns {{ name: string; url: string }[]}
 */
export function smokeUrls(base) {
  return [
    { name: "health", url: `${base}/health` },
    { name: "stats", url: `${base}/stats` },
    { name: "problems", url: `${base}/problems${problemsQuery()}` },
    { name: "leaderboard/top", url: `${base}/leaderboard/top${leaderboardQuery()}` },
  ];
}

/**
 * Builds URL list for the stress scenario.
 *
 * @param {string} base
 * @returns {{ name: string; url: string }[]}
 */
export function stressUrls(base) {
  return [
    { name: "problems", url: `${base}/problems${problemsQuery()}` },
    { name: "contests", url: `${base}/contests${contestsQuery()}` },
  ];
}

/**
 * Builds the URL for the contest-storm scenario.
 *
 * @param {string} base
 * @returns {string}
 */
export function contestStormUrl(base) {
  return `${base}/problems/random${randomProblemQuery()}`;
}
