import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const difficulty = searchParams.get("difficulty");
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

    const where: Record<string, unknown> = {};

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (search) {
      where.title = { contains: search };
    }

    if (tag) {
      where.tags = { some: { tag: { slug: tag } } };
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

    return Response.json({ problems: result, total, page, limit });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
