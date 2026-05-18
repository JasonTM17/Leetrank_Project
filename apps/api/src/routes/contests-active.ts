import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * GET /contests/active — active contests ordered by startTime asc, with
 * entry and problem counts. Mirrors
 * apps/web/src/app/api/contests/active/route.ts.
 */
export async function contestsActiveHandler(c: Context) {
  try {
    const contests = await prisma.contest.findMany({
      where: { status: "active" },
      orderBy: { startTime: "asc" },
      include: {
        _count: { select: { entries: true, problems: true } },
      },
    });
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json({ contests });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}
