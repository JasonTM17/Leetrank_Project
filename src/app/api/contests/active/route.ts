import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/contests/active — returns contests currently in their live window.
// The status column is denormalised; a cron job moves contests through
// upcoming → active → ended on the right schedule. Filtering by status here
// (rather than recomputing from start/end) keeps the index path hot.
export async function GET(_request: NextRequest) {
  try {
    const contests = await prisma.contest.findMany({
      where: { status: "active" },
      orderBy: { startTime: "asc" },
      include: { _count: { select: { entries: true, problems: true } } },
    });

    return Response.json({ contests });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
