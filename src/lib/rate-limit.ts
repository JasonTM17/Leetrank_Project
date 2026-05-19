// Rate limiter — Redis-backed sliding window (primary) with in-memory bucket
// fallback. The Redis path uses a sorted set keyed by `rl:<bucket>`: each call
// trims out-of-window members, appends a unique member at `now`, and returns
// the cardinality. ioredis is loaded lazily so the limiter degrades gracefully
// in environments where the dep isn't installed or REDIS_URL isn't set.

import crypto from "node:crypto";

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

let gcArmed = false;
function armGc() {
  if (gcArmed) return;
  gcArmed = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, w] of buckets) {
      if (now > w.resetAt) buckets.delete(k);
    }
  }, 5 * 60_000).unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

type RedisPipeline = {
  zremrangebyscore(k: string, min: number, max: number): RedisPipeline;
  zadd(k: string, score: number, member: string): RedisPipeline;
  zcard(k: string): RedisPipeline;
  pexpire(k: string, ttl: number): RedisPipeline;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
};

type RedisLike = {
  pipeline(): RedisPipeline;
  on(event: "error", listener: (err: Error) => void): unknown;
};

let redisClient: RedisLike | null = null;
let redisLoadAttempted = false;
let redisFallbackWarned = false;

async function getRedisClient(): Promise<RedisLike | null> {
  if (redisClient) return redisClient;
  if (redisLoadAttempted) return null;
  redisLoadAttempted = true;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const mod = (await import("ioredis")) as unknown as {
      default?: new (url: string) => RedisLike;
    } & (new (url: string) => RedisLike);
    const Ctor = (mod.default ?? mod) as unknown as new (url: string) => RedisLike;
    redisClient = new Ctor(url);
    redisClient.on("error", (err) => {
      if (!redisFallbackWarned) {
        console.warn("[rate-limit] redis error, falling back to memory:", err.message);
        redisFallbackWarned = true;
      }
    });
    return redisClient;
  } catch {
    if (!redisFallbackWarned) {
      console.warn("[rate-limit] ioredis unavailable, using in-memory limiter");
      redisFallbackWarned = true;
    }
    return null;
  }
}

function memoryCheck(key: string, max: number, windowMs: number): RateLimitResult {
  armGc();
  const now = Date.now();
  const w = buckets.get(key);
  if (!w || now > w.resetAt) {
    const next = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: max - 1, resetAt: next.resetAt };
  }
  if (w.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: w.resetAt,
      retryAfter: Math.max(1, Math.ceil((w.resetAt - now) / 1000)),
    };
  }
  w.count += 1;
  return { allowed: true, remaining: max - w.count, resetAt: w.resetAt };
}

async function redisCheck(
  client: RedisLike,
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const k = `rl:${key}`;
  const now = Date.now();
  const member = `${now}-${crypto.randomUUID()}`;
  const pipe = client.pipeline();
  pipe.zremrangebyscore(k, 0, now - windowMs);
  pipe.zadd(k, now, member);
  pipe.zcard(k);
  pipe.pexpire(k, windowMs);
  const res = await pipe.exec();
  if (!res) throw new Error("redis pipeline returned null");
  const cardEntry = res[2];
  if (!cardEntry) throw new Error("redis pipeline missing zcard result");
  if (cardEntry[0]) throw cardEntry[0];
  const count = Number(cardEntry[1] ?? 0);
  const resetAt = now + windowMs;
  if (count > max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }
  return { allowed: true, remaining: Math.max(0, max - count), resetAt };
}

/**
 * Synchronous, in-memory rate limit. Kept for backward compatibility with
 * callers that can't go async. Multi-instance deployments should use
 * `rateLimitAsync` so all replicas share state via Redis.
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  return memoryCheck(key, max, windowMs);
}

/**
 * Redis-backed rate limit with in-memory fallback. Prefer this in new code.
 * On any Redis error (connection refused, ioredis missing, malformed reply)
 * we fall back to the in-memory bucket and log a warning once per process.
 */
export async function rateLimitAsync(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const client = await getRedisClient();
  if (!client) return memoryCheck(key, max, windowMs);
  try {
    return await redisCheck(client, key, max, windowMs);
  } catch (err) {
    if (!redisFallbackWarned) {
      console.warn(
        "[rate-limit] redis check failed, falling back to memory:",
        (err as Error).message
      );
      redisFallbackWarned = true;
    }
    return memoryCheck(key, max, windowMs);
  }
}

// Test helpers — clear buckets and reset the lazy redis loader.
export function _resetRateLimit() {
  buckets.clear();
}

export function _resetRateLimitInternals() {
  buckets.clear();
  redisClient = null;
  redisLoadAttempted = false;
  redisFallbackWarned = false;
}
