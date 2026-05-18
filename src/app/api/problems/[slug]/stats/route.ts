import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/problems/[slug]/stats — public per-problem aggregate that the
// problem detail page uses to show acceptance rate + per-language breakdown.
// Stats are computed live; if this gets hot we'll move them behind a small
// cache (revalidate the entry on each new submission).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const problem = await prisma.problem.findUnique({
      where: { slug },
      select: { id: true, title: true, slug: true, difficulty: true },
    });
    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    const [total, accepted, perLanguage] = await Promise.all([
      prisma.submission.count({ where: { problemId: problem.id } }),
      prisma.submission.count({ where: { problemId: problem.id, status: "accepted" } }),
      prisma.submission.groupBy({
        by: ["language"],
        where: { problemId: problem.id, status: "accepted" },
        _count: { _all: true },
      }),
    ]);

    const byLanguage: Record<string, number> = {};
    for (const row of perLanguage) {
      byLanguage[row.language] = row._count._all;
    }

    const acceptanceRate = total === 0 ? 0 : Math.round((accepted / total) * 1000) / 10;

    return Response.json({
      problem,
      stats: { total, accepted, acceptanceRate, byLanguage },
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
