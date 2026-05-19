// Editorial unlock policy.
//
// Editorial markdown is gated to discourage early-look behaviour:
//   1) The user has submitted at least one solution to the problem, OR
//   2) The problem was created at least EDITORIAL_GRACE_DAYS ago.
//
// The auth boundary is enforced by the route handler — this module is
// pure logic so it can be unit-tested without spinning up a server.

export const EDITORIAL_GRACE_DAYS = 7;

export interface EditorialGateInput {
  problemCreatedAt: Date;
  hasSubmitted: boolean;
  /** Override "now" for deterministic tests. */
  now?: Date;
}

export interface EditorialGateResult {
  unlocked: boolean;
  unlocksAt: Date;
  /** Seconds until unlock; 0 when already unlocked. */
  countdownSeconds: number;
  reason: "submitted" | "grace-elapsed" | "locked";
}

export function evaluateEditorialGate(input: EditorialGateInput): EditorialGateResult {
  const now = input.now ?? new Date();
  const unlocksAt = new Date(
    input.problemCreatedAt.getTime() + EDITORIAL_GRACE_DAYS * 86_400_000
  );

  if (input.hasSubmitted) {
    return { unlocked: true, unlocksAt, countdownSeconds: 0, reason: "submitted" };
  }

  if (now.getTime() >= unlocksAt.getTime()) {
    return { unlocked: true, unlocksAt, countdownSeconds: 0, reason: "grace-elapsed" };
  }

  const countdownSeconds = Math.max(
    0,
    Math.ceil((unlocksAt.getTime() - now.getTime()) / 1000)
  );
  return { unlocked: false, unlocksAt, countdownSeconds, reason: "locked" };
}

// Hint reveal carries a documented scoring penalty in the leaderboard math —
// surfacing the value here keeps the UI copy and the (future) scoring code
// reading from the same constant.
export const HINT_REVEAL_PENALTY_PERCENT = 5;
