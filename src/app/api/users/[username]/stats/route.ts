import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/users/[username]/stats — JSON aggregate of a user's recent activity.
// Uses the last 30 days as the rolling window. Returns the per-day count of
// accepted submissions so the profile page can render a contribution heatmap
// without reaggregating client-side.
const WINDOW_DAYS = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const submissions = await prisma.submission.findMany({
      where: { userId: user.id, status: "accepted", createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Bucket by YYYY-MM-DD in UTC. Heatmaps are typically rendered against
    // UTC so the streak doesn't shift when a user travels.
    const byDay = new Map<string, number>();
    for (const s of submissions) {
      const key = s.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    return Response.json({
      windowDays: WINDOW_DAYS,
      total: submissions.length,
      byDay: Object.fromEntries(byDay),
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
