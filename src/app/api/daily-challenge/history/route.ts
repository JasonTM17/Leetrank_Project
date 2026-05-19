import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { toUtcDayStart } from "@/lib/daily-challenge";

// GET /api/daily-challenge/history?days=N — returns the last N daily
// challenges (most recent first). N is clamped to [1, 90] to prevent the
// caller from asking for unbounded history. Useful for dashboard heatmaps
// and the "previous challenges" list.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const raw = parseInt(searchParams.get("days") ?? "30", 10);
    const days = Number.isFinite(raw) ? Math.min(90, Math.max(1, raw)) : 30;

    const today = toUtcDayStart(new Date());
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const rows = await prisma.dailyChallenge.findMany({
      where: { date: { gte: start, lte: today } },
      orderBy: { date: "desc" },
      include: {
        problem: {
          select: { id: true, title: true, slug: true, difficulty: true },
        },
      },
    });

    const history = rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      completionCount: r.completionCount,
      problem: r.problem,
    }));

    return Response.json(
      { history, days },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    logger.error("daily-challenge history failed", {
      scope: "api/daily-challenge/history",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
