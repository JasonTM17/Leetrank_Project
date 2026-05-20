import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// GET /api/stats — public counters used by the homepage hero numbers.
// Cached for 60 seconds at the response layer; the actual reads run in
// parallel.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  } catch (err) {
    logger.error("stats GET failed", { scope: "api/stats", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
