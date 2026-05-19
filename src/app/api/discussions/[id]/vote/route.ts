import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { voteSchema, firstZodError } from "@/lib/validations";
import { logger } from "@/lib/logger";

// LeetCode-parity vote endpoint. Stores per-user votes in DiscussionVote
// so toggles are correct (upvote -> downvote -> remove). Cap is 30/min
// per user across all discussions — generous for normal browsing,
// tight enough that scripted abuse hurts.
const VOTE_LIMIT_MAX = 30;
const VOTE_LIMIT_WINDOW_MS = 60_000;

// POST /api/discussions/[id]/vote — body { value: 1 | -1 }.
// Toggle semantics: voting the same direction twice removes the vote.
// Voting the opposite direction flips it. Always returns the new
// aggregate score for the discussion.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(
      `discussion-vote:${session.userId}`,
      VOTE_LIMIT_MAX,
      VOTE_LIMIT_WINDOW_MS
    );
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many votes. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }
    const { value } = parsed.data;

    const { id } = await params;
    const discussion = await prisma.discussion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!discussion) {
      return Response.json({ error: "Discussion not found" }, { status: 404 });
    }

    // Look up existing vote for this user/thread.
    const existing = await prisma.discussionVote.findUnique({
      where: {
        discussionId_userId: { discussionId: id, userId: session.userId },
      },
      select: { id: true, value: true },
    });

    // Toggle logic:
    //  - no existing vote: insert.
    //  - same value: remove (idempotent toggle).
    //  - different value: flip via update.
    let userVote: 1 | -1 | 0 = value;
    if (!existing) {
      await prisma.discussionVote.create({
        data: { discussionId: id, userId: session.userId, value },
      });
    } else if (existing.value === value) {
      await prisma.discussionVote.delete({ where: { id: existing.id } });
      userVote = 0;
    } else {
      await prisma.discussionVote.update({
        where: { id: existing.id },
        data: { value },
      });
    }

    const agg = await prisma.discussionVote.aggregate({
      where: { discussionId: id },
      _sum: { value: true },
    });
    const score = agg._sum.value ?? 0;

    return Response.json({ id, score, userVote });
  } catch (err) {
    logger.error("discussions/[id] vote failed", {
      scope: "api/discussions/[id]/vote",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
