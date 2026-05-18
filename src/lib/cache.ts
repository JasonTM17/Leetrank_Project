/**
 * In-process LRU + TTL cache.
 *
 * The plan is to swap this for Redis once the read load justifies it,
 * but for the foreseeable future a per-process cache is enough — and
 * having an interface in place lets us point hot endpoints at it now
 * without locking ourselves into Redis semantics.
 *
 * Bound: configurable max entries (default 1000). When full, the
 * least-recently-used entry is evicted. TTL is per-key and checked
 * lazily on read; a stale entry is treated as a miss and removed.
 *
 * Single-flight: concurrent calls to remember() with the same key
 * dedupe to one underlying loader call. Avoids the cache-stampede
 * problem when a hot key expires under load.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T = unknown> {
  private store = new Map<string, Entry<T>>();
  private inflight = new Map<string, Promise<T>>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly maxEntries = 1000) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }
    // Re-insert to bump the LRU order (Map iteration order = insertion order).
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Single-flight loader: if value is in cache, return it. Otherwise call
   * loader exactly once even under concurrent get-and-fill races.
   */
  async remember(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const inflight = this.inflight.get(key);
    if (inflight) return inflight;

    const promise = loader()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, promise);
    return promise;
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
      inflight: this.inflight.size,
    };
  }
}

/**
 * Default singleton — most callers should use this so the same
 * key namespace is shared.
 */
export const cache = new TTLCache(parseInt(process.env.CACHE_MAX_ENTRIES ?? "2000", 10));
