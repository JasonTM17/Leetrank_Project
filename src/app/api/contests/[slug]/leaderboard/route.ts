import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

// GET /api/contests/[slug]/leaderboard — current standings for a contest.
// Reads ContestEntry rows ordered by score desc, joined to user. The score
// column is updated by the submission write path during a contest window.
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const contest = await prisma.contest.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!contest) {
      return Response.json({ error: "Contest not found" }, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const entries = await prisma.contestEntry.findMany({
      where: { contestId: contest.id },
      orderBy: [{ score: "desc" }, { joinedAt: "asc" }],
      take: limit,
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    const ranked = entries.map((e, i) => ({
      rank: i + 1,
      score: e.score,
      user: e.user,
    }));

    return Response.json({ contestStatus: contest.status, leaderboard: ranked });
  } catch (err) {
    logger.error("contests/leaderboard failed", { scope: "api/contests/[slug]/leaderboard", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

void getSession;
