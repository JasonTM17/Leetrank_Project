/**
 * Seed: 20 HackerRank-parity achievements covering solving, difficulty,
 * polyglot, speed, streaks, rating, contest, and community categories.
 *
 * Run: pnpm prisma db seed (chained from prisma/seed.ts) or invoke directly:
 *   pnpm tsx prisma/seed-achievements.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedRow {
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  points: number;
  criteriaJson: Prisma.InputJsonValue;
  isHidden?: boolean;
}

const ACHIEVEMENTS: SeedRow[] = [
  {
    slug: "first-solution",
    title: "First Solution",
    description: "Submit your very first accepted solution.",
    icon: "Sparkles",
    category: "solving",
    points: 5,
    criteriaJson: { type: "firstSolution" },
  },
  {
    slug: "ten-solved",
    title: "Problem Solver",
    description: "Solve 10 unique problems.",
    icon: "CheckCircle2",
    category: "solving",
    points: 10,
    criteriaJson: { type: "problemsSolved", threshold: 10 },
  },
  {
    slug: "fifty-solved",
    title: "Half Century",
    description: "Solve 50 unique problems.",
    icon: "Target",
    category: "solving",
    points: 25,
    criteriaJson: { type: "problemsSolved", threshold: 50 },
  },
  {
    slug: "hundred-solved",
    title: "Centurion",
    description: "Solve 100 unique problems.",
    icon: "Trophy",
    category: "solving",
    points: 50,
    criteriaJson: { type: "problemsSolved", threshold: 100 },
  },
  {
    slug: "five-hundred-solved",
    title: "Grandmaster Solver",
    description: "Solve 500 unique problems.",
    icon: "Crown",
    category: "solving",
    points: 200,
    criteriaJson: { type: "problemsSolved", threshold: 500 },
  },
  {
    slug: "easy-master",
    title: "Easy Master",
    description: "Solve 50 problems rated Easy.",
    icon: "Leaf",
    category: "difficulty",
    points: 25,
    criteriaJson: { type: "difficultyMaster", difficulty: "easy", threshold: 50 },
  },
  {
    slug: "medium-master",
    title: "Medium Master",
    description: "Solve 50 problems rated Medium.",
    icon: "Swords",
    category: "difficulty",
    points: 60,
    criteriaJson: { type: "difficultyMaster", difficulty: "medium", threshold: 50 },
  },
  {
    slug: "hard-master",
    title: "Hard Master",
    description: "Solve 30 problems rated Hard.",
    icon: "Flame",
    category: "difficulty",
    points: 120,
    criteriaJson: { type: "difficultyMaster", difficulty: "hard", threshold: 30 },
  },
  {
    slug: "polyglot",
    title: "Polyglot",
    description: "Solve a problem in 5 different programming languages.",
    icon: "Languages",
    category: "skill",
    points: 40,
    criteriaJson: { type: "polyglot", threshold: 5 },
  },
  {
    slug: "speed-demon",
    title: "Speed Demon",
    description: "Submit an accepted solution that runs under 60 ms.",
    icon: "Zap",
    category: "skill",
    points: 30,
    criteriaJson: { type: "speedDemon", maxRuntimeMs: 60 },
  },
  {
    slug: "streak-starter",
    title: "Streak Starter",
    description: "Hit a 3-day daily-challenge streak.",
    icon: "Flame",
    category: "streak",
    points: 10,
    criteriaJson: { type: "currentStreak", threshold: 3 },
  },
  {
    slug: "streak-week",
    title: "Weekly Warrior",
    description: "Maintain a 7-day daily-challenge streak.",
    icon: "Calendar",
    category: "streak",
    points: 25,
    criteriaJson: { type: "currentStreak", threshold: 7 },
  },
  {
    slug: "streak-master",
    title: "Streak Master",
    description: "Maintain a 30-day daily-challenge streak.",
    icon: "Crown",
    category: "streak",
    points: 100,
    criteriaJson: { type: "currentStreak", threshold: 30 },
  },
  {
    slug: "centurion-streak",
    title: "Iron Discipline",
    description: "Reach a longest streak of 100 days.",
    icon: "Shield",
    category: "streak",
    points: 250,
    criteriaJson: { type: "longestStreak", threshold: 100 },
  },
  {
    slug: "rating-1600",
    title: "Pupil Promoted",
    description: "Reach a rating of 1600.",
    icon: "TrendingUp",
    category: "rating",
    points: 30,
    criteriaJson: { type: "ratingThreshold", threshold: 1600 },
  },
  {
    slug: "rating-1900",
    title: "Expert",
    description: "Reach a rating of 1900.",
    icon: "Star",
    category: "rating",
    points: 75,
    criteriaJson: { type: "ratingThreshold", threshold: 1900 },
  },
  {
    slug: "contest-finisher",
    title: "Contest Finisher",
    description: "Participate in 5 rated contests.",
    icon: "Medal",
    category: "contest",
    points: 30,
    criteriaJson: { type: "contestParticipated", threshold: 5 },
  },
  {
    slug: "contest-champion",
    title: "Contest Champion",
    description: "Finish first in any rated contest.",
    icon: "Trophy",
    category: "contest",
    points: 250,
    criteriaJson: { type: "contestTopRank", threshold: 1 },
  },
  {
    slug: "leaderboard-top-10",
    title: "Top 10 Leaderboard",
    description: "Crack the global top 10 leaderboard.",
    icon: "Crown",
    category: "leaderboard",
    points: 200,
    criteriaJson: { type: "leaderboardTopN", threshold: 10 },
  },
  {
    slug: "first-discussion",
    title: "Voice of the Community",
    description: "Post your first discussion thread.",
    icon: "MessageSquare",
    category: "community",
    points: 5,
    criteriaJson: { type: "discussionPosted", threshold: 1 },
  },
];

export async function seedAchievements(): Promise<void> {
  for (const row of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { slug: row.slug },
      create: row,
      update: {
        title: row.title,
        description: row.description,
        icon: row.icon,
        category: row.category,
        points: row.points,
        criteriaJson: row.criteriaJson,
        isHidden: row.isHidden ?? false,
      },
    });
  }
}

if (require.main === module) {
  seedAchievements()
    .then(() => {
      console.log(`Seeded ${ACHIEVEMENTS.length} achievements.`);
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
