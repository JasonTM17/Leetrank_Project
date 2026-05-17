import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createDiscussionSchema, firstZodError } from "@/lib/validations";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const problemId = searchParams.get("problemId");
    if (!problemId) {
      return Response.json({ error: "problemId is required" }, { status: 400 });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const [discussions, total] = await Promise.all([
      prisma.discussion.findMany({
        where: { problemId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, username: true, avatar: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.discussion.count({ where: { problemId } }),
    ]);

    return Response.json({ discussions, total, page, limit });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createDiscussionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const problem = await prisma.problem.findUnique({
      where: { id: parsed.data.problemId },
      select: { id: true },
    });
    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    const discussion = await prisma.discussion.create({
      data: {
        problemId: parsed.data.problemId,
        userId: session.userId,
        title: parsed.data.title,
        body: parsed.data.body,
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    return Response.json({ discussion }, { status: 201 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
