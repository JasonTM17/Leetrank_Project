import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// GET /api/contests/[slug]/me — current user's status for a given contest:
// joined? entry score and rank? Used by the contest detail page so the
// 'Join' button can switch to 'View standings' once they're in.
import { getSession } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
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

    const session = await getSession();
    if (!session) {
      return Response.json({ joined: false, entry: null });
    }

    const entry = await prisma.contestEntry.findUnique({
      where: { contestId_userId: { contestId: contest.id, userId: session.userId } },
      select: { id: true, score: true, rank: true, joinedAt: true },
    });

    return Response.json({ joined: !!entry, entry });
  } catch (err) {
    logger.error("contests/me failed", { scope: "api/contests/[slug]/me", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
