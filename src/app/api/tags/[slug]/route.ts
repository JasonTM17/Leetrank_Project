import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const tag = await prisma.tag.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });
    if (!tag) {
      return Response.json({ error: "Tag not found" }, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where: { tags: { some: { tagId: tag.id } } },
        orderBy: { order: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          difficulty: true,
          _count: { select: { submissions: true } },
        },
      }),
      prisma.problem.count({ where: { tags: { some: { tagId: tag.id } } } }),
    ]);

    return Response.json({ tag, problems, total, page, limit });
  } catch (err) {
    logger.error("tags/[slug] failed", { scope: "api/tags/[slug]", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
