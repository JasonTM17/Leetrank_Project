import { describe, it, expect, beforeEach } from "vitest";
import { cache } from "@/lib/cache";
import { queue } from "@/lib/queue";
import { enqueueCacheBust, enqueueRecomputeStats } from "@/lib/jobs";

describe("job handlers", () => {
  beforeEach(() => {
    cache.clear();
  });

  it("cache-bust scope=problems wipes problem caches", async () => {
    cache.set("problems:list:::1:50", { x: 1 }, 60_000);
    cache.set("trending:10", [{ id: "p" }], 60_000);

    enqueueCacheBust("problems");
    await queue.drain();

    expect(cache.get("problems:list:::1:50")).toBeUndefined();
    expect(cache.get("trending:10")).toBeUndefined();
  });

  it("cache-bust scope=leaderboard wipes leaderboard:top only", async () => {
    cache.set("leaderboard:top", [{ rank: 1 }], 60_000);
    cache.set("contests:all", [{ id: "c1" }], 60_000);

    enqueueCacheBust("leaderboard");
    await queue.drain();

    expect(cache.get("leaderboard:top")).toBeUndefined();
    expect(cache.get("contests:all")).toBeTruthy(); // untouched
  });

  it("cache-bust scope=all wipes both", async () => {
    cache.set("problems:list:::1:50", { x: 1 }, 60_000);
    cache.set("leaderboard:top", [{ rank: 1 }], 60_000);

    enqueueCacheBust("all");
    await queue.drain();

    expect(cache.get("problems:list:::1:50")).toBeUndefined();
    expect(cache.get("leaderboard:top")).toBeUndefined();
  });

  it("recompute-stats logs and resolves without throwing", async () => {
    const id = enqueueRecomputeStats("smoke-test");
    expect(id).toMatch(/^j_\d+$/);
    await queue.drain();
    // Stub handler — no observable side-effect yet, but the queue
    // should report the job processed.
    expect(queue.stats().failed).toBe(0);
  });
});
