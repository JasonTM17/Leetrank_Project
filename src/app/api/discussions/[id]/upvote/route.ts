import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// POST /api/discussions/[id]/upvote — toggles +1 on the discussion's upvote
// counter. We don't track per-user votes yet (no DiscussionVote model) so
// upvotes are best-effort and a user could vote multiple times. The
// counter is meant as a popularity signal, not a strict tally — if/when
// abuse becomes a problem we'll add the join table.
//
// Until that join table lands, the rate limit is the only thing keeping
// the count honest. 1 per second per user per discussion is plenty for
// real interaction and tight enough to make scripted spam pointless.
const UPVOTE_LIMIT_MAX = 5;
const UPVOTE_LIMIT_WINDOW_MS = 60_000;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const limit = rateLimit(
      `upvote:${session.userId}:${id}`,
      UPVOTE_LIMIT_MAX,
      UPVOTE_LIMIT_WINDOW_MS
    );
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many upvotes. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const discussion = await prisma.discussion.update({
      where: { id },
      data: { upvotes: { increment: 1 } },
      select: { id: true, upvotes: true },
    });

    return Response.json({ id: discussion.id, upvotes: discussion.upvotes });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Record to update not found")) {
      return Response.json({ error: "Discussion not found" }, { status: 404 });
    }
    logger.error("discussions/[id]/upvote failed", { scope: "api/discussions/[id]/upvote", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
