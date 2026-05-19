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

// DELETE /api/study-plans/[slug]/abandon — drops the user's enrollment.
// We do NOT delete the per-problem submissions; the user keeps their accepted
// rows and can re-enroll later without losing solved progress. 204 on success
// keeps the contract symmetric with other delete-style routes in the repo.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`study-plan-abandon:${session.userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
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

    const result = await prisma.userStudyPlan.deleteMany({
      where: { userId: session.userId, studyPlanId: plan.id },
    });

    cache.delete("study-plans:all");

    return Response.json(
      { abandoned: result.count > 0 },
      { status: result.count > 0 ? 200 : 404 },
    );
  } catch (err) {
    logger.error("study-plans/abandon failed", {
      scope: "api/study-plans/[slug]/abandon",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
