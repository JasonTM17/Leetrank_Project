import type { Context } from "hono";
import { prisma } from "../db.js";

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

interface TrendingProblem {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  recentAccepted: number;
}

/**
 * GET /problems/trending — accepted submissions over the last 7 days,
 * grouped by problem, top-N. Mirrors apps/web/src/app/api/problems/trending.
 */
export async function trendingHandler(c: Context) {
  try {
    const url = new URL(c.req.url);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const since = new Date(Date.now() - WINDOW_MS);

    const groups = await prisma.submission.groupBy({
      by: ["problemId"],
      where: { status: "accepted", createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { problemId: "desc" } },
      take: limit,
    });

    if (groups.length === 0) {
      return c.json({ problems: [] as TrendingProblem[] });
    }

    interface GroupRow { problemId: string; _count: { _all: number } }
    const problems = await prisma.problem.findMany({
      where: { id: { in: groups.map((g: GroupRow) => g.problemId) } },
      select: { id: true, title: true, slug: true, difficulty: true },
    });
    interface ProblemSummary { id: string; title: string; slug: string; difficulty: string }
    const byId = new Map(problems.map((p: ProblemSummary) => [p.id, p]));

    const ranked = groups
      .map((g: GroupRow) => {
        const p = byId.get(g.problemId);
        if (!p) return null;
        return { ...p, recentAccepted: g._count._all };
      })
      .filter((x: TrendingProblem | null): x is TrendingProblem => x !== null);

    c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    return c.json({ problems: ranked });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}

/**
 * GET /problems/random — single random problem, optionally constrained by
 * difficulty. Uses count + skip for the random offset; not ideal for very
 * large tables but keeps the implementation portable across Postgres and
 * the SQLite tests.
 */
export async function randomHandler(c: Context) {
  try {
    const url = new URL(c.req.url);
    const difficulty = url.searchParams.get("difficulty");
    const where: Record<string, unknown> = {};
    if (difficulty) where.difficulty = difficulty;

    const total = await prisma.problem.count({ where });
    if (total === 0) return c.json({ error: "No problems available" }, 404);

    const skip = Math.floor(Math.random() * total);
    const [problem] = await prisma.problem.findMany({
      where,
      skip,
      take: 1,
      select: { id: true, title: true, slug: true, difficulty: true },
    });

    if (!problem) return c.json({ error: "No problems available" }, 404);

    c.header("Cache-Control", "no-store");
    return c.json({ problem });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}
