import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const difficulty = searchParams.get("difficulty");
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");

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

    const problems = await prisma.problem.findMany({
      where,
      orderBy: { order: "asc" },
      include: {
        tags: { include: { tag: true } },
        _count: { select: { submissions: true } },
      },
    });

    const result = problems.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      difficulty: p.difficulty,
      tags: p.tags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name, slug: pt.tag.slug })),
      submissionCount: p._count.submissions,
    }));

    return Response.json({ problems: result });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
