import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * GET /stats — aggregate counts for problems, contests, users, and accepted
 * submissions. Mirrors apps/web/src/app/api/stats/route.ts.
 */
export async function statsHandler(c: Context) {
  try {
    const [problems, contests, users, accepted] = await Promise.all([
      prisma.problem.count(),
      prisma.contest.count(),
      prisma.user.count(),
      prisma.submission.count({ where: { status: "accepted" } }),
    ]);
    c.header(
      "Cache-Control",
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
    );
    return c.json({ problems, contests, users, accepted });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}
