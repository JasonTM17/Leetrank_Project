/**
 * Admin analytics aggregator.
 *
 * Pulls four small time-series + distribution rollups for the
 * /admin/analytics dashboard. All four queries are cheap counts, but
 * the page renders them at once so we cache the bundle for 5 minutes
 * with `cache.remember` (single-flight) to absorb concurrent admin
 * page loads.
 *
 * Time-series queries use `prisma.$queryRaw` with parameterized SQL
 * (Postgres `date_trunc`). The categorical rollups use `groupBy` for
 * portability.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";

export interface MonthBucket {
  month: string;
  count: number;
}

export interface DayBucket {
  day: string;
  count: number;
}

export interface CategoryBucket {
  label: string;
  count: number;
}

export interface AnalyticsPayload {
  userGrowth: MonthBucket[];
  submissionVolume: DayBucket[];
  problemDifficulty: CategoryBucket[];
  topLanguages: CategoryBucket[];
  generatedAt: string;
}

const CACHE_KEY = "admin:analytics:v1";
const TTL_MS = 5 * 60 * 1000;

interface RawMonthRow {
  month: Date | string;
  count: bigint | number;
}

interface RawDayRow {
  day: Date | string;
  count: bigint | number;
}

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

function toNumber(n: bigint | number | null | undefined): number {
  if (n === null || n === undefined) return 0;
  return typeof n === "bigint" ? Number(n) : n;
}

async function userGrowthLast12Months(): Promise<MonthBucket[]> {
  // 12-month rolling window — `date_trunc('month', ...)` collapses the
  // user createdAt timestamps to month-start. Dates are bound via
  // Prisma.sql template so the literal is parameterized.
  const rows = await prisma.$queryRaw<RawMonthRow[]>(Prisma.sql`
    SELECT date_trunc('month', "createdAt") AS month,
           COUNT(*)::int AS count
    FROM "User"
    WHERE "createdAt" >= NOW() - INTERVAL '12 months'
    GROUP BY 1
    ORDER BY 1 ASC
  `);
  return rows.map((r) => ({ month: toIso(r.month), count: toNumber(r.count) }));
}

async function submissionVolumeLast30Days(): Promise<DayBucket[]> {
  const rows = await prisma.$queryRaw<RawDayRow[]>(Prisma.sql`
    SELECT date_trunc('day', "createdAt") AS day,
           COUNT(*)::int AS count
    FROM "Submission"
    WHERE "createdAt" >= NOW() - INTERVAL '30 days'
    GROUP BY 1
    ORDER BY 1 ASC
  `);
  return rows.map((r) => ({ day: toIso(r.day), count: toNumber(r.count) }));
}

async function problemsByDifficulty(): Promise<CategoryBucket[]> {
  const rows = await prisma.problem.groupBy({
    by: ["difficulty"],
    _count: { _all: true },
  });
  // Stable display order: easy → medium → hard, then anything else
  // alphabetised. Avoids the Prisma groupBy result order bouncing
  // between renders.
  const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
  return rows
    .map((r) => ({ label: r.difficulty, count: r._count._all }))
    .sort((a, b) => {
      const ai = order[a.label] ?? 99;
      const bi = order[b.label] ?? 99;
      if (ai !== bi) return ai - bi;
      return a.label.localeCompare(b.label);
    });
}

async function topLanguagesBySubmissions(limit = 10): Promise<CategoryBucket[]> {
  const rows = await prisma.submission.groupBy({
    by: ["language"],
    _count: { _all: true },
    orderBy: { _count: { language: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ label: r.language, count: r._count._all }));
}

/**
 * Bundle aggregator. Cached for 5 minutes with single-flight loader so
 * concurrent admin page loads collapse to one DB hit.
 */
export async function loadAnalytics(): Promise<AnalyticsPayload> {
  // The shared cache singleton is typed `TTLCache<unknown>`, so cast the
  // memoised return back to our payload type at the boundary.
  const result = await cache.remember(CACHE_KEY, TTL_MS, async () => {
    const [userGrowth, submissionVolume, problemDifficulty, topLanguages] =
      await Promise.all([
        userGrowthLast12Months(),
        submissionVolumeLast30Days(),
        problemsByDifficulty(),
        topLanguagesBySubmissions(10),
      ]);
    return {
      userGrowth,
      submissionVolume,
      problemDifficulty,
      topLanguages,
      generatedAt: new Date().toISOString(),
    };
  });
  return result as AnalyticsPayload;
}
