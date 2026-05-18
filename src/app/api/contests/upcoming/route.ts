import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// GET /api/contests/upcoming — returns contests that haven't started yet,
// ordered by startTime asc (closest one first). Used by the homepage and
// the contests-tab teaser to surface what's about to happen.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const contests = await prisma.contest.findMany({
      where: { status: "upcoming" },
      orderBy: { startTime: "asc" },
      take: limit,
      include: { _count: { select: { problems: true } } },
    });

    return Response.json({ contests });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
