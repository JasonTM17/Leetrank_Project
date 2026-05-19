import { describe, it, expect } from "vitest";
import {
  calculateRatingChanges,
  expectedScore,
  fromMu,
  fromPhi,
  gPhi,
  inflateInactivity,
  isEligibleForDivision,
  divisionLabel,
  newVolatility,
  scoreFromRanks,
  toMu,
  toPhi,
  updateOne,
  DEFAULT_RATING,
  DEFAULT_RD,
  DEFAULT_VOLATILITY,
} from "@/lib/rating/glicko2";

describe("glicko2: scale conversions", () => {
  it("toMu maps 1500 → 0 and is invertible", () => {
    expect(toMu(1500)).toBeCloseTo(0, 9);
    expect(fromMu(toMu(1873))).toBeCloseTo(1873, 6);
  });

  it("toPhi maps 350 → 2.014 and is invertible", () => {
    expect(toPhi(350)).toBeCloseTo(2.0148, 4);
    expect(fromPhi(toPhi(120))).toBeCloseTo(120, 6);
  });
});

describe("glicko2: helper math", () => {
  it("gPhi(0) = 1 (no opponent uncertainty collapses to identity)", () => {
    expect(gPhi(0)).toBeCloseTo(1, 9);
  });

  it("gPhi shrinks toward 0 as φ grows", () => {
    expect(gPhi(2)).toBeLessThan(gPhi(1));
    expect(gPhi(5)).toBeLessThan(gPhi(2));
  });

  it("expectedScore is symmetric around equal µ", () => {
    expect(expectedScore(0, 0, 1)).toBeCloseTo(0.5, 9);
    const a = expectedScore(0.5, 0, 1);
    const b = expectedScore(0, 0.5, 1);
    expect(a + b).toBeCloseTo(1, 9);
  });

  it("scoreFromRanks: lower rank wins, equal rank is a tie", () => {
    expect(scoreFromRanks(1, 2)).toBe(1);
    expect(scoreFromRanks(2, 1)).toBe(0);
    expect(scoreFromRanks(3, 3)).toBe(0.5);
  });
});

describe("glicko2: Glickman reference walk-through", () => {
  // Glickman 2013 §3.2 worked example:
  //   You: 1500/200/0.06, opponents (1400/30, 1550/100, 1700/300),
  //   results 1, 0, 0  →  expected new rating ≈ 1464.06, new RD ≈ 151.52.
  it("matches the published example to within 0.5 rating points", () => {
    const mu = toMu(1500);
    const phi = toPhi(200);
    const opponents = [
      { muJ: toMu(1400), phiJ: toPhi(30), score: 1 },
      { muJ: toMu(1550), phiJ: toPhi(100), score: 0 },
      { muJ: toMu(1700), phiJ: toPhi(300), score: 0 },
    ];
    const out = updateOne(mu, phi, 0.06, opponents);
    const newRating = fromMu(out.mu);
    const newRd = fromPhi(out.phi);
    expect(newRating).toBeCloseTo(1464.06, 0);
    expect(newRd).toBeCloseTo(151.52, 0);
    // Volatility moves only slightly off 0.06 in the published example.
    expect(out.sigma).toBeGreaterThan(0.0599);
    expect(out.sigma).toBeLessThan(0.06);
  });
});

describe("glicko2: newVolatility solver", () => {
  it("returns a positive σ' close to input when no surprise", () => {
    const phi = toPhi(200);
    const sigmaPrime = newVolatility(phi, 1.7785, -0.483, 0.06);
    expect(sigmaPrime).toBeGreaterThan(0);
    expect(sigmaPrime).toBeCloseTo(0.06, 2);
  });

  it("does not blow up when input is degenerate (no opponents)", () => {
    // f(x) is well-defined even with delta = 0.
    const phi = toPhi(350);
    const out = newVolatility(phi, 1, 0, 0.06);
    expect(Number.isFinite(out)).toBe(true);
    expect(out).toBeGreaterThan(0);
  });
});

describe("glicko2: calculateRatingChanges", () => {
  it("newcomer winning: rating goes up, RD shrinks", () => {
    const results = calculateRatingChanges([
      { userId: "newcomer", rating: DEFAULT_RATING, ratingDeviation: DEFAULT_RD, ratingVolatility: DEFAULT_VOLATILITY, rank: 1 },
      { userId: "veteran-1", rating: 1700, ratingDeviation: 80, ratingVolatility: 0.05, rank: 2 },
      { userId: "veteran-2", rating: 1650, ratingDeviation: 90, ratingVolatility: 0.05, rank: 3 },
    ]);

    const newcomer = results.find((r) => r.userId === "newcomer")!;
    expect(newcomer.delta).toBeGreaterThan(0);
    expect(newcomer.afterRd).toBeLessThan(DEFAULT_RD);
    // Newcomer beating two stronger players moves a lot.
    expect(newcomer.delta).toBeGreaterThan(50);
  });

  it("newcomer losing: rating goes down, RD shrinks", () => {
    const results = calculateRatingChanges([
      { userId: "veteran-1", rating: 1700, ratingDeviation: 80, ratingVolatility: 0.05, rank: 1 },
      { userId: "veteran-2", rating: 1650, ratingDeviation: 90, ratingVolatility: 0.05, rank: 2 },
      { userId: "newcomer", rating: DEFAULT_RATING, ratingDeviation: DEFAULT_RD, ratingVolatility: DEFAULT_VOLATILITY, rank: 3 },
    ]);

    const newcomer = results.find((r) => r.userId === "newcomer")!;
    expect(newcomer.delta).toBeLessThan(0);
    expect(newcomer.afterRd).toBeLessThan(DEFAULT_RD);
  });

  it("conserves zero-sum-ish across the whole field", () => {
    const results = calculateRatingChanges([
      { userId: "a", rating: 1500, ratingDeviation: 200, ratingVolatility: 0.06, rank: 1 },
      { userId: "b", rating: 1500, ratingDeviation: 200, ratingVolatility: 0.06, rank: 2 },
      { userId: "c", rating: 1500, ratingDeviation: 200, ratingVolatility: 0.06, rank: 3 },
      { userId: "d", rating: 1500, ratingDeviation: 200, ratingVolatility: 0.06, rank: 4 },
    ]);
    // Equal-rated symmetric field: total delta should be ~0 (rounding only).
    const total = results.reduce((s, r) => s + r.delta, 0);
    expect(Math.abs(total)).toBeLessThanOrEqual(2);
  });

  it("single participant: no rating change", () => {
    const results = calculateRatingChanges([
      { userId: "lonely", rating: 1600, ratingDeviation: 100, ratingVolatility: 0.06, rank: 1 },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].delta).toBe(0);
    expect(results[0].afterRating).toBe(1600);
  });

  it("higher rank loses to lower rank in pairwise scoring", () => {
    const results = calculateRatingChanges([
      { userId: "winner", rating: 1500, ratingDeviation: 100, ratingVolatility: 0.06, rank: 1 },
      { userId: "loser", rating: 1500, ratingDeviation: 100, ratingVolatility: 0.06, rank: 2 },
    ]);
    const winner = results.find((r) => r.userId === "winner")!;
    const loser = results.find((r) => r.userId === "loser")!;
    expect(winner.delta).toBeGreaterThan(0);
    expect(loser.delta).toBeLessThan(0);
    // Symmetric scenario → equal magnitude.
    expect(winner.delta).toBe(-loser.delta);
  });
});

describe("glicko2: inactivity inflation", () => {
  it("RD grows but stays clamped at the newcomer ceiling", () => {
    const inflated = inflateInactivity({
      userId: "u",
      rating: 1500,
      ratingDeviation: 80,
      ratingVolatility: 0.06,
    });
    expect(inflated.ratingDeviation).toBeGreaterThan(80);
    expect(inflated.ratingDeviation).toBeLessThanOrEqual(DEFAULT_RD);
  });

  it("already-maxed RD stays at the ceiling", () => {
    const inflated = inflateInactivity({
      userId: "u",
      rating: 1500,
      ratingDeviation: DEFAULT_RD,
      ratingVolatility: 0.06,
    });
    expect(inflated.ratingDeviation).toBe(DEFAULT_RD);
  });
});

describe("glicko2: division eligibility", () => {
  it("div1 admits ≥1900", () => {
    expect(isEligibleForDivision(2000, "div1")).toBe(true);
    expect(isEligibleForDivision(1900, "div1")).toBe(true);
    expect(isEligibleForDivision(1899, "div1")).toBe(false);
  });

  it("div2 admits 1600..1899", () => {
    expect(isEligibleForDivision(1600, "div2")).toBe(true);
    expect(isEligibleForDivision(1899, "div2")).toBe(true);
    expect(isEligibleForDivision(1900, "div2")).toBe(false);
    expect(isEligibleForDivision(1599, "div2")).toBe(false);
  });

  it("div3 admits <1600", () => {
    expect(isEligibleForDivision(1599, "div3")).toBe(true);
    expect(isEligibleForDivision(1600, "div3")).toBe(false);
  });

  it("null division is open to all", () => {
    expect(isEligibleForDivision(800, null)).toBe(true);
    expect(isEligibleForDivision(3000, null)).toBe(true);
  });

  it("divisionLabel produces friendly text", () => {
    expect(divisionLabel("div1")).toBe("Div. 1");
    expect(divisionLabel("div2")).toBe("Div. 2");
    expect(divisionLabel("div3")).toBe("Div. 3");
    expect(divisionLabel(null)).toBe("Open");
  });
});
