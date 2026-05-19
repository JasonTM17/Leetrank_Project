import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/achievements
 *
 * Returns the full achievement catalog plus, when the caller is logged in,
 * their per-row earned/progress state. Hidden achievements are filtered out
 * unless the caller has earned them.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.userId ?? null;

    const [achievements, userRows] = await Promise.all([
      prisma.achievement.findMany({
        orderBy: [{ category: "asc" }, { points: "asc" }],
      }),
      userId
        ? prisma.userAchievement.findMany({ where: { userId } })
        : Promise.resolve([]),
    ]);

    const earnedMap = new Map<string, { earnedAt: Date; progress: number }>();
    for (const u of userRows) {
      // earnedAt = epoch sentinel means "not yet earned, just tracking progress".
      const realEarnedAt =
        u.earnedAt.getTime() === 0 ? null : u.earnedAt;
      earnedMap.set(u.achievementId, {
        earnedAt: realEarnedAt as Date,
        progress: u.progress,
      });
    }

    const items = achievements
      .filter((a) => !a.isHidden || earnedMap.has(a.id))
      .map((a) => {
        const u = earnedMap.get(a.id);
        return {
          id: a.id,
          slug: a.slug,
          title: a.title,
          description: a.description,
          icon: a.icon,
          category: a.category,
          points: a.points,
          isHidden: a.isHidden,
          earned: u?.earnedAt != null,
          earnedAt: u?.earnedAt ?? null,
          progress: u?.progress ?? 0,
        };
      });

    const totals = items.reduce(
      (acc, item) => {
        if (item.earned) {
          acc.earnedCount += 1;
          acc.points += item.points;
        }
        return acc;
      },
      { earnedCount: 0, points: 0 }
    );

    return Response.json({
      items,
      totals,
      total: items.length,
    });
  } catch (err) {
    logger.error("achievements_list_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json(
      { error: "Failed to load achievements" },
      { status: 500 }
    );
  }
}
