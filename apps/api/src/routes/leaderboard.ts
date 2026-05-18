import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * Compute the top-N leaderboard, dedup-aware over (userId, problemId)
 * accepted submissions. Mirrors apps/web/src/app/api/leaderboard/top.
 *
 * No cache layer here yet — Phase 2 of ADR 0011 will introduce a Redis
 * client that both apps share. The web app's in-process TTLCache will
 * be retired once that lands.
 */

const TOP_N = 10;

interface TopEntry {
  rank: number;
  user: { id: string; username: string; avatar: string | null };
  solved: number;
}

async function computeTop(): Promise<TopEntry[]> {
  const accepted = await prisma.submission.groupBy({
    by: ["userId", "problemId"],
    where: { status: "accepted" },
  });

  const solvedByUser = new Map<string, number>();
  for (const row of accepted) {
    solvedByUser.set(row.userId, (solvedByUser.get(row.userId) ?? 0) + 1);
  }

  const ids = [...solvedByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([userId]) => userId);

  if (ids.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, avatar: true },
  });
  const byId = new Map(users.map((u: { id: string; username: string; avatar: string | null }) => [u.id, u]));

  return ids
    .map((id, i) => {
      const u = byId.get(id);
      if (!u) return null;
      return { rank: i + 1, user: u, solved: solvedByUser.get(id) ?? 0 };
    })
    .filter((x): x is TopEntry => x !== null);
}

export async function leaderboardTopHandler(c: Context) {
  try {
    const leaderboard = await computeTop();
    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return c.json({ leaderboard });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}
