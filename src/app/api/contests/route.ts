import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";

const CACHE_KEY = "contests:all";
const TTL_MS = 60_000;

export async function GET() {
  try {
    const contests = await cache.remember(CACHE_KEY, TTL_MS, () =>
      prisma.contest.findMany({ orderBy: { startTime: "desc" }, take: 100 })
    );

    return Response.json(
      { contests },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch (err) {
    logger.error("contests GET failed", { scope: "api/contests", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
