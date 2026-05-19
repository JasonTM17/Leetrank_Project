/**
 * Pure Glicko-2 rating engine, no external deps.
 *
 * Reference: Glickman 2013, "Example of the Glicko-2 system"
 *   http://www.glicko.net/glicko/glicko2.pdf
 *
 * Public scale: ratings are stored as friendly integers centred on 1500.
 * Internal scale: Glickman's µ (rating - 1500) / 173.7178, φ = rd / 173.7178.
 *
 * Per ADR 0021:
 *  - Newcomer defaults: rating=1500, RD=350, σ=0.06.
 *  - System constant τ pinned at 0.5 (conservative end of the 0.3–1.2 band).
 *  - N-way contests reduce to N(N-1)/2 virtual head-to-head pairs scored
 *    1.0 / 0.5 / 0.0 by relative standing (1st > 2nd, ties = draw).
 *
 * Exported entry points:
 *   - calculateRatingChanges(participants): one update pass over all entries.
 *   - inflateInactivity(state): RD growth for users who skipped a contest.
 */

export const RATING_SCALE = 173.7178;
export const RATING_BASE = 1500;
export const SYSTEM_TAU = 0.5;
export const CONVERGENCE_EPSILON = 1e-6;

export const DEFAULT_RATING = 1500;
export const DEFAULT_RD = 350;
export const DEFAULT_VOLATILITY = 0.06;

/** Public-scale rating state for a single user before an update. */
export interface RatingState {
  userId: string;
  rating: number;            // public scale, e.g. 1500
  ratingDeviation: number;   // public scale, e.g. 350
  ratingVolatility: number;  // raw σ, e.g. 0.06
}

/** A contest participant with their pre-contest state and final standing. */
export interface ContestParticipant extends RatingState {
  /** Final placement: 1 = winner. Ties share the same rank. */
  rank: number;
}

/** Output row produced by `calculateRatingChanges` for a single user. */
export interface RatingChangeResult {
  userId: string;
  beforeRating: number;
  afterRating: number;
  delta: number;
  beforeRd: number;
  afterRd: number;
  beforeVolatility: number;
  afterVolatility: number;
  rank: number;
}

/** Convert public rating → Glickman µ. */
export function toMu(rating: number): number {
  return (rating - RATING_BASE) / RATING_SCALE;
}

/** Convert public RD → Glickman φ. */
export function toPhi(rd: number): number {
  return rd / RATING_SCALE;
}

/** Convert Glickman µ → public rating. */
export function fromMu(mu: number): number {
  return mu * RATING_SCALE + RATING_BASE;
}

/** Convert Glickman φ → public RD. */
export function fromPhi(phi: number): number {
  return phi * RATING_SCALE;
}

/** g(φ) helper from the Glickman paper. */
export function gPhi(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/** E(µ, µⱼ, φⱼ) helper — expected score against opponent j. */
export function expectedScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-gPhi(phiJ) * (mu - muJ)));
}

/**
 * Solve for new volatility σ' using Illinois algorithm (Glickman §5.4).
 *
 * Given pre-update state and the convenience quantities Δ and v, find the
 * σ' that satisfies f(x) = 0 where x = ln(σ²). The Illinois variant is
 * deterministic, monotone, and converges in <20 iterations for any
 * realistic input.
 */
export function newVolatility(
  phi: number,
  v: number,
  delta: number,
  sigma: number,
  tau: number = SYSTEM_TAU,
  epsilon: number = CONVERGENCE_EPSILON
): number {
  const a = Math.log(sigma * sigma);
  const phi2 = phi * phi;
  const delta2 = delta * delta;

  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num = ex * (delta2 - phi2 - v - ex);
    const den = 2 * Math.pow(phi2 + v + ex, 2);
    return num / den - (x - a) / (tau * tau);
  };

  let A = a;
  let B: number;
  if (delta2 > phi2 + v) {
    B = Math.log(delta2 - phi2 - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  let iterations = 0;
  while (Math.abs(B - A) > epsilon && iterations < 100) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
    iterations += 1;
  }

  return Math.exp(A / 2);
}

/**
 * Pairwise score for ranks: 1 if i wins, 0 if i loses, 0.5 if tie.
 * Lower rank value = better placement (rank 1 beats rank 2).
 */
export function scoreFromRanks(rankI: number, rankJ: number): number {
  if (rankI < rankJ) return 1;
  if (rankI > rankJ) return 0;
  return 0.5;
}

/**
 * Apply Glicko-2 update equations to one user against a list of opponents.
 *
 * Implements §5.1–5.6 of Glickman 2013 against the µ/φ-scaled inputs.
 * The caller is responsible for converting from public scale and back.
 */
export function updateOne(
  mu: number,
  phi: number,
  sigma: number,
  opponents: Array<{ muJ: number; phiJ: number; score: number }>,
  tau: number = SYSTEM_TAU
): { mu: number; phi: number; sigma: number } {
  if (opponents.length === 0) {
    // No games this period: only RD inflates by volatility.
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { mu, phi: phiStar, sigma };
  }

  // §5.2 — variance v
  let vInverse = 0;
  for (const o of opponents) {
    const g = gPhi(o.phiJ);
    const e = expectedScore(mu, o.muJ, o.phiJ);
    vInverse += g * g * e * (1 - e);
  }
  const v = 1 / vInverse;

  // §5.3 — improvement Δ
  let deltaSum = 0;
  for (const o of opponents) {
    const g = gPhi(o.phiJ);
    const e = expectedScore(mu, o.muJ, o.phiJ);
    deltaSum += g * (o.score - e);
  }
  const delta = v * deltaSum;

  // §5.4 — new volatility σ'
  const sigmaPrime = newVolatility(phi, v, delta, sigma, tau);

  // §5.5 — pre-rating-period RD φ*
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);

  // §5.6 — new φ' and µ'
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * deltaSum;

  return { mu: muPrime, phi: phiPrime, sigma: sigmaPrime };
}

/**
 * Compute rating changes for every contestant in one contest.
 *
 * Reduces N-way standings to N(N-1)/2 pairwise virtual matches scored
 * 1.0/0.5/0.0 (win/tie/loss) by `rank`, then runs the Glicko-2 update on
 * each contestant against the rest of the field. RD/volatility produced
 * here is the post-contest state; persist it on User.* and snapshot the
 * delta in `RatingChange`.
 *
 * `rank` is 1-indexed and ties share rank (1, 2, 2, 4 …). Public-scale
 * inputs (rating in points, RD in points) are converted to Glickman µ/φ
 * internally and converted back on the way out.
 */
export function calculateRatingChanges(
  participants: ContestParticipant[],
  tau: number = SYSTEM_TAU
): RatingChangeResult[] {
  if (participants.length < 2) {
    return participants.map((p) => ({
      userId: p.userId,
      beforeRating: p.rating,
      afterRating: p.rating,
      delta: 0,
      beforeRd: p.ratingDeviation,
      afterRd: p.ratingDeviation,
      beforeVolatility: p.ratingVolatility,
      afterVolatility: p.ratingVolatility,
      rank: p.rank,
    }));
  }

  const internal = participants.map((p) => ({
    userId: p.userId,
    rank: p.rank,
    rating: p.rating,
    rd: p.ratingDeviation,
    volatility: p.ratingVolatility,
    mu: toMu(p.rating),
    phi: toPhi(p.ratingDeviation),
    sigma: p.ratingVolatility,
  }));

  // Per Glickman, every player is updated independently using opponents'
  // PRE-period state. We snapshot the inputs first so a player's update
  // doesn't poison their opponents' calculations.
  const results: RatingChangeResult[] = [];
  for (let i = 0; i < internal.length; i += 1) {
    const me = internal[i];
    const opponents: Array<{ muJ: number; phiJ: number; score: number }> = [];
    for (let j = 0; j < internal.length; j += 1) {
      if (i === j) continue;
      const opp = internal[j];
      opponents.push({
        muJ: opp.mu,
        phiJ: opp.phi,
        score: scoreFromRanks(me.rank, opp.rank),
      });
    }

    const next = updateOne(me.mu, me.phi, me.sigma, opponents, tau);
    const newRating = Math.round(fromMu(next.mu));
    const newRd = Math.max(30, Math.round(fromPhi(next.phi)));

    results.push({
      userId: me.userId,
      beforeRating: me.rating,
      afterRating: newRating,
      delta: newRating - me.rating,
      beforeRd: me.rd,
      afterRd: newRd,
      beforeVolatility: me.volatility,
      afterVolatility: next.sigma,
      rank: me.rank,
    });
  }

  return results;
}

/**
 * RD inflation for users who skipped a rating period.
 *
 * Per ADR 0021: when a user hasn't competed in 30+ days, their RD is bumped
 * up by the standard Glicko-2 RD-growth formula so the next contest treats
 * their rating with appropriate uncertainty. Caller invokes once per dormant
 * user; RD is clamped to the newcomer band ceiling.
 */
export function inflateInactivity(
  state: RatingState
): RatingState {
  const phi = toPhi(state.ratingDeviation);
  const phiStar = Math.sqrt(phi * phi + state.ratingVolatility * state.ratingVolatility);
  const inflatedRd = Math.min(DEFAULT_RD, Math.round(fromPhi(phiStar)));
  return { ...state, ratingDeviation: inflatedRd };
}

/**
 * Codeforces-style division eligibility per ADR 0021.
 *
 *   div1: rating ≥ 1900
 *   div2: 1600 ≤ rating < 1900
 *   div3: rating < 1600
 *   open / null: any rating
 */
export type Division = "div1" | "div2" | "div3" | null;

export function isEligibleForDivision(rating: number, division: Division): boolean {
  if (!division) return true;
  switch (division) {
    case "div1":
      return rating >= 1900;
    case "div2":
      return rating >= 1600 && rating < 1900;
    case "div3":
      return rating < 1600;
    default:
      return true;
  }
}

/** Friendly division label suitable for UI badges; falls back to "open". */
export function divisionLabel(division: Division): string {
  switch (division) {
    case "div1":
      return "Div. 1";
    case "div2":
      return "Div. 2";
    case "div3":
      return "Div. 3";
    default:
      return "Open";
  }
}
