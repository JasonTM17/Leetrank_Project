/**
 * Centralised cache-key invalidation helpers.
 *
 * Each of these matches the keying scheme used by a public route. Routes
 * pin their key shape in code (`leaderboard:top`, `problems:list:<...>`,
 * `tags:all`, `contests:all`, `trending:<limit>`); admin mutation handlers
 * call the matching helper here so the public read sees the change on the
 * next request instead of waiting for the TTL.
 *
 * For prefix-based families (problems list, trending), we sweep every
 * keyspace entry whose name starts with the prefix because the actual
 * key incorporates filter parameters.
 */
import { cache } from "./cache";

function deletePrefix(prefix: string) {
  // Snapshot so we don't mutate during iteration. The cache stat surface
  // does not currently expose its key set, so we approximate by emitting
  // the standard known scheme keys ourselves and letting cache.delete()
  // be a no-op for ones that don't exist.
  // For this simple LRU we walk the internal store lazily by attempting
  // delete on a precomputed list of common variants. A future Redis-backed
  // cache would use SCAN MATCH to do this properly.
  const variants = [
    `${prefix}`,
    `${prefix}:`,
    `${prefix}:1:50`,
    `${prefix}:1:20`,
  ];
  for (const v of variants) cache.delete(v);
  // The list-cache key shape is "problems:list:<diff>:<tag>:<page>:<limit>"
  // where diff and tag are often empty. Sweep the common (no-filter)
  // pages 1..10 to cover the homepage and most browse traffic without
  // a key-listing API.
  if (prefix === "problems:list") {
    for (let page = 1; page <= 10; page++) {
      for (const limit of [20, 50]) {
        cache.delete(`problems:list:::${page}:${limit}`);
      }
    }
  }
  if (prefix === "trending") {
    for (const limit of [10, 20, 30]) cache.delete(`trending:${limit}`);
  }
}

export function invalidateProblemsCache() {
  deletePrefix("problems:list");
  deletePrefix("trending");
}

export function invalidateContestsCache(slug?: string) {
  cache.delete("contests:all");
  if (slug) {
    cache.delete(`contests:detail:${slug}`);
  }
}

export function invalidateTagsCache() {
  cache.delete("tags:all");
}

export function invalidateLeaderboardCache() {
  cache.delete("leaderboard:top");
}
