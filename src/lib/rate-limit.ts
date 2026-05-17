// Lightweight, in-process rate limiter using a fixed-window counter per key.
// Lives in memory — fine for single-instance deployments. Multi-instance
// production should swap this for the Redis-backed limiter (the Redis client
// is already provisioned in compose; the swap is a separate ADR).

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

// Periodic GC so dead keys don't pin memory. Runs every 5 minutes when first
// touched.
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
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  armGc();
  const now = Date.now();
  const w = buckets.get(key);
  if (!w || now > w.resetAt) {
    const next = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: max - 1, resetAt: next.resetAt };
  }
  if (w.count >= max) {
    return { allowed: false, remaining: 0, resetAt: w.resetAt };
  }
  w.count += 1;
  return { allowed: true, remaining: max - w.count, resetAt: w.resetAt };
}

// Test helper — clears all buckets so tests don't leak state.
export function _resetRateLimit() {
  buckets.clear();
}
