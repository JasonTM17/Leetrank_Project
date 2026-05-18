import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createProblemSchema, firstZodError } from "@/lib/validations";
import { invalidateProblemsCache } from "@/lib/cache-invalidate";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const difficulty = searchParams.get("difficulty");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (difficulty) where.difficulty = difficulty;
    if (search) where.title = { contains: search };

    const problems = await prisma.problem.findMany({
      where,
      orderBy: { order: "asc" },
      include: {
        tags: { include: { tag: true } },
        _count: { select: { submissions: true, testCases: true } },
      },
    });

    return Response.json({ problems });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createProblemSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const data = parsed.data;
    const problem = await prisma.problem.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        difficulty: data.difficulty,
        hints: data.hints || undefined,
        editorial: data.editorial || undefined,
        constraints: data.constraints || undefined,
        starterCode: data.starterCode || undefined,
        order: data.order,
        tags: data.tags.length
          ? { create: data.tags.map((tagId) => ({ tag: { connect: { id: tagId } } })) }
          : undefined,
        testCases: data.testCases.length
          ? {
              create: data.testCases.map((tc) => ({
                input: tc.input,
                expected: tc.expected,
                isHidden: tc.isHidden ?? false,
                order: tc.order ?? 0,
              })),
            }
          : undefined,
      },
      include: { tags: { include: { tag: true } }, testCases: true },
    });

    invalidateProblemsCache();

    return Response.json({ problem }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
