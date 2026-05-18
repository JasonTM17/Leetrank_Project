import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/leaderboard/top — small fixed-size leaderboard slice for the
// homepage hero. Different from /api/leaderboard which is paginated; this
// one is always the top-N with no params, cacheable at the edge.
const TOP_N = 10;

export async function GET(_request: NextRequest) {
  try {
    const accepted = await prisma.submission.groupBy({
      by: ["userId", "problemId"],
      where: { status: "accepted" },
    });

    const solvedByUser = new Map<string, number>();
    for (const row of accepted) {
      solvedByUser.set(row.userId, (solvedByUser.get(row.userId) ?? 0) + 1);
    }

    const ids = [...solvedByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([userId]) => userId);

    if (ids.length === 0) {
      return Response.json({ leaderboard: [] }, {
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true, avatar: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    const top = ids
      .map((id, i) => {
        const u = byId.get(id);
        if (!u) return null;
        return { rank: i + 1, user: u, solved: solvedByUser.get(id) ?? 0 };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return Response.json(
      { leaderboard: top },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
