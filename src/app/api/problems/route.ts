import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";

const TTL_MS = 60_000;

interface ListResult {
  problems: Array<{
    id: string;
    title: string;
    slug: string;
    difficulty: string;
    tags: Array<{ id: string; name: string; slug: string }>;
    submissionCount: number;
  }>;
  total: number;
  page: number;
  limit: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const difficulty = searchParams.get("difficulty");
    const tag = searchParams.get("tag");
    // Tag-category aliases — `?topic=array` and `?company=google` match the
    // LeetCode-style URLs and lift the burden of remembering generic ?tag=.
    // Both are intersected when supplied together (e.g. company-tagged
    // problems that hit a specific topic).
    const topic = searchParams.get("topic");
    const company = searchParams.get("company");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

    // Skip the cache when search is active — search queries are unique
    // per-user and would blow up the LRU with one-shot keys.
    const cacheable = !search;
    const cacheKey = `problems:list:${difficulty ?? ""}:${tag ?? ""}:${topic ?? ""}:${company ?? ""}:${page}:${limit}`;

    const compute = async (): Promise<ListResult> => {
      const where: Record<string, unknown> = {};
      if (difficulty) where.difficulty = difficulty;
      // Bug-sweep 2026-05: Postgres LIKE is case-sensitive — without
      // `mode: "insensitive"` searching "two" misses "Two Sum".
      if (search) where.title = { contains: search, mode: "insensitive" };

      // Combine tag/topic/company into a single AND chain. Each clause
      // requires a distinct ProblemTag row matching the slug + category, so
      // a problem tagged with both "array" and "google" passes
      // ?topic=array&company=google.
      const tagClauses: Array<Record<string, unknown>> = [];
      if (tag) tagClauses.push({ tags: { some: { tag: { slug: tag } } } });
      if (topic) tagClauses.push({ tags: { some: { tag: { slug: topic, category: "topic" } } } });
      if (company) tagClauses.push({ tags: { some: { tag: { slug: company, category: "company" } } } });
      if (tagClauses.length === 1) {
        Object.assign(where, tagClauses[0]);
      } else if (tagClauses.length > 1) {
        where.AND = tagClauses;
      }

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

      const result = problems.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        difficulty: p.difficulty,
        tags: p.tags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name, slug: pt.tag.slug })),
        submissionCount: p._count.submissions,
      }));

      return { problems: result, total, page, limit };
    };

    const data = cacheable ? await cache.remember(cacheKey, TTL_MS, compute) : await compute();

    return Response.json(data, {
      headers: cacheable
        ? { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" }
        : { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.error("problems GET failed", { scope: "api/problems", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
