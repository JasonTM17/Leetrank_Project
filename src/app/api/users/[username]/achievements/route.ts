import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * GET /api/users/[username]/achievements
 *
 * Public earned-achievements endpoint for profile pages. Hidden achievements
 * are filtered unless earned. Always 200 with empty list when the user has
 * no badges yet so the UI can render an EmptyState.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const rows = await prisma.userAchievement.findMany({
      where: { userId: user.id, NOT: { earnedAt: new Date(0) } },
      orderBy: { earnedAt: "desc" },
      include: { achievement: true },
    });

    const items = rows
      .filter((r) => !r.achievement.isHidden || r.earnedAt.getTime() !== 0)
      .map((r) => ({
        id: r.achievement.id,
        slug: r.achievement.slug,
        title: r.achievement.title,
        description: r.achievement.description,
        icon: r.achievement.icon,
        category: r.achievement.category,
        points: r.achievement.points,
        earnedAt: r.earnedAt,
      }));

    const totalPoints = items.reduce((sum, i) => sum + i.points, 0);

    return Response.json({
      items,
      total: items.length,
      totalPoints,
    });
  } catch (err) {
    logger.error("user_achievements_list_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json(
      { error: "Failed to load user achievements" },
      { status: 500 }
    );
  }
}
