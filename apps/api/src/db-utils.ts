/**
 * Database connection-pool URL helpers, separate from db.ts so tests
 * can import them without going through the prisma mock.
 */

/**
 * Appends Prisma connection-pool parameters to the DATABASE_URL if they are
 * not already present.
 *
 * connection_limit=10 — Plan 02 §2 targets 10 services sharing one Postgres
 * instance; capping each service at 10 connections keeps the total well under
 * the default max_connections=100.
 *
 * pool_timeout=20 — how long (seconds) a query waits for a free connection
 * before Prisma throws P2024.
 */
export function withPoolParams(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "10");
  }
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "20");
  }
  return url.toString();
}
