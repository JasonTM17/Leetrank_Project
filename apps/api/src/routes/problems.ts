import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * GET /problems — paginated list with optional difficulty / tag / search
 * filters. Mirrors apps/web/src/app/api/problems/route.ts.
 */
export async function problemsListHandler(c: Context) {
  try {
    const url = new URL(c.req.url);
    const difficulty = url.searchParams.get("difficulty");
    const tag = url.searchParams.get("tag");
    const search = url.searchParams.get("search");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));

    const where: Record<string, unknown> = {};
    if (difficulty) where.difficulty = difficulty;
    if (search) where.title = { contains: search };
    if (tag) where.tags = { some: { tag: { slug: tag } } };

    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where,
        orderBy: { order: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tags: { include: { tag: true } },
          _count: { select: { submissions: true } },
        },
      }),
      prisma.problem.count({ where }),
    ]);

    interface ProblemWithIncludes {
      id: string;
      title: string;
      slug: string;
      difficulty: string;
      tags: Array<{ tag: { id: string; name: string; slug: string } }>;
      _count: { submissions: number };
    }
    const result = problems.map((p: ProblemWithIncludes) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      difficulty: p.difficulty,
      tags: p.tags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name, slug: pt.tag.slug })),
      submissionCount: p._count.submissions,
    }));

    if (!search) {
      c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    } else {
      c.header("Cache-Control", "no-store");
    }
    return c.json({ problems: result, total, page, limit });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}

/**
 * GET /problems/:slug — full problem detail with public test cases.
 */
export async function problemDetailHandler(c: Context) {
  try {
    const slug = c.req.param("slug");
    if (!slug) return c.json({ error: "Slug required" }, 400);

    const problem = await prisma.problem.findUnique({
      where: { slug },
      include: {
        tags: { include: { tag: true } },
        testCases: {
          where: { isHidden: false },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!problem) {
      return c.json({ error: "Problem not found" }, 404);
    }

    c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    return c.json({
      problem: {
        id: problem.id,
        title: problem.title,
        slug: problem.slug,
        description: problem.description,
        difficulty: problem.difficulty,
        constraints: problem.constraints,
        hints: problem.hints,
        editorial: problem.editorial,
        starterCode: problem.starterCode,
        tags: problem.tags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name, slug: pt.tag.slug })),
        testCases: problem.testCases,
      },
    });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}
