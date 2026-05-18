import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * GET /contests — sorted by startTime desc. Mirrors
 * apps/web/src/app/api/contests/route.ts.
 */
export async function contestsHandler(c: Context) {
  try {
    const contests = await prisma.contest.findMany({
      orderBy: { startTime: "desc" },
    });
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json({ contests });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}
