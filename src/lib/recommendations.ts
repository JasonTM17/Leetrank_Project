// LeetCode-style problem recommendation scoring.
//
// Pure, dependency-free math: callers (the API layer) load the user's solve
// history + a candidate pool from Prisma, and pass plain shapes here. No
// imports from @/lib/db so the scorer stays trivially unit-testable and we
// don't pin Prisma model shapes inside the algorithm.
//
// Output is a 0..100 score per problem; the caller sorts desc and slices the
// top N. The default weights are tuned around four signals:
//
//   1. Tag overlap with the user's recent solves — strongest "you'll like
//      this" signal because it preserves topic momentum.
//   2. Difficulty progression (Easy -> Medium -> Hard ladder). Same level
//      gets a steady boost; one step up gets the strongest boost (the
//      "next step" effect); two-steps-up is penalised because it's
//      demoralising; one step down is mildly accepted.
//   3. Acceptance rate sweet-spot (40%-70%) — too easy is boring, too hard
//      is frustrating.
//   4. Freshness + already-solved + recently-shown penalties so the same
//      list doesn't re-render across visits.
//
// Anonymous callers won't have a history, so `scoreProblem` collapses to a
// quality-only score (acceptance + freshness) and the API tier swaps in a
// curated trending list before serving.

export type Difficulty = "easy" | "medium" | "hard";

export interface ProblemForScoring {
  id: string;
  /** "easy" | "medium" | "hard". Caller normalises before passing in. */
  difficulty: Difficulty;
  /** 0..1 share of accepted submissions, or null when unknown. */
  acceptanceRate: number | null;
  /** Tag slugs (e.g. ["array", "hashing"]). Slugs preferred over names so
   *  case + spacing don't bias the overlap math. */
  tagSlugs: string[];
  /** Used for freshness boost. */
  createdAt: Date;
}

export interface SolveSummary {
  problemId: string;
  difficulty: Difficulty;
  tagSlugs: string[];
  solvedAt: Date;
}

export interface UserSolveHistory {
  /** Every problem the user has accepted at least once. Used to filter
   *  out solved problems from candidates. */
  solvedProblemIds: Set<string>;
  /** Most recent solves first (caller sorts). The first ~10 drive the
   *  signal; older entries fall off naturally. */
  recentSolves: SolveSummary[];
  /** Problems the user has been shown in the last hour or so. We don't
   *  need cryptographic accuracy here — a simple "we just rendered this"
   *  set is enough to avoid the same list re-rendering across pageloads.
   *  Empty set is fine. */
  recentlyShownIds: Set<string>;
}

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

/**
 * Normalise an arbitrary stored difficulty value (the seed data uses
 * mixed casing — "Easy" / "easy" / "EASY") to the canonical lowercase
 * form. Defaults to "medium" so a misclassified row doesn't bias the
 * progression heuristic toward the easy or hard extreme.
 */
export function normaliseDifficulty(input: string | null | undefined): Difficulty {
  if (!input) return "medium";
  const v = input.toLowerCase();
  if (v === "easy" || v === "medium" || v === "hard") return v;
  return "medium";
}

/**
 * Median difficulty rank across the user's recent solves. We use median
 * (not mean) because a single outlier hard problem shouldn't yank the
 * "next step" recommendation up by a full level.
 */
export function medianDifficulty(solves: readonly SolveSummary[]): Difficulty {
  if (solves.length === 0) return "easy";
  const ranks = solves.map((s) => DIFFICULTY_RANK[s.difficulty]).sort((a, b) => a - b);
  const mid = Math.floor(ranks.length / 2);
  const r = ranks.length % 2 === 0 ? Math.round((ranks[mid - 1] + ranks[mid]) / 2) : ranks[mid];
  return r === 0 ? "easy" : r === 1 ? "medium" : "hard";
}

interface ScoreWeights {
  base: number;
  sameDifficulty: number;
  oneStepUp: number;
  twoStepUp: number; // negative
  oneStepDown: number;
  tagOverlapPer: number;
  tagOverlapMax: number;
  acceptanceSweetSpot: number;
  acceptanceTooHard: number; // negative
  freshnessRecent: number;
  recentlyShown: number; // negative
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  base: 50,
  sameDifficulty: 15,
  oneStepUp: 20,
  twoStepUp: -25,
  oneStepDown: 5,
  tagOverlapPer: 7,
  tagOverlapMax: 21,
  acceptanceSweetSpot: 8,
  acceptanceTooHard: -6,
  freshnessRecent: 5,
  recentlyShown: -15,
};

const FRESHNESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Compute a 0..100 recommendation score for `problem` given a user's
 * `history`. Already-solved problems collapse to 0 so the API can include
 * them in the candidate pool without filtering up-front (lets us still
 * inspect the score in tests).
 *
 * `now` is injected so tests can pin freshness deterministically.
 */
export function scoreProblem(
  problem: ProblemForScoring,
  history: UserSolveHistory,
  now: Date = new Date(),
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  // Already solved -> 0. We don't want to recommend a problem the user
  // already cleared, even if every other signal lines up.
  if (history.solvedProblemIds.has(problem.id)) return 0;

  let score = weights.base;

  // Difficulty progression — anchored on the median of the user's recent
  // solves rather than a single most-recent solve, so a one-off easy
  // problem won't deflate a Medium-tier learner.
  if (history.recentSolves.length > 0) {
    const median = medianDifficulty(history.recentSolves);
    const delta = DIFFICULTY_RANK[problem.difficulty] - DIFFICULTY_RANK[median];
    if (delta === 0) score += weights.sameDifficulty;
    else if (delta === 1) score += weights.oneStepUp;
    else if (delta === 2) score += weights.twoStepUp;
    else if (delta === -1) score += weights.oneStepDown;
    // delta === -2 (Easy when user is on Hard) is mildly negative — fall
    // through with no boost; the absence of `sameDifficulty` already hurts.
  }

  // Tag overlap with the user's recent topic momentum. Cap the boost so
  // a candidate with 6 overlapping tags doesn't dominate the pool.
  if (history.recentSolves.length > 0 && problem.tagSlugs.length > 0) {
    const recentTagSet = new Set<string>();
    for (const s of history.recentSolves.slice(0, 10)) {
      for (const t of s.tagSlugs) recentTagSet.add(t);
    }
    let overlap = 0;
    for (const t of problem.tagSlugs) if (recentTagSet.has(t)) overlap += 1;
    score += Math.min(weights.tagOverlapMax, overlap * weights.tagOverlapPer);
  }

  // Acceptance-rate sweet spot — 40%..70% is the "challenging but solvable"
  // band most learners enjoy. Below 20% gets a small penalty (often
  // tricky-test-case grindfests).
  const ar = problem.acceptanceRate;
  if (ar !== null) {
    if (ar >= 0.4 && ar <= 0.7) score += weights.acceptanceSweetSpot;
    else if (ar < 0.2) score += weights.acceptanceTooHard;
  }

  // Freshness — recently-added problems get a small boost so the catalog
  // surfaces new material instead of stagnating on legacy classics.
  if (now.getTime() - problem.createdAt.getTime() < FRESHNESS_WINDOW_MS) {
    score += weights.freshnessRecent;
  }

  // Recently-shown penalty — keeps the rendered list rotating across
  // refreshes when scores are otherwise tied.
  if (history.recentlyShownIds.has(problem.id)) score += weights.recentlyShown;

  // Clamp to 0..100. The signed weights above can in theory leave the
  // running total outside that range; clamping makes the public contract
  // friendlier for UI rendering (progress bars, sort stability).
  return Math.max(0, Math.min(100, score));
}

export interface ScoredRecommendation {
  problem: ProblemForScoring;
  score: number;
  /** Machine-readable reason tag — UI maps this to a localised chip
   *  ("Same topic as ...", "Next step up", "Trending"). */
  reason: "same-topic" | "next-step-up" | "freshness" | "trending" | "general";
  /** First overlapping tag slug, when reason === "same-topic". Lets the
   *  UI render "Same topic as <tag>". */
  reasonTag?: string;
}

/**
 * Rank `candidates` by score and return the top `limit`, attaching a
 * lightweight machine-readable reason for the UI chip. Ties break on
 * acceptanceRate (higher first) then problem id (stable lexical) so two
 * runs with the same input produce the same output.
 */
export function rankRecommendations(
  candidates: readonly ProblemForScoring[],
  history: UserSolveHistory,
  limit: number,
  now: Date = new Date(),
): ScoredRecommendation[] {
  const scored = candidates
    .filter((p) => !history.solvedProblemIds.has(p.id))
    .map((p) => ({ problem: p, score: scoreProblem(p, history, now) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const arA = a.problem.acceptanceRate ?? 0;
      const arB = b.problem.acceptanceRate ?? 0;
      if (arB !== arA) return arB - arA;
      return a.problem.id.localeCompare(b.problem.id);
    })
    .slice(0, limit);

  const recentTagSet = new Set<string>();
  for (const s of history.recentSolves.slice(0, 10)) {
    for (const t of s.tagSlugs) recentTagSet.add(t);
  }
  const median = history.recentSolves.length > 0 ? medianDifficulty(history.recentSolves) : null;

  return scored.map(({ problem, score }) => {
    const overlap = problem.tagSlugs.find((t) => recentTagSet.has(t));
    if (overlap) return { problem, score, reason: "same-topic", reasonTag: overlap };
    if (median && DIFFICULTY_RANK[problem.difficulty] === DIFFICULTY_RANK[median] + 1) {
      return { problem, score, reason: "next-step-up" };
    }
    if (now.getTime() - problem.createdAt.getTime() < FRESHNESS_WINDOW_MS) {
      return { problem, score, reason: "freshness" };
    }
    if (history.recentSolves.length === 0) {
      return { problem, score, reason: "trending" };
    }
    return { problem, score, reason: "general" };
  });
}
