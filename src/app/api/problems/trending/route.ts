import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/problems/trending — problems ranked by accepted submissions in the
// last 7 days. Falls through to recently-created on a tie. Used by the
// 'Trending this week' panel on the homepage.
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const since = new Date(Date.now() - WINDOW_MS);

    const groups = await prisma.submission.groupBy({
      by: ["problemId"],
      where: { status: "accepted", createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { problemId: "desc" } },
      take: limit,
    });

    if (groups.length === 0) {
      return Response.json({ problems: [] });
    }

    const problems = await prisma.problem.findMany({
      where: { id: { in: groups.map((g) => g.problemId) } },
      select: { id: true, title: true, slug: true, difficulty: true },
    });
    const byId = new Map(problems.map((p) => [p.id, p]));

    const ranked = groups
      .map((g) => {
        const p = byId.get(g.problemId);
        if (!p) return null;
        return { ...p, recentAccepted: g._count._all };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return Response.json({ problems: ranked });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
