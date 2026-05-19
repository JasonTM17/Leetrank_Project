import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { getSession } from "@/lib/auth";

const CACHE_KEY = "study-plans:all";
const TTL_MS = 60_000;

interface PlanRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedHours: number;
  coverImage: string | null;
  isOfficial: boolean;
  problemCount: number;
}

// GET /api/study-plans — public catalogue. We cache the catalogue itself
// (read-mostly) but compute per-user progress on every request because
// progress changes whenever the user solves a problem; caching it would
// produce stale "you are 60% done" badges.
export async function GET() {
  try {
    const plans = await cache.remember(CACHE_KEY, TTL_MS, async () => {
      const rows = await prisma.studyPlan.findMany({
        orderBy: [{ isOfficial: "desc" }, { createdAt: "asc" }],
        include: { _count: { select: { problems: true } } },
      });
      return rows.map((p): PlanRow => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        difficulty: p.difficulty,
        estimatedHours: p.estimatedHours,
        coverImage: p.coverImage,
        isOfficial: p.isOfficial,
        problemCount: p._count.problems,
      }));
    });

    const session = await getSession();
    let progress: Record<string, { startedAt: string; completedAt: string | null; solved: number }> = {};

    if (session) {
      const enrollments = await prisma.userStudyPlan.findMany({
        where: { userId: session.userId },
        select: { studyPlanId: true, startedAt: true, completedAt: true },
      });

      if (enrollments.length > 0) {
        const planIds = enrollments.map((e) => e.studyPlanId);

        // Single grouped query covers all plans; per-plan grouping happens
        // in memory so we don't fan out N queries for N enrolled plans.
        const planProblems = await prisma.studyPlanProblem.findMany({
          where: { studyPlanId: { in: planIds } },
          select: { studyPlanId: true, problemId: true },
        });

        const allProblemIds = Array.from(new Set(planProblems.map((pp) => pp.problemId)));
        const accepted = await prisma.submission.findMany({
          where: {
            userId: session.userId,
            status: "Accepted",
            problemId: { in: allProblemIds },
          },
          distinct: ["problemId"],
          select: { problemId: true },
        });
        const solvedSet = new Set(accepted.map((a) => a.problemId));

        const solvedByPlan = new Map<string, number>();
        for (const pp of planProblems) {
          if (solvedSet.has(pp.problemId)) {
            solvedByPlan.set(pp.studyPlanId, (solvedByPlan.get(pp.studyPlanId) ?? 0) + 1);
          }
        }

        progress = Object.fromEntries(
          enrollments.map((e) => [
            e.studyPlanId,
            {
              startedAt: e.startedAt.toISOString(),
              completedAt: e.completedAt ? e.completedAt.toISOString() : null,
              solved: solvedByPlan.get(e.studyPlanId) ?? 0,
            },
          ]),
        );
      }
    }

    return Response.json(
      { plans, progress },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
    );
  } catch (err) {
    logger.error("study-plans GET failed", {
      scope: "api/study-plans",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
