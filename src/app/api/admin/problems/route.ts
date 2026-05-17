import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

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

    const body = await request.json();
    const { title, slug, description, difficulty, hints, editorial, constraints, starterCode, order, tags, testCases } = body;

    if (!title || !slug || !description || !difficulty) {
      return Response.json({ error: "title, slug, description, and difficulty are required" }, { status: 400 });
    }

    const problem = await prisma.problem.create({
      data: {
        title,
        slug,
        description,
        difficulty,
        hints,
        editorial,
        constraints,
        starterCode,
        order: order ?? 0,
        tags: tags?.length
          ? {
              create: tags.map((tagId: string) => ({
                tag: { connect: { id: tagId } },
              })),
            }
          : undefined,
        testCases: testCases?.length
          ? {
              create: testCases.map((tc: { input: string; expected: string; isHidden?: boolean; order?: number }) => ({
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

    return Response.json({ problem }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
