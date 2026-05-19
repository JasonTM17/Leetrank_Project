import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Aggregate stats: total submissions, accepted count, unique solved.
    const [totalSubmissions, accepted, acceptedRows, recentSubmissions] = await Promise.all([
      prisma.submission.count({ where: { userId: user.id } }),
      prisma.submission.count({ where: { userId: user.id, status: "accepted" } }),
      prisma.submission.findMany({
        where: { userId: user.id, status: "accepted" },
        select: { problemId: true, problem: { select: { difficulty: true } } },
        distinct: ["problemId"],
      }),
      prisma.submission.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          language: true,
          createdAt: true,
          problem: { select: { id: true, title: true, slug: true, difficulty: true } },
        },
      }),
    ]);

    const solved = acceptedRows.length;
    const byDifficulty = { easy: 0, medium: 0, hard: 0 };
    for (const row of acceptedRows) {
      const diff = row.problem.difficulty.toLowerCase();
      if (diff === "easy" || diff === "medium" || diff === "hard") {
        byDifficulty[diff] += 1;
      }
    }

    return Response.json({
      user,
      stats: {
        totalSubmissions,
        accepted,
        solved,
        byDifficulty,
      },
      recentSubmissions,
    });
  } catch (err) {
    logger.error("users/[username] GET failed", { scope: "api/users/[username]", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
