import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * GET /tags/:slug — tag detail with paginated problems. Mirrors
 * apps/web/src/app/api/tags/[slug]/route.ts.
 * Supports ?page (>=1, default 1) and ?limit (default 50, max 100).
 */

interface ProblemWithTags {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  tags: Array<{ tag: { id: string; name: string; slug: string } }>;
}

export async function tagDetailHandler(c: Context) {
  try {
    const slug = c.req.param("slug");
    if (!slug) return c.json({ error: "Slug required" }, 400);

    const tag = await prisma.tag.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });

    if (!tag) {
      return c.json({ error: "Tag not found" }, 404);
    }

    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50)
    );

    const where = { tags: { some: { tagId: tag.id } } };

    const [rawProblems, total] = await Promise.all([
      prisma.problem.findMany({
        where,
        orderBy: { order: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tags: { include: { tag: true } },
        },
      }),
      prisma.problem.count({ where }),
    ]);

    const problems = rawProblems.map((p: ProblemWithTags) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      difficulty: p.difficulty,
      tags: p.tags.map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        slug: pt.tag.slug,
      })),
    }));

    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json({ tag, problems, total, page, limit });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}
