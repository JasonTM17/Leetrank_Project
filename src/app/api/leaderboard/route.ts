import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    // Aggregate accepted submissions to a (userId -> uniqueSolvedCount) ranking.
    // groupBy on (userId, problemId) then count problems per user keeps the
    // unique-problem semantics — multiple AC submissions for one problem
    // shouldn't double-count.
    const accepted = await prisma.submission.groupBy({
      by: ["userId", "problemId"],
      where: { status: "accepted" },
    });

    const solvedByUser = new Map<string, number>();
    for (const row of accepted) {
      solvedByUser.set(row.userId, (solvedByUser.get(row.userId) ?? 0) + 1);
    }

    const sortedUserIds = [...solvedByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([userId]) => userId);

    const total = sortedUserIds.length;
    const start = (page - 1) * limit;
    const pageUserIds = sortedUserIds.slice(start, start + limit);

    const users = pageUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: pageUserIds } },
          select: { id: true, username: true, avatar: true, createdAt: true },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const leaderboard = pageUserIds
      .map((userId, i) => {
        const user = userById.get(userId);
        if (!user) return null;
        return {
          rank: start + i + 1,
          user,
          username: user.username,
          solved: solvedByUser.get(userId) ?? 0,
          score: (solvedByUser.get(userId) ?? 0) * 100,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return Response.json({ leaderboard, total, page, limit });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
