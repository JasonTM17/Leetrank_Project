import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { calculateRatingChanges, type ContestParticipant } from "@/lib/rating/glicko2";
import { cache } from "@/lib/cache";
import { logger } from "@/lib/logger";

/**
 * POST /api/contests/[slug]/finalize-rating
 *
 * Admin-only. Finalises Glicko-2 ratings for every entry in a contest.
 * Idempotent against the (contestId, userId) unique on RatingChange:
 * re-running on a contest that already has snapshots is a 409 — admins
 * must explicitly delete snapshots to recompute, since rating math is
 * non-commutative across re-applications.
 *
 * Per ADR 0021 step 1–4:
 *  - Snapshot every entry's pre-contest rating state.
 *  - Reduce N-way standings to pairwise virtual matches via rank.
 *  - Run Glicko-2 once per user against the rest of the field.
 *  - Persist post values + RatingChange rows in a single transaction.
 *
 * Live leaderboard caches are busted afterwards so the rating column
 * reflects the new state on the next read.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;

    const { slug } = await params;
    const contest = await prisma.contest.findUnique({
      where: { slug },
      select: { id: true, status: true, endTime: true },
    });
    if (!contest) {
      return Response.json({ error: "Contest not found" }, { status: 404 });
    }

    // Allow finalisation for `ended` or contests whose end time has passed.
    // We don't auto-flip status here; admins control the visible state.
    const ended = contest.status === "ended" || contest.endTime.getTime() <= Date.now();
    if (!ended) {
      return Response.json(
        { error: "Contest is not finished yet" },
        { status: 409 }
      );
    }

    const existing = await prisma.ratingChange.count({ where: { contestId: contest.id } });
    if (existing > 0) {
      return Response.json(
        { error: "Rating already finalised for this contest" },
        { status: 409 }
      );
    }

    const entries = await prisma.contestEntry.findMany({
      where: { contestId: contest.id },
      orderBy: [{ score: "desc" }, { joinedAt: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            rating: true,
            maxRating: true,
            ratingDeviation: true,
            ratingVolatility: true,
          },
        },
      },
    });

    if (entries.length < 2) {
      return Response.json(
        { error: "Need at least two participants to finalise rating" },
        { status: 422 }
      );
    }

    // Standard competition ranking (1, 2, 2, 4 …) keyed on score.
    let prevScore: number | null = null;
    let prevRank = 0;
    const participants: ContestParticipant[] = entries.map((e, idx) => {
      const rank = e.score === prevScore ? prevRank : idx + 1;
      prevScore = e.score;
      prevRank = rank;
      return {
        userId: e.user.id,
        rating: e.user.rating,
        ratingDeviation: e.user.ratingDeviation,
        ratingVolatility: e.user.ratingVolatility,
        rank,
      };
    });

    const changes = calculateRatingChanges(participants);

    // Persist user updates + RatingChange rows + finalize contest status
    // in one transaction so a partial failure leaves the contest unrated.
    await prisma.$transaction([
      ...changes.map((c, i) => {
        const before = entries[i].user;
        const newMax = Math.max(before.maxRating, c.afterRating);
        return prisma.user.update({
          where: { id: c.userId },
          data: {
            rating: c.afterRating,
            maxRating: newMax,
            ratingDeviation: c.afterRd,
            ratingVolatility: c.afterVolatility,
          },
        });
      }),
      ...changes.map((c) =>
        prisma.ratingChange.create({
          data: {
            userId: c.userId,
            contestId: contest.id,
            beforeRating: c.beforeRating,
            afterRating: c.afterRating,
            delta: c.delta,
            rank: c.rank,
          },
        })
      ),
      prisma.contestEntry.updateMany({
        where: { contestId: contest.id },
        data: {},
      }),
      prisma.contest.update({
        where: { id: contest.id },
        data: { status: "ended" },
      }),
    ]);

    // Per-entry rank backfill (UPDATE WHERE userId): driver issues this
    // outside the bulk transaction list to keep the write set surgical.
    for (const c of changes) {
      await prisma.contestEntry.updateMany({
        where: { contestId: contest.id, userId: c.userId },
        data: { rank: c.rank },
      });
    }

    cache.delete(`contests:detail:${slug}`);
    cache.delete("contests:all");

    return Response.json({
      finalized: changes.length,
      changes: changes.map((c) => ({
        userId: c.userId,
        rank: c.rank,
        beforeRating: c.beforeRating,
        afterRating: c.afterRating,
        delta: c.delta,
      })),
    });
  } catch (err) {
    logger.error("contests/[slug]/finalize-rating failed", {
      scope: "api/contests/[slug]/finalize-rating",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
