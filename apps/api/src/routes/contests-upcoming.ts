import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * GET /contests/upcoming — upcoming contests ordered by startTime asc.
 * Honours ?limit (default 20, max 50). Mirrors
 * apps/web/src/app/api/contests/upcoming/route.ts.
 */
export async function contestsUpcomingHandler(c: Context) {
  try {
    const url = new URL(c.req.url);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20)
    );

    const contests = await prisma.contest.findMany({
      where: { status: "upcoming" },
      orderBy: { startTime: "asc" },
      take: limit,
      include: {
        _count: { select: { problems: true } },
      },
    });
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json({ contests });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}
