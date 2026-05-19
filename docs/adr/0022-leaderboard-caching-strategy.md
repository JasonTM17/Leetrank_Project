# 22. Leaderboard caching strategy: Redis sorted set with Postgres source of truth

Date: 2026-05-19

## Status

Accepted.

## Context

The `/leaderboard/top` and `/leaderboard/around-me` endpoints are the highest-traffic reads on the platform. Two access patterns dominate:

1. **Top-N global.** Home page widget, contest sidebar, public profile page — millions of reads against a list that changes seconds-to-minutes.
2. **Rank lookup.** "Where am I on the global leaderboard?" — every authenticated page renders this in the user header.

Today (Phase 2), both queries hit Postgres directly. The query is roughly:

```sql
SELECT user_id, rating, ROW_NUMBER() OVER (ORDER BY rating DESC) AS rank
FROM users
WHERE rating IS NOT NULL
ORDER BY rating DESC
LIMIT $1 OFFSET $2;
```

This is fine at our current ~10 K user scale (P95 < 50 ms). At 1 M users — the planning target for end of year — it becomes a sustained problem:

- `ORDER BY rating DESC` over 1 M rows is `O(N log N)` per query unless an index covers the predicate. With `WHERE rating IS NOT NULL` and an index on `(rating DESC NULLS LAST)`, Postgres can use an index scan, but rank lookup ("position of user X") still requires a count of users with `rating > $X`.
- Per-page-load rank lookups for every authenticated user during contest hour saturate the connection pool.
- Postgres has no native sorted-set type; emulating one with `ROW_NUMBER()` window functions is correct but expensive.

## Decision

Adopt a **two-tier strategy**:

1. **Postgres remains the source of truth.** Rating columns on `users` are the canonical data. Every rating change writes to Postgres first, transactionally with the `RatingChange` audit row.
2. **Redis sorted set is the read cache.** A `ZSET` keyed `lb:global` mirrors `(user_id → rating)`. Reads go to Redis exclusively; the Postgres path is only used to repopulate Redis on a cold start or invalidation.

### Wire surface

| Operation | Postgres | Redis | Notes |
|-----------|----------|-------|-------|
| Top-N | full ORDER BY (cold-start only) | `ZREVRANGE lb:global 0 N-1 WITHSCORES` | `O(log N + N)` |
| Rank of user X | `COUNT WHERE rating > X` (cold-start only) | `ZREVRANK lb:global <user_id>` | `O(log N)` |
| Around-me | `WHERE rating BETWEEN ...` (cold-start only) | `ZREVRANGEBYSCORE` with offsets | `O(log N + M)` |
| Update rating | `UPDATE users SET rating ...` | `ZADD lb:global <new_rating> <user_id>` | dual-write |

### Per-contest leaderboards

Live contest leaderboards use a separate `ZSET` per contest (`lb:contest:<id>`), populated as submissions are accepted. The same dual-write pattern applies. The contest ZSET is dropped 24 h after the contest ends (Redis TTL) — historical contest standings live in Postgres.

### Write path

Rating updates are the only path that mutates `lb:global`. The contest-finalise worker runs the Glicko-2 update (see [ADR 0021](0021-rating-algorithm.md)), then writes both stores in a single function:

```go
tx, _ := db.Begin(ctx)
db.Exec(ctx, "UPDATE users SET rating = $1, ... WHERE id = $2", newRating, userID)
db.Exec(ctx, "INSERT INTO rating_changes ...")
tx.Commit()
redis.ZAdd(ctx, "lb:global", &redis.Z{Score: float64(newRating), Member: userID})
```

The Redis write happens after the Postgres commit. If the Redis write fails, the next read for that user falls back to a single-user lookup against Postgres and re-populates the cache. Eventual consistency is acceptable for leaderboard rendering.

### Cold start and invalidation

- On boot, `lb:global` is repopulated from Postgres via `ZADD` in batches of 5 000.
- A daily cron rebuilds `lb:global` from scratch as a self-heal against drift.
- Manual invalidation: `DEL lb:global` — next reader pays the rebuild cost.

## Consequences

**Positive:**

- Top-N latency drops from ~30 ms to under 1 ms (Redis local socket).
- Rank lookup goes from `O(N)` to `O(log N)` and survives 1 M-user scale comfortably.
- Postgres connection pool is no longer the bottleneck on hot traffic — frees it for write paths.
- Same primitive (sorted set) handles global, weekly, and per-contest boards.

**Negative:**

- Two stores to keep in sync. We accept eventual consistency on this surface.
- Operational complexity: Redis must be up for the leaderboard to render. Mitigated by the Postgres fallback path.
- Memory cost: ~1 M users × ~80 bytes = ~80 MB of Redis memory. Trivial on the smallest production tier.

**Neutral:**

- The Postgres schema is unchanged; Redis is purely additive.

## Failure modes

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Redis down | Leaderboard endpoints 503 | Caddy fallback returns a stale cached page; users see "leaderboard refreshing"; alert fires |
| Redis up but stale | Slightly outdated rankings | Daily rebuild cron + per-user repopulation on miss |
| Postgres down during dual-write | Rating change lost | Update is wrapped in a transaction; only commits to Redis if Postgres commit succeeds |
| ZSET key evicted under memory pressure | Cold-start rebuild | Configure Redis with `maxmemory-policy noeviction` for production |

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Postgres-only with a covering index | Works at current scale; predictable hot-spot at 1 M users. Cheaper to do this right now than retrofit. |
| Materialised view in Postgres | `REFRESH MATERIALIZED VIEW` is `O(N)` and locks. Solves top-N but not rank-of-user. |
| ClickHouse / BigQuery | Massive overkill for a `ORDER BY rating LIMIT N` query. |
| Application-level in-memory cache | Doesn't survive restarts; multi-replica gives split-brain rankings. |
