import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Search runs three concurrent LIKE queries — comparatively expensive
// vs. a single-row lookup. RULES §4 says rate-limit compute-heavy
// endpoints; bot scrapers can hit this hard otherwise.
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// Simple search endpoint that fans out across problems, contests, and tags.
// Returns three result sets in one round trip so the search UI can render
// grouped suggestions without three independent fetches.
export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const limit = rateLimit(`search:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many search requests. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { searchParams } = request.nextUrl;
    const query = (searchParams.get("q") ?? "").trim();
    const lim = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    if (query.length < 2) {
      return Response.json({ query, problems: [], contests: [], tags: [] });
    }

    // Bug-sweep 2026-05: Postgres LIKE is case-sensitive by default —
    // without `mode: "insensitive"`, searching "two" misses "Two Sum".
    // Prisma drops the mode flag silently on engines that ignore it
    // (e.g. SQLite via test mock), so this is safe in test as well.
    const [problems, contests, tags] = await Promise.all([
      prisma.problem.findMany({
        where: { title: { contains: query, mode: "insensitive" } },
        select: { id: true, title: true, slug: true, difficulty: true },
        orderBy: { order: "asc" },
        take: lim,
      }),
      prisma.contest.findMany({
        where: { title: { contains: query, mode: "insensitive" } },
        select: { id: true, title: true, slug: true, status: true, startTime: true },
        orderBy: { startTime: "desc" },
        take: lim,
      }),
      prisma.tag.findMany({
        where: { name: { contains: query, mode: "insensitive" } },
        select: { id: true, name: true, slug: true },
        take: lim,
      }),
    ]);

    return Response.json({ query, problems, contests, tags });
  } catch (err) {
    logger.error("search GET failed", { scope: "api/search", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
