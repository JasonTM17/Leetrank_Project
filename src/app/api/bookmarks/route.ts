import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const toggleSchema = z.object({
  problemId: z.string().min(1, "problemId is required"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const problemId = searchParams.get("problemId");

    if (problemId) {
      // Single-problem check used by the bookmark button on /problems/[slug].
      const bm = await prisma.bookmark.findUnique({
        where: { userId_problemId: { userId: session.userId, problemId } },
        select: { id: true },
      });
      return Response.json({ bookmarked: !!bm });
    }

    // Otherwise: full list for /dashboard.
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      include: {
        problem: {
          select: { id: true, title: true, slug: true, difficulty: true },
        },
      },
    });

    return Response.json({ bookmarks });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST toggles: creates if missing, deletes if present, returns the new state.
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

    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { problemId } = parsed.data;
    const existing = await prisma.bookmark.findUnique({
      where: { userId_problemId: { userId: session.userId, problemId } },
      select: { id: true },
    });

    if (existing) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
      return Response.json({ bookmarked: false });
    }

    // Verify the problem actually exists before creating the join row —
    // bookmarks pointing at deleted problems are noise.
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { id: true },
    });
    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    await prisma.bookmark.create({
      data: { userId: session.userId, problemId },
    });
    return Response.json({ bookmarked: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
