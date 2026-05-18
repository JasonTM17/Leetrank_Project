import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/stats — public counters used by the homepage hero numbers.
// Cached for 60 seconds at the response layer; the actual reads run in
// parallel.
export async function GET(_request: NextRequest) {
  try {
    const [problems, contests, users, accepted] = await Promise.all([
      prisma.problem.count(),
      prisma.contest.count(),
      prisma.user.count(),
      prisma.submission.count({ where: { status: "accepted" } }),
    ]);

    return Response.json(
      { problems, contests, users, accepted },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
