import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// GET /api/contests/[slug]/entries — list of joined participants for a
// contest, ordered by score desc. Like the leaderboard, but returns the
// raw entry rows (with rank derived) so the contest page can render the
// participants tab independently of the time-windowed leaderboard.
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const contest = await prisma.contest.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!contest) {
      return Response.json({ error: "Contest not found" }, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const [entries, total] = await Promise.all([
      prisma.contestEntry.findMany({
        where: { contestId: contest.id },
        orderBy: { joinedAt: "asc" },
        take: limit,
        include: {
          user: { select: { id: true, username: true, avatar: true } },
        },
      }),
      prisma.contestEntry.count({ where: { contestId: contest.id } }),
    ]);

    return Response.json({ entries, total });
  } catch (err) {
    logger.error("contests/entries failed", { scope: "api/contests/[slug]/entries", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
