import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { getSession } from "@/lib/auth";

const TTL_MS = 60_000;

const slugSchema = z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Invalid slug");

interface PlanDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedHours: number;
  coverImage: string | null;
  isOfficial: boolean;
  problems: {
    id: string;
    title: string;
    slug: string;
    difficulty: string;
    acceptanceRate: number | null;
    order: number;
    dayNumber: number;
  }[];
}

// GET /api/study-plans/[slug] — full detail with day-grouped problems and,
// if the caller is signed in, per-problem solved status. The catalogue half
// of the payload is cacheable; user state is computed per-request.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const slugCheck = slugSchema.safeParse(slug);
    if (!slugCheck.success) {
      return Response.json(
        { error: "Invalid request", details: slugCheck.error.flatten() },
        { status: 400 },
      );
    }

    const detail = (await cache.remember(`study-plans:detail:${slugCheck.data}`, TTL_MS, async (): Promise<PlanDetail | null> => {
      const plan = await prisma.studyPlan.findUnique({
        where: { slug: slugCheck.data },
        include: {
          problems: {
            orderBy: { order: "asc" },
            include: {
              problem: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  difficulty: true,
                  acceptanceRate: true,
                },
              },
            },
          },
        },
      });

      if (!plan) return null;

      return {
        id: plan.id,
        slug: plan.slug,
        title: plan.title,
        description: plan.description,
        difficulty: plan.difficulty,
        estimatedHours: plan.estimatedHours,
        coverImage: plan.coverImage,
        isOfficial: plan.isOfficial,
        problems: plan.problems.map((spp) => ({
          id: spp.problem.id,
          title: spp.problem.title,
          slug: spp.problem.slug,
          difficulty: spp.problem.difficulty,
          acceptanceRate: spp.problem.acceptanceRate,
          order: spp.order,
          dayNumber: spp.dayNumber,
        })),
      };
    })) as PlanDetail | null;

    if (!detail) {
      return Response.json({ error: "Study plan not found" }, { status: 404 });
    }

    const session = await getSession();
    let solvedProblemIds: string[] = [];
    let enrollment: { startedAt: string; completedAt: string | null; lastActivityAt: string } | null = null;

    if (session) {
      const problemIds = detail.problems.map((p) => p.id);
      if (problemIds.length > 0) {
        const accepted = await prisma.submission.findMany({
          where: {
            userId: session.userId,
            status: "Accepted",
            problemId: { in: problemIds },
          },
          distinct: ["problemId"],
          select: { problemId: true },
        });
        solvedProblemIds = accepted.map((a) => a.problemId);
      }

      const usp = await prisma.userStudyPlan.findUnique({
        where: { userId_studyPlanId: { userId: session.userId, studyPlanId: detail.id } },
      });
      if (usp) {
        enrollment = {
          startedAt: usp.startedAt.toISOString(),
          completedAt: usp.completedAt ? usp.completedAt.toISOString() : null,
          lastActivityAt: usp.lastActivityAt.toISOString(),
        };
      }
    }

    return Response.json(
      { plan: detail, solvedProblemIds, enrollment },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
    );
  } catch (err) {
    logger.error("study-plans/[slug] GET failed", {
      scope: "api/study-plans/[slug]",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
