import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { deserializeEvents, durationMs } from "@/lib/code-playback";

function isPlaybackEnabled(): boolean {
  return process.env.PLAYBACK_ENABLED === "true";
}

/**
 * GET /api/submissions/[id]/playback
 *
 * Returns the recorded event stream for a submission, plus a tiny
 * envelope (`durationMs`, `count`) so the viewer can render its scrub
 * bar without a second round-trip. Visibility mirrors the submission
 * detail route: author + admin only. Anyone else gets 403 — keeping
 * accepted code off the front end of someone still solving the
 * problem.
 *
 * Returns 404 when PLAYBACK_ENABLED is off so unauthenticated probes
 * see no route shape.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isPlaybackEnabled()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const submission = await prisma.submission.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!submission) {
      return Response.json({ error: "Submission not found" }, { status: 404 });
    }
    if (
      submission.userId !== session.userId &&
      session.role !== "admin"
    ) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await prisma.submissionEvent.findMany({
      where: { submissionId: id },
      orderBy: { ts: "asc" },
      select: { type: true, ts: true, payload: true },
    });

    const events = deserializeEvents(rows);

    return Response.json(
      {
        events,
        count: events.length,
        durationMs: durationMs(events),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    logger.error("submissions/[id]/playback GET failed", {
      scope: "api/submissions/[id]/playback",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
