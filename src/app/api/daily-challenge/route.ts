import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSession } from "@/lib/auth";
import {
  toUtcDayStart,
  effectiveCurrentStreak,
  isStreakActive,
  type StreakState,
} from "@/lib/daily-challenge";

// GET /api/daily-challenge — returns today's challenge (UTC day) plus, when
// the caller is authenticated, their streak summary. The response is shaped
// so the home banner can render in a single round-trip.
//
// Caching: today's challenge is the same for everyone, so we set a short
// public Cache-Control. The streak segment is per-user; it's only included
// when a session cookie is present, and we drop the cache header in that
// case to avoid leaking one user's streak to another.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const today = toUtcDayStart(new Date());

    const challenge = await prisma.dailyChallenge.findUnique({
      where: { date: today },
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            slug: true,
            difficulty: true,
            tags: { include: { tag: true } },
          },
        },
      },
    });

    const session = await getSession();

    let streakResponse: {
      currentStreak: number;
      longestStreak: number;
      lastSolvedDate: string | null;
      active: boolean;
      solvedToday: boolean;
    } | null = null;

    let solvedToday = false;
    if (session) {
      const row = await prisma.dailyChallengeStreak.findUnique({
        where: { userId: session.userId },
      });

      const state: StreakState = row
        ? {
            currentStreak: row.currentStreak,
            longestStreak: row.longestStreak,
            lastSolvedDate: row.lastSolvedDate,
          }
        : { currentStreak: 0, longestStreak: 0, lastSolvedDate: null };

      const now = new Date();
      // Solved-today is derived from lastSolvedDate falling on today's UTC
      // calendar day — cheaper than re-querying submissions.
      solvedToday =
        !!state.lastSolvedDate &&
        toUtcDayStart(state.lastSolvedDate).getTime() === today.getTime();

      streakResponse = {
        currentStreak: effectiveCurrentStreak(state, now),
        longestStreak: state.longestStreak,
        lastSolvedDate: state.lastSolvedDate ? state.lastSolvedDate.toISOString() : null,
        active: isStreakActive(state, now),
        solvedToday,
      };
    }

    const body = {
      challenge: challenge
        ? {
            id: challenge.id,
            date: challenge.date.toISOString(),
            completionCount: challenge.completionCount,
            problem: {
              id: challenge.problem.id,
              title: challenge.problem.title,
              slug: challenge.problem.slug,
              difficulty: challenge.problem.difficulty,
              tags: challenge.problem.tags.map((pt) => ({
                id: pt.tag.id,
                name: pt.tag.name,
                slug: pt.tag.slug,
              })),
            },
          }
        : null,
      streak: streakResponse,
    };

    return Response.json(body, {
      headers: session
        ? { "Cache-Control": "no-store" }
        : { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    logger.error("daily-challenge GET failed", {
      scope: "api/daily-challenge",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
