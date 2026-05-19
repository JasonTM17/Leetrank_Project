/**
 * Analytics helpers for submission runtime statistics.
 *
 * Pure, dependency-free functions used by the percentile API and UI to
 * answer "Beat X% of submissions" — i.e. given an accepted submission's
 * runtime, where does it land among the population of accepted runtimes
 * for the same problem + language?
 *
 * These are intentionally split out so they can be unit-tested in
 * isolation and reused by both server (API route) and client (component
 * fallback) code paths.
 */

/**
 * Compute the percentile of `runtime` against `allRuntimes`.
 *
 * The convention follows what users expect from "Beat X% of
 * submissions": a smaller (faster) runtime should yield a HIGHER
 * percentile. So `percentile = 100 * (count(slower) / total)` where
 * "slower" means strictly greater runtime. Ties are excluded from the
 * "beat" count so two identical runtimes don't claim to beat each
 * other.
 *
 * Edge cases:
 * - Empty array -> 0 (nothing to compare against).
 * - Negative or non-finite runtime -> 0 (not a meaningful submission).
 * - If `runtime` itself is not in `allRuntimes`, we still compute
 *   relative to the population — callers may pass a hypothetical
 *   value.
 */
export function computePercentile(runtime: number, allRuntimes: number[]): number {
  if (!Array.isArray(allRuntimes) || allRuntimes.length === 0) return 0;
  if (!Number.isFinite(runtime) || runtime < 0) return 0;

  let beaten = 0;
  let total = 0;
  for (const r of allRuntimes) {
    if (!Number.isFinite(r) || r < 0) continue;
    total++;
    if (r > runtime) beaten++;
  }
  if (total === 0) return 0;
  // Round to one decimal place — UI shows "Beat 89.4%" rather than
  // "89.41666...%". Avoid trailing-zero noise by trimming.
  const pct = (beaten / total) * 100;
  return Math.round(pct * 10) / 10;
}

export interface DistributionBucket {
  /** Lower bound of the bucket (inclusive). */
  min: number;
  /** Upper bound of the bucket (exclusive, except for the last one). */
  max: number;
  /** 0-based bucket index. */
  bucket: number;
  /** Number of runtimes that fell into this bucket. */
  count: number;
}

/**
 * Bucket `runtimes` into evenly-spaced bins between min and max for a
 * histogram. Always returns exactly `buckets` entries (even if some are
 * empty) so the chart has a consistent shape.
 *
 * Guarantees:
 * - Returns `buckets` entries — never more, never fewer.
 * - The last bucket includes its upper bound so `max` lands somewhere.
 * - For a single distinct value, all entries land in the first bucket
 *   and the rest are zero. This is intentionally simple — picking
 *   "natural" bin widths for degenerate inputs is a rabbit hole.
 *
 * @param runtimes Raw runtime values (ms). Non-finite/negative values
 *   are skipped silently.
 * @param buckets Number of buckets to produce. Must be >= 1; defaults
 *   to 20 to roughly match the LeetCode runtime histogram.
 */
export function runtimeDistribution(
  runtimes: number[],
  buckets = 20,
): DistributionBucket[] {
  const safeBuckets = Math.max(1, Math.floor(buckets));
  const valid = runtimes.filter((r) => Number.isFinite(r) && r >= 0);

  if (valid.length === 0) {
    return Array.from({ length: safeBuckets }, (_, i) => ({
      min: 0,
      max: 0,
      bucket: i,
      count: 0,
    }));
  }

  const min = Math.min(...valid);
  const max = Math.max(...valid);

  // Degenerate range: every value identical. Put them all in bucket 0
  // and emit empty trailing buckets so the chart still has shape.
  if (min === max) {
    return Array.from({ length: safeBuckets }, (_, i) => ({
      min,
      max,
      bucket: i,
      count: i === 0 ? valid.length : 0,
    }));
  }

  const width = (max - min) / safeBuckets;
  const counts = new Array<number>(safeBuckets).fill(0);
  for (const r of valid) {
    let idx = Math.floor((r - min) / width);
    // The exact max value would otherwise land in bucket `safeBuckets`;
    // clamp it into the last bucket.
    if (idx >= safeBuckets) idx = safeBuckets - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }

  return counts.map((count, i) => ({
    min: min + width * i,
    max: i === safeBuckets - 1 ? max : min + width * (i + 1),
    bucket: i,
    count,
  }));
}

/**
 * Convenience: which bucket index does `runtime` fall into for the
 * given distribution? Returns -1 if the value is out of range or
 * the distribution is empty.
 *
 * Used by the UI to highlight the user's own submission in the
 * histogram.
 */
export function bucketIndexFor(
  runtime: number,
  distribution: DistributionBucket[],
): number {
  if (!Number.isFinite(runtime) || runtime < 0) return -1;
  if (!distribution.length) return -1;
  for (let i = 0; i < distribution.length; i++) {
    const b = distribution[i];
    const isLast = i === distribution.length - 1;
    if (runtime >= b.min && (isLast ? runtime <= b.max : runtime < b.max)) {
      return i;
    }
  }
  return -1;
}
