import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";

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
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

    // Skip the cache when search is active — search queries are unique
    // per-user and would blow up the LRU with one-shot keys.
    const cacheable = !search;
    const cacheKey = `problems:list:${difficulty ?? ""}:${tag ?? ""}:${page}:${limit}`;

    const compute = async (): Promise<ListResult> => {
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
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
