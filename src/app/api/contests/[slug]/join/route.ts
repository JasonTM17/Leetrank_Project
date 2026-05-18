import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// POST /api/contests/[slug]/join — registers the signed-in user for a contest.
// Idempotent: re-joining is a no-op that returns the existing entry. We
// don't allow joining contests that are already in the 'ended' status —
// late entries can't post a meaningful score.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`contest-join:${session.userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many join requests. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { slug } = await params;
    const contest = await prisma.contest.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!contest) {
      return Response.json({ error: "Contest not found" }, { status: 404 });
    }
    if (contest.status === "ended") {
      return Response.json({ error: "Contest has ended" }, { status: 409 });
    }

    const existing = await prisma.contestEntry.findUnique({
      where: { contestId_userId: { contestId: contest.id, userId: session.userId } },
      select: { id: true, score: true, rank: true },
    });
    if (existing) {
      return Response.json({ entry: existing, alreadyJoined: true });
    }

    const entry = await prisma.contestEntry.create({
      data: { contestId: contest.id, userId: session.userId },
      select: { id: true, score: true, rank: true },
    });

    return Response.json({ entry, alreadyJoined: false }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
