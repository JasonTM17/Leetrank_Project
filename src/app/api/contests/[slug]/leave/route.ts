import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

// DELETE /api/contests/[slug]/leave — withdraw from a contest. Only allowed
// before the contest enters its 'ended' status; once it's ended the entry
// is part of the historical record and shouldn't disappear.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
      return Response.json(
        { error: "Cannot leave an ended contest — entries are part of the record" },
        { status: 409 }
      );
    }

    const existing = await prisma.contestEntry.findUnique({
      where: { contestId_userId: { contestId: contest.id, userId: session.userId } },
      select: { id: true },
    });
    if (!existing) {
      return Response.json({ error: "Not joined" }, { status: 404 });
    }

    await prisma.contestEntry.delete({ where: { id: existing.id } });
    return Response.json({ success: true });
  } catch (err) {
    logger.error("contests/leave failed", { scope: "api/contests/[slug]/leave", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
