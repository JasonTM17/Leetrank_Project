// Pure streak math for the daily challenge feature.
//
// All dates are normalised to UTC midnight so streak counting is timezone
// independent. Callers in the API/cron paths build a `Date` from `new Date()`
// (or a Postgres timestamp) and pass it through `toUtcDayStart` before
// reaching any of these helpers — no timezones leak in.

/**
 * Snap a Date to UTC midnight of the same calendar day. Returns a fresh Date.
 * Used everywhere we compare days; passing the wrong-zone Date here is the
 * single most common source of off-by-one bugs in streak code.
 */
export function toUtcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Return the number of whole UTC days between `a` and `b` (b - a). Both
 * inputs are first snapped to UTC midnight so daylight-saving transitions
 * and partial-day timestamps don't bias the count.
 */
export function daysBetweenUtc(a: Date, b: Date): number {
  const aStart = toUtcDayStart(a).getTime();
  const bStart = toUtcDayStart(b).getTime();
  return Math.round((bStart - aStart) / (24 * 60 * 60 * 1000));
}

/** True when `a` and `b` refer to the same UTC calendar day. */
export function isSameUtcDay(a: Date, b: Date): boolean {
  return daysBetweenUtc(a, b) === 0;
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastSolvedDate: Date | null;
}

export interface StreakUpdate {
  state: StreakState;
  /** True when this solve actually advanced the streak (vs. a same-day re-solve). */
  advanced: boolean;
}

/**
 * Compute the new streak state after a user solves the daily challenge on
 * `solvedAt`. Pure: no IO, no side effects — the API layer persists the
 * returned `state`.
 *
 * Rules:
 * - First-ever solve: currentStreak = 1, longest = max(prev, 1).
 * - Same UTC day as last solve: no change (idempotent — multiple AC
 *   submissions on the same daily challenge do not inflate the streak).
 * - Exactly the next UTC day: streak += 1.
 * - Any larger gap: streak resets to 1 (the new solve starts a fresh run).
 * - longestStreak is monotonic — never decreases.
 */
export function applyDailySolve(prev: StreakState, solvedAt: Date): StreakUpdate {
  const today = toUtcDayStart(solvedAt);

  if (!prev.lastSolvedDate) {
    return {
      state: {
        currentStreak: 1,
        longestStreak: Math.max(1, prev.longestStreak),
        lastSolvedDate: today,
      },
      advanced: true,
    };
  }

  const last = toUtcDayStart(prev.lastSolvedDate);
  const gap = daysBetweenUtc(last, today);

  // Same day — already counted; no advancement, no decay.
  if (gap === 0) {
    return { state: { ...prev, lastSolvedDate: last }, advanced: false };
  }

  // Solving "yesterday" via a backdated event would be odd; treat it as
  // a no-op rather than letting the streak go backwards.
  if (gap < 0) {
    return { state: { ...prev, lastSolvedDate: last }, advanced: false };
  }

  const nextStreak = gap === 1 ? prev.currentStreak + 1 : 1;
  return {
    state: {
      currentStreak: nextStreak,
      longestStreak: Math.max(prev.longestStreak, nextStreak),
      lastSolvedDate: today,
    },
    advanced: true,
  };
}

/**
 * Decide whether the streak should be considered "active" relative to
 * `now`. Active = solved today or yesterday in UTC. Used by the UI to
 * decide between "Keep your streak alive" and "Start a new streak" copy.
 */
export function isStreakActive(state: StreakState, now: Date): boolean {
  if (!state.lastSolvedDate || state.currentStreak <= 0) return false;
  const gap = daysBetweenUtc(state.lastSolvedDate, now);
  return gap === 0 || gap === 1;
}

/**
 * Effective streak as displayed to the user. If the last solve was more
 * than one UTC day ago, the streak has lapsed and we surface 0 even though
 * the persisted `currentStreak` may still hold the pre-lapse value (we
 * only zero it on the next solve, not on a passive read).
 */
export function effectiveCurrentStreak(state: StreakState, now: Date): number {
  return isStreakActive(state, now) ? state.currentStreak : 0;
}

/**
 * If `problemId` is today's UTC daily-challenge problem, persist a streak
 * advancement and increment the challenge's completionCount. Safe to call
 * on every accepted submission — internally checks the daily-challenge row
 * and is idempotent for same-day re-solves.
 *
 * Caller passes the prisma client to avoid a circular dep with @/lib/db
 * (this module is also imported from the API layer's setup tests where
 * prisma is mocked).
 */
export async function recordDailySolveIfApplicable(
  prisma: {
    dailyChallenge: {
      findUnique: (args: { where: { date: Date } }) => Promise<{ id: string; problemId: string } | null>;
      update: (args: { where: { id: string }; data: { completionCount: { increment: number } } }) => Promise<unknown>;
    };
    dailyChallengeStreak: {
      findUnique: (args: { where: { userId: string } }) => Promise<{ currentStreak: number; longestStreak: number; lastSolvedDate: Date | null } | null>;
      upsert: (args: {
        where: { userId: string };
        create: { userId: string; currentStreak: number; longestStreak: number; lastSolvedDate: Date };
        update: { currentStreak: number; longestStreak: number; lastSolvedDate: Date };
      }) => Promise<unknown>;
    };
  },
  userId: string,
  problemId: string,
  now: Date = new Date(),
): Promise<{ advanced: boolean; matchedDailyChallenge: boolean }> {
  const today = toUtcDayStart(now);
  const challenge = await prisma.dailyChallenge.findUnique({ where: { date: today } });
  if (!challenge || challenge.problemId !== problemId) {
    return { advanced: false, matchedDailyChallenge: false };
  }

  const existing = await prisma.dailyChallengeStreak.findUnique({ where: { userId } });
  const prev: StreakState = existing
    ? {
        currentStreak: existing.currentStreak,
        longestStreak: existing.longestStreak,
        lastSolvedDate: existing.lastSolvedDate,
      }
    : { currentStreak: 0, longestStreak: 0, lastSolvedDate: null };

  const { state, advanced } = applyDailySolve(prev, today);

  await prisma.dailyChallengeStreak.upsert({
    where: { userId },
    create: {
      userId,
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastSolvedDate: state.lastSolvedDate ?? today,
    },
    update: {
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      lastSolvedDate: state.lastSolvedDate ?? today,
    },
  });

  if (advanced) {
    await prisma.dailyChallenge.update({
      where: { id: challenge.id },
      data: { completionCount: { increment: 1 } },
    });
  }

  return { advanced, matchedDailyChallenge: true };
}
