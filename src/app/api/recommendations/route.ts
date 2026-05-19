import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  rankRecommendations,
  normaliseDifficulty,
  type ProblemForScoring,
  type SolveSummary,
  type UserSolveHistory,
} from "@/lib/recommendations";

// GET /api/recommendations — personalised top-5 problem suggestions.
//
// Authed callers: scoreProblems() over their accepted-solve history.
// Anon callers: fall back to "trending" (highest accepted submission count
// across all time, capped at 5). Both paths cache for 30 min keyed per-user
// (or "anon") so the homepage hero panel doesn't re-hit Postgres on every
// hydration.

const LIMIT = 5;
const TTL_MS = 30 * 60_000;
const CANDIDATE_POOL_SIZE = 200;
const RECENT_SOLVES_WINDOW = 50;

export interface ApiRecommendation {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  reason: "same-topic" | "next-step-up" | "freshness" | "trending" | "general";
  reasonTag?: string;
}

async function loadCandidates(): Promise<ProblemForScoring[]> {
  const rows = await prisma.problem.findMany({
    take: CANDIDATE_POOL_SIZE,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      difficulty: true,
      acceptanceRate: true,
      createdAt: true,
      tags: { select: { tag: { select: { slug: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    difficulty: normaliseDifficulty(r.difficulty),
    acceptanceRate: r.acceptanceRate,
    tagSlugs: r.tags.map((t: { tag: { slug: string } }) => t.tag.slug),
    createdAt: r.createdAt,
  }));
}

async function loadUserHistory(userId: string): Promise<UserSolveHistory> {
  const subs = await prisma.submission.findMany({
    where: { userId, status: "accepted" },
    orderBy: { createdAt: "desc" },
    take: RECENT_SOLVES_WINDOW,
    select: {
      problemId: true,
      createdAt: true,
      problem: {
        select: {
          difficulty: true,
          tags: { select: { tag: { select: { slug: true } } } },
        },
      },
    },
  });
  const solvedProblemIds = new Set<string>();
  const recentSolves: SolveSummary[] = [];
  for (const s of subs) {
    solvedProblemIds.add(s.problemId);
    recentSolves.push({
      problemId: s.problemId,
      difficulty: normaliseDifficulty(s.problem?.difficulty),
      tagSlugs:
        s.problem?.tags.map((t: { tag: { slug: string } }) => t.tag.slug) ?? [],
      solvedAt: s.createdAt,
    });
  }
  return { solvedProblemIds, recentSolves, recentlyShownIds: new Set() };
}

async function attachMeta(
  ranked: { problemId: string; reason: ApiRecommendation["reason"]; reasonTag?: string }[],
): Promise<ApiRecommendation[]> {
  if (ranked.length === 0) return [];
  const ids = ranked.map((r) => r.problemId);
  const meta = await prisma.problem.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, slug: true, difficulty: true },
  });
  const byId = new Map(meta.map((m: { id: string; title: string; slug: string; difficulty: string }) => [m.id, m] as const));
  const out: ApiRecommendation[] = [];
  for (const r of ranked) {
    const m = byId.get(r.problemId);
    if (!m) continue;
    out.push({
      id: m.id,
      title: m.title,
      slug: m.slug,
      difficulty: m.difficulty,
      reason: r.reason,
      reasonTag: r.reasonTag,
    });
  }
  return out;
}

async function buildAnon(): Promise<ApiRecommendation[]> {
  const groups = await prisma.submission.groupBy({
    by: ["problemId"],
    _count: { _all: true },
    orderBy: { _count: { problemId: "desc" } },
    take: LIMIT,
  });
  if (groups.length === 0) {
    const fresh = await prisma.problem.findMany({
      take: LIMIT,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, slug: true, difficulty: true },
    });
    return fresh.map((p: { id: string; title: string; slug: string; difficulty: string }) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      difficulty: p.difficulty,
      reason: "trending" as const,
    }));
  }
  return attachMeta(
    groups.map((g: { problemId: string }) => ({ problemId: g.problemId, reason: "trending" as const })),
  );
}

async function buildAuthed(userId: string): Promise<ApiRecommendation[]> {
  const [history, candidates] = await Promise.all([
    loadUserHistory(userId),
    loadCandidates(),
  ]);
  const ranked = rankRecommendations(candidates, history, LIMIT);
  if (ranked.length === 0) return buildAnon();
  return attachMeta(
    ranked.map((r) => ({
      problemId: r.problem.id,
      reason: r.reason,
      reasonTag: r.reasonTag,
    })),
  );
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    const cacheKey = session ? `recs:user:${session.userId}` : "recs:anon";
    const recommendations = await cache.remember(cacheKey, TTL_MS, () =>
      session ? buildAuthed(session.userId) : buildAnon(),
    );
    return Response.json(
      { recommendations },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (err) {
    logger.error("recommendations GET failed", {
      scope: "api/recommendations",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
