import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * GET /contests/:slug — full contest detail with problems (points, order,
 * tags) and entry count. Mirrors apps/web/src/app/api/contests/[slug]/route.ts.
 * NOTE: in-process cache.remember() from the web handler is intentionally
 * omitted — Phase 2.5 (shared Redis) owns caching for this service.
 */

interface ContestProblemRow {
  order: number;
  points: number;
  problem: {
    id: string;
    title: string;
    slug: string;
    difficulty: string;
    tags: Array<{ tag: { id: string; name: string; slug: string } }>;
  };
}

export async function contestDetailHandler(c: Context) {
  try {
    const slug = c.req.param("slug");
    if (!slug) return c.json({ error: "Slug required" }, 400);

    const contest = await prisma.contest.findUnique({
      where: { slug },
      include: {
        problems: {
          orderBy: { order: "asc" },
          include: {
            problem: {
              include: {
                tags: { include: { tag: true } },
              },
            },
          },
        },
      },
    });

    if (!contest) {
      return c.json({ error: "Contest not found" }, 404);
    }

    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json({
      contest: {
        id: contest.id,
        title: contest.title,
        slug: contest.slug,
        description: contest.description,
        startTime: contest.startTime,
        endTime: contest.endTime,
        status: contest.status,
        problems: contest.problems.map((cp: ContestProblemRow) => ({
          id: cp.problem.id,
          title: cp.problem.title,
          slug: cp.problem.slug,
          difficulty: cp.problem.difficulty,
          points: cp.points,
          order: cp.order,
          tags: cp.problem.tags.map((pt) => ({
            id: pt.tag.id,
            name: pt.tag.name,
            slug: pt.tag.slug,
          })),
        })),
      },
    });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}
