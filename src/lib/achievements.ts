import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// Public types ---------------------------------------------------------------

export type AchievementCriteria =
  | { type: "firstSolution" }
  | { type: "problemsSolved"; threshold: number }
  | { type: "difficultyMaster"; difficulty: "easy" | "medium" | "hard"; threshold: number }
  | { type: "polyglot"; threshold: number }
  | { type: "speedDemon"; maxRuntimeMs: number }
  | { type: "currentStreak"; threshold: number }
  | { type: "longestStreak"; threshold: number }
  | { type: "ratingThreshold"; threshold: number }
  | { type: "contestParticipated"; threshold: number }
  | { type: "contestTopRank"; threshold: number }
  | { type: "leaderboardTopN"; threshold: number }
  | { type: "discussionPosted"; threshold: number };

export interface AwardedAchievement {
  slug: string;
  title: string;
  icon: string;
  points: number;
}

// Counts derived once per evaluation -----------------------------------------

interface UserStats {
  totalAccepted: number;
  uniqueSolved: number;
  byDifficulty: { easy: number; medium: number; hard: number };
  uniqueLanguages: number;
  fastestRuntime: number | null;
  currentStreak: number;
  longestStreak: number;
  rating: number;
  contestEntries: number;
  bestRank: number | null;
  leaderboardRank: number | null;
  discussionPosts: number;
}

async function gatherStats(
  client: PrismaClient,
  userId: string
): Promise<UserStats | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, rating: true },
  });
  if (!user) return null;

  const [
    totalAccepted,
    acceptedRows,
    languageRows,
    fastestRow,
    streak,
    contestEntries,
    bestRankRow,
    leaderRank,
    discussionPosts,
  ] = await Promise.all([
    client.submission.count({ where: { userId, status: "accepted" } }),
    client.submission.findMany({
      where: { userId, status: "accepted" },
      select: { problemId: true, problem: { select: { difficulty: true } } },
      distinct: ["problemId"],
    }),
    client.submission.findMany({
      where: { userId, status: "accepted" },
      select: { language: true },
      distinct: ["language"],
    }),
    client.submission.findFirst({
      where: { userId, status: "accepted", runtime: { not: null } },
      orderBy: { runtime: "asc" },
      select: { runtime: true },
    }),
    client.dailyChallengeStreak.findUnique({ where: { userId } }),
    client.contestEntry.count({ where: { userId } }),
    client.contestEntry.findFirst({
      where: { userId, rank: { not: null } },
      orderBy: { rank: "asc" },
      select: { rank: true },
    }),
    (async () => {
      const better = await client.user.count({
        where: { rating: { gt: user.rating } },
      });
      return better + 1;
    })(),
    client.discussion.count({ where: { userId } }),
  ]);

  const byDifficulty = { easy: 0, medium: 0, hard: 0 };
  for (const row of acceptedRows) {
    const key = row.problem.difficulty.toLowerCase();
    if (key === "easy" || key === "medium" || key === "hard") {
      byDifficulty[key] += 1;
    }
  }

  return {
    totalAccepted,
    uniqueSolved: acceptedRows.length,
    byDifficulty,
    uniqueLanguages: languageRows.length,
    fastestRuntime: fastestRow?.runtime ?? null,
    currentStreak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    rating: user.rating,
    contestEntries,
    bestRank: bestRankRow?.rank ?? null,
    leaderboardRank: leaderRank,
    discussionPosts,
  };
}

// Pure criteria evaluators ---------------------------------------------------

export function evaluateCriteria(
  criteria: AchievementCriteria,
  stats: UserStats
): { earned: boolean; progress: number } {
  switch (criteria.type) {
    case "firstSolution":
      return { earned: stats.totalAccepted >= 1, progress: stats.totalAccepted };
    case "problemsSolved":
      return {
        earned: stats.uniqueSolved >= criteria.threshold,
        progress: Math.min(stats.uniqueSolved, criteria.threshold),
      };
    case "difficultyMaster": {
      const count = stats.byDifficulty[criteria.difficulty];
      return {
        earned: count >= criteria.threshold,
        progress: Math.min(count, criteria.threshold),
      };
    }
    case "polyglot":
      return {
        earned: stats.uniqueLanguages >= criteria.threshold,
        progress: Math.min(stats.uniqueLanguages, criteria.threshold),
      };
    case "speedDemon":
      return {
        earned:
          stats.fastestRuntime !== null && stats.fastestRuntime <= criteria.maxRuntimeMs,
        progress: stats.fastestRuntime ?? 0,
      };
    case "currentStreak":
      return {
        earned: stats.currentStreak >= criteria.threshold,
        progress: Math.min(stats.currentStreak, criteria.threshold),
      };
    case "longestStreak":
      return {
        earned: stats.longestStreak >= criteria.threshold,
        progress: Math.min(stats.longestStreak, criteria.threshold),
      };
    case "ratingThreshold":
      return {
        earned: stats.rating >= criteria.threshold,
        progress: Math.min(stats.rating, criteria.threshold),
      };
    case "contestParticipated":
      return {
        earned: stats.contestEntries >= criteria.threshold,
        progress: Math.min(stats.contestEntries, criteria.threshold),
      };
    case "contestTopRank":
      return {
        earned: stats.bestRank !== null && stats.bestRank <= criteria.threshold,
        progress: stats.bestRank ?? 0,
      };
    case "leaderboardTopN":
      return {
        earned:
          stats.leaderboardRank !== null && stats.leaderboardRank <= criteria.threshold,
        progress: stats.leaderboardRank ?? 0,
      };
    case "discussionPosted":
      return {
        earned: stats.discussionPosts >= criteria.threshold,
        progress: Math.min(stats.discussionPosts, criteria.threshold),
      };
  }
}

// Main entry — evaluate all achievements for a user --------------------------

export async function evaluateAchievements(
  userId: string,
  client: PrismaClient = defaultPrisma
): Promise<AwardedAchievement[]> {
  try {
    const stats = await gatherStats(client, userId);
    if (!stats) return [];

    const [allAchievements, alreadyEarned] = await Promise.all([
      client.achievement.findMany(),
      client.userAchievement.findMany({ where: { userId } }),
    ]);
    const earnedIds = new Set(alreadyEarned.map((u) => u.achievementId));
    const newlyAwarded: AwardedAchievement[] = [];

    for (const a of allAchievements) {
      let criteria: AchievementCriteria;
      try {
        criteria = a.criteriaJson as unknown as AchievementCriteria;
      } catch {
        continue;
      }
      const { earned, progress } = evaluateCriteria(criteria, stats);

      if (earned && !earnedIds.has(a.id)) {
        await client.userAchievement.upsert({
          where: { userId_achievementId: { userId, achievementId: a.id } },
          create: { userId, achievementId: a.id, progress },
          update: { progress },
        });
        newlyAwarded.push({
          slug: a.slug,
          title: a.title,
          icon: a.icon,
          points: a.points,
        });
      } else if (!earned) {
        // Track partial progress so the UI can show "37 / 50".
        await client.userAchievement
          .upsert({
            where: { userId_achievementId: { userId, achievementId: a.id } },
            create: { userId, achievementId: a.id, progress, earnedAt: new Date(0) },
            update: { progress },
          })
          .catch(() => undefined);
      }
    }

    return newlyAwarded;
  } catch (err) {
    // Non-fatal — never break a submission accept path because of badges.
    logger.error("evaluateAchievements_failed", { userId, err: String(err) });
    return [];
  }
}
