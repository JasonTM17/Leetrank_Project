import { describe, it, expect, beforeEach } from "vitest";
import { cache } from "@/lib/cache";
import {
  invalidateProblemsCache,
  invalidateContestsCache,
  invalidateTagsCache,
  invalidateLeaderboardCache,
} from "@/lib/cache-invalidate";

describe("cache invalidation helpers", () => {
  beforeEach(() => {
    cache.clear();
  });

  it("invalidateContestsCache drops contests:all", () => {
    cache.set("contests:all", [{ id: "c1" }], 60_000);
    expect(cache.get("contests:all")).toBeTruthy();
    invalidateContestsCache();
    expect(cache.get("contests:all")).toBeUndefined();
  });

  it("invalidateTagsCache drops tags:all", () => {
    cache.set("tags:all", [{ id: "t1" }], 60_000);
    invalidateTagsCache();
    expect(cache.get("tags:all")).toBeUndefined();
  });

  it("invalidateLeaderboardCache drops leaderboard:top", () => {
    cache.set("leaderboard:top", [{ rank: 1 }], 60_000);
    invalidateLeaderboardCache();
    expect(cache.get("leaderboard:top")).toBeUndefined();
  });

  it("invalidateProblemsCache sweeps the common problems:list slots", () => {
    cache.set("problems:list:::1:50", { problems: [], total: 0, page: 1, limit: 50 }, 60_000);
    cache.set("problems:list:::1:20", { problems: [], total: 0, page: 1, limit: 20 }, 60_000);
    cache.set("problems:list:::5:50", { problems: [], total: 0, page: 5, limit: 50 }, 60_000);

    invalidateProblemsCache();

    expect(cache.get("problems:list:::1:50")).toBeUndefined();
    expect(cache.get("problems:list:::1:20")).toBeUndefined();
    expect(cache.get("problems:list:::5:50")).toBeUndefined();
  });

  it("invalidateProblemsCache also sweeps trending slots", () => {
    cache.set("trending:10", [{ id: "p1" }], 60_000);
    cache.set("trending:20", [{ id: "p2" }], 60_000);
    cache.set("trending:30", [{ id: "p3" }], 60_000);

    invalidateProblemsCache();

    expect(cache.get("trending:10")).toBeUndefined();
    expect(cache.get("trending:20")).toBeUndefined();
    expect(cache.get("trending:30")).toBeUndefined();
  });

  it("invalidateProblemsCache leaves unrelated keys intact", () => {
    cache.set("contests:all", [{ id: "c1" }], 60_000);
    cache.set("tags:all", [{ id: "t1" }], 60_000);
    cache.set("leaderboard:top", [{ rank: 1 }], 60_000);

    invalidateProblemsCache();

    expect(cache.get("contests:all")).toBeTruthy();
    expect(cache.get("tags:all")).toBeTruthy();
    expect(cache.get("leaderboard:top")).toBeTruthy();
  });
});
