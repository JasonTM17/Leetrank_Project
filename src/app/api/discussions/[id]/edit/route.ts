import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";

const editSchema = z.object({
  body: z.string().min(1, "Body is required").max(10_000),
});

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// PATCH /api/discussions/[id] — edit the title and/or body of a discussion.
// Author only — admins can delete but not edit (impersonating someone else's
// authored content is a different blast radius). Title isn't editable to
// keep the URL stable.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`discussion-edit:${session.userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many edits. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { id } = await params;
    const existing = await prisma.discussion.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing) {
      return Response.json({ error: "Discussion not found" }, { status: 404 });
    }
    if (existing.userId !== session.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const updated = await prisma.discussion.update({
      where: { id: existing.id },
      data: { body: parsed.data.body },
      select: { id: true, body: true, updatedAt: true },
    });

    return Response.json({ discussion: updated });
  } catch (err) {
    logger.error("discussions/[id]/edit failed", { scope: "api/discussions/[id]/edit", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
