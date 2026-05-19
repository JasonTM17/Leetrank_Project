import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { evaluateEditorialGate } from "@/lib/editorial";

// GET /api/problems/[slug]/editorial
//
// Auth required. Returns editorial markdown only when one of:
//   - the user has at least one submission for this problem, or
//   - the problem is older than EDITORIAL_GRACE_DAYS.
//
// When locked the route still returns 200 with `unlocked: false` plus the
// unlock countdown so the FE can render a tasteful gate without a separate
// preflight call.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    const problem = await prisma.problem.findUnique({
      where: { slug },
      select: {
        id: true,
        createdAt: true,
        editorial: true,
      },
    });

    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    const submissionCount = await prisma.submission.count({
      where: { userId: session.userId, problemId: problem.id },
    });

    const gate = evaluateEditorialGate({
      problemCreatedAt: problem.createdAt,
      hasSubmitted: submissionCount > 0,
    });

    if (!gate.unlocked) {
      return Response.json(
        {
          unlocked: false,
          unlocksAt: gate.unlocksAt.toISOString(),
          countdownSeconds: gate.countdownSeconds,
          reason: gate.reason,
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    return Response.json(
      {
        unlocked: true,
        reason: gate.reason,
        editorial: problem.editorial ?? null,
        unlocksAt: gate.unlocksAt.toISOString(),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    logger.error("editorial GET failed", {
      scope: "api/problems/[slug]/editorial",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
