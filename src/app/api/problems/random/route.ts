import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// GET /api/problems/random — returns a single random problem, optionally
// filtered by difficulty. Used by the "I'm feeling lucky" CTA. Picks via
// SKIP rather than ORDER BY RANDOM() so we don't sort the whole table on
// every call.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const difficulty = searchParams.get("difficulty");
    const where: Record<string, unknown> = {};
    if (difficulty) where.difficulty = difficulty;

    const total = await prisma.problem.count({ where });
    if (total === 0) {
      return Response.json({ error: "No problems available" }, { status: 404 });
    }

    const skip = Math.floor(Math.random() * total);
    const [problem] = await prisma.problem.findMany({
      where,
      skip,
      take: 1,
      select: { id: true, title: true, slug: true, difficulty: true },
    });

    return Response.json({ problem });
  } catch (err) {
    logger.error("problems/random failed", { scope: "api/problems/random", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
