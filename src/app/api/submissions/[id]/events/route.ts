import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  serializeEvents,
  MAX_EVENTS_PER_FLUSH,
  type PlaybackEvent,
} from "@/lib/code-playback";

const eventSchema = z.object({
  type: z.enum(["keystroke", "paste", "select", "snapshot"]),
  ts: z.number().int().nonnegative(),
  payload: z.unknown(),
});

const flushSchema = z.object({
  events: z.array(eventSchema).max(MAX_EVENTS_PER_FLUSH),
});

function isPlaybackEnabled(): boolean {
  return process.env.PLAYBACK_ENABLED === "true";
}

/**
 * POST /api/submissions/[id]/events
 *
 * Append a batch of recorder events to a submission. Auth-required and
 * owner-only — only the user who created the submission may attach
 * events. Admins can read playback (see GET below) but cannot write.
 *
 * Returns 404 if the feature flag PLAYBACK_ENABLED is off so external
 * scanners don't see the route shape.
 */
export async function POST(
  request: NextRequest,
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
    if (submission.userId !== session.userId) {
      // Even admins can't *write* events. Only the author records.
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = flushSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    let canonical: PlaybackEvent[];
    try {
      canonical = serializeEvents(parsed.data.events as PlaybackEvent[]);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Invalid events" },
        { status: 400 },
      );
    }

    if (canonical.length === 0) {
      return Response.json({ inserted: 0 });
    }

    await prisma.submissionEvent.createMany({
      data: canonical.map((ev) => ({
        submissionId: id,
        type: ev.type,
        ts: ev.ts,
        // Cast to Prisma's Json input — payload was already validated.
        payload: ev.payload as never,
      })),
    });

    return Response.json(
      { inserted: canonical.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    logger.error("submissions/[id]/events POST failed", {
      scope: "api/submissions/[id]/events",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
