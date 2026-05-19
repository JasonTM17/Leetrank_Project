import { describe, it, expect } from "vitest";
import {
  computePercentile,
  runtimeDistribution,
  bucketIndexFor,
} from "@/lib/analytics-helpers";

describe("computePercentile", () => {
  it("returns 0 for an empty population", () => {
    expect(computePercentile(100, [])).toBe(0);
  });

  it("returns 0 for negative or non-finite runtimes", () => {
    expect(computePercentile(-1, [10, 20, 30])).toBe(0);
    expect(computePercentile(Number.NaN, [10, 20])).toBe(0);
    expect(computePercentile(Number.POSITIVE_INFINITY, [10, 20])).toBe(0);
  });

  it("counts strictly slower runtimes only", () => {
    // 50ms beats two of [100, 100, 50] -> 2/3 = 66.7
    expect(computePercentile(50, [100, 100, 50])).toBe(66.7);
  });

  it("returns 100 when the runtime is the fastest", () => {
    expect(computePercentile(1, [10, 20, 30, 40])).toBe(100);
  });

  it("returns 0 when the runtime is the slowest", () => {
    expect(computePercentile(40, [10, 20, 30, 40])).toBe(0);
  });

  it("rounds to one decimal place", () => {
    // 1 of 3 strictly slower -> 33.33... -> 33.3
    expect(computePercentile(20, [10, 20, 30])).toBe(33.3);
  });

  it("ignores invalid entries inside the population", () => {
    expect(computePercentile(50, [100, Number.NaN, -5, 25])).toBe(50);
  });

  it("handles a single-element population", () => {
    expect(computePercentile(10, [20])).toBe(100);
    expect(computePercentile(20, [10])).toBe(0);
    expect(computePercentile(10, [10])).toBe(0); // tie -> not beaten
  });
});

describe("runtimeDistribution", () => {
  it("returns the requested number of buckets even when empty", () => {
    const result = runtimeDistribution([], 10);
    expect(result).toHaveLength(10);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });

  it("places identical values into the first bucket only", () => {
    const result = runtimeDistribution([5, 5, 5, 5], 4);
    expect(result).toHaveLength(4);
    expect(result[0].count).toBe(4);
    expect(result.slice(1).every((b) => b.count === 0)).toBe(true);
    expect(result[0].min).toBe(5);
    expect(result[0].max).toBe(5);
  });

  it("distributes values into evenly-spaced buckets", () => {
    // Values 0..99 across 10 buckets -> ~10 per bucket.
    const values = Array.from({ length: 100 }, (_, i) => i);
    const result = runtimeDistribution(values, 10);
    expect(result).toHaveLength(10);
    const total = result.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(100);
    // First bucket gets 0..9, last gets 90..99 inclusive.
    expect(result[0].count).toBe(10);
    expect(result[9].count).toBe(10);
  });

  it("places the maximum value into the final bucket", () => {
    const result = runtimeDistribution([0, 100], 5);
    // 0 -> bucket 0, 100 -> bucket 4 (clamped).
    expect(result[0].count).toBe(1);
    expect(result[4].count).toBe(1);
  });

  it("skips invalid runtimes silently", () => {
    const result = runtimeDistribution([10, Number.NaN, -5, 20, 30], 3);
    const total = result.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(3);
  });

  it("clamps the bucket count to a minimum of 1", () => {
    const result = runtimeDistribution([1, 2, 3], 0);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
  });

  it("defaults to 20 buckets", () => {
    const result = runtimeDistribution([1, 2, 3]);
    expect(result).toHaveLength(20);
  });
});

describe("bucketIndexFor", () => {
  it("returns -1 for an empty distribution", () => {
    expect(bucketIndexFor(50, [])).toBe(-1);
  });

  it("returns -1 for non-finite or negative runtimes", () => {
    const dist = runtimeDistribution([0, 100], 5);
    expect(bucketIndexFor(Number.NaN, dist)).toBe(-1);
    expect(bucketIndexFor(-1, dist)).toBe(-1);
  });

  it("locates the runtime in the correct bucket", () => {
    const dist = runtimeDistribution([0, 100], 5);
    expect(bucketIndexFor(0, dist)).toBe(0);
    expect(bucketIndexFor(100, dist)).toBe(4);
    expect(bucketIndexFor(50, dist)).toBe(2);
  });

  it("returns -1 for values outside the distribution range", () => {
    const dist = runtimeDistribution([10, 20], 2);
    expect(bucketIndexFor(5, dist)).toBe(-1);
    expect(bucketIndexFor(50, dist)).toBe(-1);
  });
});
