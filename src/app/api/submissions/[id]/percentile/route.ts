import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { cache } from "@/lib/cache";
import { computePercentile, runtimeDistribution } from "@/lib/analytics-helpers";

// GET /api/submissions/[id]/percentile
//
// "Beat X% of submissions" — computes where this submission's runtime
// lands among all accepted submissions for the same problem + language.
// Mirrors what LeetCode shows on a successful submission.
//
// Cache for 60s by submission id: a submission's runtime never changes
// post-judge, but the population it's compared against grows over
// time, so we don't want to cache forever. 60s strikes the usual
// balance between cost and freshness for this kind of "leaderboard
// style" data.
const TTL_MS = 60_000;
const MAX_BUCKETS = 20;
// Hard cap on the population we'll pull into memory. The percentile
// gets less informative past a few thousand submissions per
// language anyway, and we want to keep this endpoint fast.
const MAX_POPULATION = 5000;

interface PercentileResponse {
  percentile: number;
  runtime: number;
  language: string;
  totalSubmissions: number;
  runtimes: number[];
  distribution: ReturnType<typeof runtimeDistribution>;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const submission = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        problemId: true,
        language: true,
        runtime: true,
        status: true,
      },
    });

    if (!submission) {
      return Response.json({ error: "Submission not found" }, { status: 404 });
    }

    // Same access policy as the parent submission route — submissions
    // are private to their author and admins.
    if (submission.userId !== session.userId && session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (submission.status !== "accepted" || submission.runtime === null) {
      return Response.json(
        { error: "Percentile is only available for accepted submissions with a recorded runtime." },
        { status: 422 },
      );
    }

    const runtime = submission.runtime;
    const language = submission.language;

    const cacheKey = `submission:percentile:${submission.id}`;
    const payload = (await cache.remember(cacheKey, TTL_MS, async () => {
      // Pull every accepted runtime for the same problem + language.
      // We need the actual values (not just count) to render the
      // distribution chart. Order by runtime so the slice we keep when
      // the population exceeds MAX_POPULATION is representative.
      const peers = await prisma.submission.findMany({
        where: {
          problemId: submission.problemId,
          language: submission.language,
          status: "accepted",
          runtime: { not: null },
        },
        select: { runtime: true },
        orderBy: { runtime: "asc" },
        take: MAX_POPULATION,
      });

      const runtimes = peers
        .map((p) => p.runtime)
        .filter((r): r is number => typeof r === "number" && Number.isFinite(r));

      const percentile = computePercentile(runtime, runtimes);
      const distribution = runtimeDistribution(runtimes, MAX_BUCKETS);

      return {
        percentile,
        runtime,
        language,
        totalSubmissions: runtimes.length,
        runtimes,
        distribution,
      };
    })) as PercentileResponse;

    return Response.json(payload, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
