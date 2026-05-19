import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const slugSchema = z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Invalid slug");

// POST /api/study-plans/[slug]/start — enrolls the signed-in user.
// Idempotent: re-starting an already-started plan returns 200 with the
// existing record so the UI does not need a separate "is enrolled?" check
// before firing the button. We touch `lastActivityAt` on every call so the
// dashboard "recently picked up" sort stays useful.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`study-plan-start:${session.userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many requests. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    const { slug } = await params;
    const slugCheck = slugSchema.safeParse(slug);
    if (!slugCheck.success) {
      return Response.json(
        { error: "Invalid request", details: slugCheck.error.flatten() },
        { status: 400 },
      );
    }

    const plan = await prisma.studyPlan.findUnique({
      where: { slug: slugCheck.data },
      select: { id: true },
    });
    if (!plan) {
      return Response.json({ error: "Study plan not found" }, { status: 404 });
    }

    const now = new Date();
    const enrollment = await prisma.userStudyPlan.upsert({
      where: { userId_studyPlanId: { userId: session.userId, studyPlanId: plan.id } },
      create: { userId: session.userId, studyPlanId: plan.id, lastActivityAt: now },
      update: { lastActivityAt: now },
    });

    // Bust the listing cache; the user's progress payload depends on
    // enrollment rows. The detail cache key holds catalogue data only, so
    // we leave it in place.
    cache.delete("study-plans:all");

    const alreadyStarted = enrollment.startedAt.getTime() < now.getTime() - 1000;
    return Response.json(
      {
        enrollment: {
          startedAt: enrollment.startedAt.toISOString(),
          completedAt: enrollment.completedAt ? enrollment.completedAt.toISOString() : null,
          lastActivityAt: enrollment.lastActivityAt.toISOString(),
        },
        alreadyStarted,
      },
      { status: alreadyStarted ? 200 : 201 },
    );
  } catch (err) {
    logger.error("study-plans/start failed", {
      scope: "api/study-plans/[slug]/start",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
