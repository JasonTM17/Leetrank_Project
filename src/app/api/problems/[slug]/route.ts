import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

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
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    return Response.json({
      problem: {
        id: problem.id,
        title: problem.title,
        slug: problem.slug,
        description: problem.description,
        difficulty: problem.difficulty,
        hints: problem.hints,
        editorial: problem.editorial,
        constraints: problem.constraints,
        starterCode: problem.starterCode,
        tags: problem.tags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name, slug: pt.tag.slug })),
        testCases: problem.testCases.map((tc) => ({
          id: tc.id,
          input: tc.input,
          expected: tc.expected,
          isHidden: tc.isHidden,
          order: tc.order,
        })),
      },
    });
  } catch (err) {
    logger.error("problems/[slug] GET failed", { scope: "api/problems/[slug]", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
