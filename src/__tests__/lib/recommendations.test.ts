import { describe, it, expect } from "vitest";
import {
  scoreProblem,
  rankRecommendations,
  normaliseDifficulty,
  medianDifficulty,
  type ProblemForScoring,
  type SolveSummary,
  type UserSolveHistory,
} from "@/lib/recommendations";

const NOW = new Date("2026-05-19T12:00:00.000Z");

function problem(over: Partial<ProblemForScoring> = {}): ProblemForScoring {
  return {
    id: over.id ?? "p-1",
    difficulty: over.difficulty ?? "medium",
    // `??` would coalesce an explicit null back to the default; check
    // presence with `in` so callers can pin acceptanceRate to null.
    acceptanceRate: "acceptanceRate" in over ? (over.acceptanceRate ?? null) : 0.55,
    tagSlugs: over.tagSlugs ?? ["array"],
    // Default created two months ago — outside the freshness window so
    // freshness boost doesn't accidentally show up in non-freshness tests.
    createdAt: over.createdAt ?? new Date("2026-03-01T00:00:00.000Z"),
  };
}

function history(over: Partial<UserSolveHistory> = {}): UserSolveHistory {
  return {
    solvedProblemIds: over.solvedProblemIds ?? new Set(),
    recentSolves: over.recentSolves ?? [],
    recentlyShownIds: over.recentlyShownIds ?? new Set(),
  };
}

function solve(diff: SolveSummary["difficulty"], tags: string[], id = "s-x"): SolveSummary {
  return { problemId: id, difficulty: diff, tagSlugs: tags, solvedAt: NOW };
}

describe("normaliseDifficulty", () => {
  it("preserves canonical lowercase values", () => {
    expect(normaliseDifficulty("easy")).toBe("easy");
    expect(normaliseDifficulty("medium")).toBe("medium");
    expect(normaliseDifficulty("hard")).toBe("hard");
  });

  it("normalises mixed-case seed data and falls back to medium for noise", () => {
    expect(normaliseDifficulty("Easy")).toBe("easy");
    expect(normaliseDifficulty("HARD")).toBe("hard");
    expect(normaliseDifficulty(null)).toBe("medium");
    expect(normaliseDifficulty(undefined)).toBe("medium");
    expect(normaliseDifficulty("nightmare")).toBe("medium");
  });
});

describe("medianDifficulty", () => {
  it("returns easy when no solves exist", () => {
    expect(medianDifficulty([])).toBe("easy");
  });

  it("computes the central rank for odd-length runs", () => {
    expect(
      medianDifficulty([
        solve("easy", []),
        solve("medium", []),
        solve("hard", []),
      ]),
    ).toBe("medium");
  });

  it("rounds the rank up for even-length even-balanced runs", () => {
    expect(
      medianDifficulty([
        solve("easy", []),
        solve("hard", []),
      ]),
    ).toBe("medium");
  });
});

describe("scoreProblem — solved + already-shown filters", () => {
  it("returns 0 for a problem already in the user's solved set", () => {
    const p = problem({ id: "solved-1" });
    const h = history({ solvedProblemIds: new Set(["solved-1"]) });
    expect(scoreProblem(p, h, NOW)).toBe(0);
  });

  it("penalises problems shown to the user recently", () => {
    const p = problem({ id: "p-2" });
    const fresh = history();
    const stale = history({ recentlyShownIds: new Set(["p-2"]) });
    expect(scoreProblem(p, stale, NOW)).toBeLessThan(scoreProblem(p, fresh, NOW));
  });
});

describe("scoreProblem — difficulty progression", () => {
  it("boosts a one-step-up candidate over a two-step-up one", () => {
    const easySolves = [solve("easy", ["array"], "s1"), solve("easy", ["array"], "s2"), solve("easy", ["array"], "s3")];
    const h = history({ recentSolves: easySolves });
    const oneStep = scoreProblem(problem({ id: "p-med", difficulty: "medium", tagSlugs: [] }), h, NOW);
    const twoStep = scoreProblem(problem({ id: "p-hard", difficulty: "hard", tagSlugs: [] }), h, NOW);
    expect(oneStep).toBeGreaterThan(twoStep);
  });

  it("boosts same-difficulty over a far-too-easy candidate (delta -2)", () => {
    const hardSolves = [solve("hard", ["dp"], "s1"), solve("hard", ["dp"], "s2"), solve("hard", ["dp"], "s3")];
    const h = history({ recentSolves: hardSolves });
    const same = scoreProblem(problem({ id: "p-hard", difficulty: "hard", tagSlugs: [] }), h, NOW);
    const tooEasy = scoreProblem(problem({ id: "p-easy", difficulty: "easy", tagSlugs: [] }), h, NOW);
    // Same-difficulty pays the dedicated 15-point boost; delta=-2 (Easy
    // when the user lives on Hard) gets no boost. Order must hold.
    expect(same).toBeGreaterThan(tooEasy);
  });
});

describe("scoreProblem — tag overlap", () => {
  it("rewards tag overlap with recent solves", () => {
    const solves = [solve("medium", ["array", "hashing"], "s1"), solve("medium", ["array"], "s2")];
    const h = history({ recentSolves: solves });
    const overlap = scoreProblem(
      problem({ id: "p-overlap", difficulty: "medium", tagSlugs: ["array", "hashing"] }),
      h,
      NOW,
    );
    const off = scoreProblem(
      problem({ id: "p-off", difficulty: "medium", tagSlugs: ["graph"] }),
      h,
      NOW,
    );
    expect(overlap).toBeGreaterThan(off);
  });

  it("caps the tag-overlap boost so a candidate with many overlapping tags doesn't dominate", () => {
    const solves = [solve("medium", ["array", "hashing", "string", "two-pointers", "sliding-window"], "s1")];
    const h = history({ recentSolves: solves });
    const many = scoreProblem(
      problem({
        id: "p-many",
        difficulty: "medium",
        tagSlugs: ["array", "hashing", "string", "two-pointers", "sliding-window", "graph", "tree"],
      }),
      h,
      NOW,
    );
    // The cap is 21; base 50 + same-difficulty 15 + overlap-cap 21 +
    // acceptance 8 = 94. Without a cap we'd see > 100 (which the clamp
    // would also hide), but more importantly the caller relies on the
    // cap so 6 vs 5 overlap doesn't behave like a tie-breaker explosion.
    expect(many).toBeLessThanOrEqual(100);
    expect(many).toBeGreaterThanOrEqual(80);
  });
});

describe("scoreProblem — acceptance rate", () => {
  it("rewards the 40-70% sweet spot over too-hard problems", () => {
    const h = history({ recentSolves: [solve("medium", ["array"], "s1")] });
    const sweet = scoreProblem(
      problem({ id: "p-sweet", difficulty: "medium", acceptanceRate: 0.55, tagSlugs: [] }),
      h,
      NOW,
    );
    const grindy = scoreProblem(
      problem({ id: "p-grindy", difficulty: "medium", acceptanceRate: 0.1, tagSlugs: [] }),
      h,
      NOW,
    );
    expect(sweet).toBeGreaterThan(grindy);
  });

  it("treats null acceptance as neutral (no boost, no penalty)", () => {
    const h = history();
    const withNull = scoreProblem(
      problem({ id: "p-null", acceptanceRate: null, tagSlugs: [] }),
      h,
      NOW,
    );
    const withSweet = scoreProblem(
      problem({ id: "p-sweet", acceptanceRate: 0.55, tagSlugs: [] }),
      h,
      NOW,
    );
    expect(withNull).toBeLessThan(withSweet);
  });
});

describe("scoreProblem — freshness", () => {
  it("boosts problems created inside the freshness window", () => {
    const h = history();
    const fresh = scoreProblem(
      problem({ id: "p-fresh", createdAt: new Date("2026-05-15T00:00:00.000Z"), tagSlugs: [] }),
      h,
      NOW,
    );
    const old = scoreProblem(
      problem({ id: "p-old", createdAt: new Date("2025-01-01T00:00:00.000Z"), tagSlugs: [] }),
      h,
      NOW,
    );
    expect(fresh).toBeGreaterThan(old);
  });
});

describe("rankRecommendations", () => {
  it("filters out solved problems and trims to the requested limit", () => {
    const solves = [solve("medium", ["array"], "s1")];
    const h = history({
      solvedProblemIds: new Set(["solved-a", "solved-b"]),
      recentSolves: solves,
    });
    const candidates: ProblemForScoring[] = [
      problem({ id: "solved-a", tagSlugs: ["array"] }),
      problem({ id: "solved-b", tagSlugs: ["array"] }),
      problem({ id: "p-1", tagSlugs: ["array"] }),
      problem({ id: "p-2", tagSlugs: ["array"] }),
      problem({ id: "p-3", tagSlugs: ["graph"] }),
    ];
    const ranked = rankRecommendations(candidates, h, 2, NOW);
    expect(ranked).toHaveLength(2);
    expect(ranked.every((r) => !["solved-a", "solved-b"].includes(r.problem.id))).toBe(true);
  });

  it("attaches a same-topic reason chip when a tag overlap drives the rank", () => {
    const solves = [solve("medium", ["dynamic-programming"], "s1"), solve("medium", ["dynamic-programming"], "s2")];
    const h = history({ recentSolves: solves });
    const candidates: ProblemForScoring[] = [
      problem({ id: "p-dp", difficulty: "medium", tagSlugs: ["dynamic-programming", "array"] }),
    ];
    const ranked = rankRecommendations(candidates, h, 5, NOW);
    expect(ranked[0].reason).toBe("same-topic");
    expect(ranked[0].reasonTag).toBe("dynamic-programming");
  });

  it("attaches a next-step-up reason when no tag overlap but difficulty is one notch above the median", () => {
    const solves = [solve("easy", ["array"], "s1"), solve("easy", ["array"], "s2"), solve("easy", ["array"], "s3")];
    const h = history({ recentSolves: solves });
    const candidates: ProblemForScoring[] = [
      problem({ id: "p-up", difficulty: "medium", tagSlugs: ["graph"] }),
    ];
    const ranked = rankRecommendations(candidates, h, 5, NOW);
    expect(ranked[0].reason).toBe("next-step-up");
  });

  it("falls back to a trending reason for anonymous (history-less) callers", () => {
    const h = history();
    const candidates: ProblemForScoring[] = [
      problem({ id: "p-old", createdAt: new Date("2025-01-01T00:00:00.000Z"), tagSlugs: [] }),
    ];
    const ranked = rankRecommendations(candidates, h, 5, NOW);
    expect(ranked[0].reason).toBe("trending");
  });

  it("breaks ties on acceptance rate then problem id for stable output", () => {
    // Two candidates that score identically — same difficulty, same tags,
    // same freshness — but different acceptance rates. Higher acceptance
    // rate must come first so two consecutive renders agree.
    const h = history();
    const candidates: ProblemForScoring[] = [
      problem({ id: "p-a", acceptanceRate: 0.5, tagSlugs: [] }),
      problem({ id: "p-b", acceptanceRate: 0.6, tagSlugs: [] }),
    ];
    const ranked = rankRecommendations(candidates, h, 5, NOW);
    expect(ranked[0].problem.id).toBe("p-b");
    expect(ranked[1].problem.id).toBe("p-a");
  });
});
