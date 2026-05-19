import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";

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
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
