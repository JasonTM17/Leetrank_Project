import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/discussions/[id]/upvote — toggles +1 on the discussion's upvote
// counter. We don't track per-user votes yet (no DiscussionVote model) so
// upvotes are best-effort and a user could vote multiple times. The
// counter is meant as a popularity signal, not a strict tally — if/when
// abuse becomes a problem we'll add the join table.

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
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
