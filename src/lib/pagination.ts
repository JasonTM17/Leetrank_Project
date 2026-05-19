// Shared pagination helpers — centralised so every list endpoint clamps the
// same way. Without this, /api/problems clamped ?limit=999 → 50 while
// /api/leaderboard happily returned 9999 rows. parseLimit is the only
// supported entry point; pass the route's own MAX cap as the second arg.

const DEFAULT_LIMIT = 50;
const DEFAULT_MAX = 50;

export interface ParseLimitOptions {
  /** Per-route ceiling; defaults to 50 to match /api/problems. */
  max?: number;
  /** Fallback when the caller omits ?limit. Defaults to min(DEFAULT_LIMIT, max). */
  fallback?: number;
}

/**
 * Parse and clamp the `?limit=` query param off a URL.
 * - Non-numeric / missing → `fallback` (default 50, capped to `max`).
 * - Below 1 → 1 (a list with limit 0 is never useful).
 * - Above `max` → `max`.
 */
export function parseLimit(url: URL, options: ParseLimitOptions = {}): number {
  const max = options.max ?? DEFAULT_MAX;
  const fallback = options.fallback ?? Math.min(DEFAULT_LIMIT, max);
  const raw = url.searchParams.get("limit");
  const parsed = parseInt(raw ?? String(fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.min(Math.max(1, fallback), max);
  return Math.min(max, Math.max(1, parsed));
}

/** Parse a 1-based `?page=` query param; clamps to >= 1. */
export function parsePage(url: URL): number {
  const raw = url.searchParams.get("page");
  const parsed = parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}
