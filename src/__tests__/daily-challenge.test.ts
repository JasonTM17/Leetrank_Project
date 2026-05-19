import { describe, it, expect } from "vitest";
import {
  toUtcDayStart,
  daysBetweenUtc,
  isSameUtcDay,
  applyDailySolve,
  isStreakActive,
  effectiveCurrentStreak,
  type StreakState,
} from "@/lib/daily-challenge";

const utc = (y: number, m: number, d: number, h = 0, min = 0): Date =>
  new Date(Date.UTC(y, m - 1, d, h, min));

describe("toUtcDayStart", () => {
  it("snaps a mid-day timestamp to UTC midnight", () => {
    const d = utc(2026, 5, 19, 17, 30);
    expect(toUtcDayStart(d).toISOString()).toBe("2026-05-19T00:00:00.000Z");
  });

  it("is idempotent — already-midnight passes through", () => {
    const d = utc(2026, 5, 19);
    expect(toUtcDayStart(d).getTime()).toBe(d.getTime());
  });
});

describe("daysBetweenUtc", () => {
  it("returns 0 for same UTC day even across hours", () => {
    expect(daysBetweenUtc(utc(2026, 5, 19, 1), utc(2026, 5, 19, 23))).toBe(0);
  });

  it("returns 1 for consecutive days", () => {
    expect(daysBetweenUtc(utc(2026, 5, 19), utc(2026, 5, 20))).toBe(1);
  });

  it("can be negative for past dates", () => {
    expect(daysBetweenUtc(utc(2026, 5, 20), utc(2026, 5, 19))).toBe(-1);
  });

  it("crosses month boundaries cleanly", () => {
    expect(daysBetweenUtc(utc(2026, 5, 31), utc(2026, 6, 1))).toBe(1);
  });
});

describe("isSameUtcDay", () => {
  it("true within the same calendar day", () => {
    expect(isSameUtcDay(utc(2026, 5, 19, 0, 1), utc(2026, 5, 19, 23, 59))).toBe(true);
  });
  it("false across midnight", () => {
    expect(isSameUtcDay(utc(2026, 5, 19, 23, 59), utc(2026, 5, 20, 0, 1))).toBe(false);
  });
});

describe("applyDailySolve — first solve", () => {
  const empty: StreakState = { currentStreak: 0, longestStreak: 0, lastSolvedDate: null };

  it("starts a fresh streak at 1 and sets longest to at least 1", () => {
    const u = applyDailySolve(empty, utc(2026, 5, 19));
    expect(u.advanced).toBe(true);
    expect(u.state.currentStreak).toBe(1);
    expect(u.state.longestStreak).toBe(1);
    expect(u.state.lastSolvedDate?.toISOString()).toBe("2026-05-19T00:00:00.000Z");
  });

  it("preserves existing longestStreak record", () => {
    const prev: StreakState = { currentStreak: 0, longestStreak: 17, lastSolvedDate: null };
    const u = applyDailySolve(prev, utc(2026, 5, 19));
    expect(u.state.longestStreak).toBe(17);
  });
});

describe("applyDailySolve — same-day idempotency", () => {
  it("does not advance on a re-solve later the same UTC day", () => {
    const prev: StreakState = {
      currentStreak: 5,
      longestStreak: 5,
      lastSolvedDate: utc(2026, 5, 19),
    };
    const u = applyDailySolve(prev, utc(2026, 5, 19, 22));
    expect(u.advanced).toBe(false);
    expect(u.state.currentStreak).toBe(5);
    expect(u.state.longestStreak).toBe(5);
  });
});

describe("applyDailySolve — consecutive day", () => {
  it("increments by 1 when solved exactly the next UTC day", () => {
    const prev: StreakState = {
      currentStreak: 5,
      longestStreak: 5,
      lastSolvedDate: utc(2026, 5, 19),
    };
    const u = applyDailySolve(prev, utc(2026, 5, 20, 8));
    expect(u.advanced).toBe(true);
    expect(u.state.currentStreak).toBe(6);
    expect(u.state.longestStreak).toBe(6);
  });

  it("bumps longestStreak when current crosses the previous max", () => {
    const prev: StreakState = {
      currentStreak: 9,
      longestStreak: 9,
      lastSolvedDate: utc(2026, 5, 19),
    };
    const u = applyDailySolve(prev, utc(2026, 5, 20));
    expect(u.state.currentStreak).toBe(10);
    expect(u.state.longestStreak).toBe(10);
  });

  it("keeps longestStreak when current is still below it", () => {
    const prev: StreakState = {
      currentStreak: 4,
      longestStreak: 30,
      lastSolvedDate: utc(2026, 5, 19),
    };
    const u = applyDailySolve(prev, utc(2026, 5, 20));
    expect(u.state.currentStreak).toBe(5);
    expect(u.state.longestStreak).toBe(30);
  });
});

describe("applyDailySolve — gaps reset", () => {
  it("resets to 1 after a 2-day gap", () => {
    const prev: StreakState = {
      currentStreak: 12,
      longestStreak: 12,
      lastSolvedDate: utc(2026, 5, 19),
    };
    const u = applyDailySolve(prev, utc(2026, 5, 22));
    expect(u.advanced).toBe(true);
    expect(u.state.currentStreak).toBe(1);
    expect(u.state.longestStreak).toBe(12);
  });

  it("resets after a long absence but preserves longestStreak", () => {
    const prev: StreakState = {
      currentStreak: 8,
      longestStreak: 50,
      lastSolvedDate: utc(2026, 1, 1),
    };
    const u = applyDailySolve(prev, utc(2026, 5, 19));
    expect(u.state.currentStreak).toBe(1);
    expect(u.state.longestStreak).toBe(50);
  });

  it("treats a backdated solve (gap < 0) as a no-op", () => {
    const prev: StreakState = {
      currentStreak: 7,
      longestStreak: 7,
      lastSolvedDate: utc(2026, 5, 20),
    };
    const u = applyDailySolve(prev, utc(2026, 5, 18));
    expect(u.advanced).toBe(false);
    expect(u.state.currentStreak).toBe(7);
  });
});

describe("isStreakActive / effectiveCurrentStreak", () => {
  const base: StreakState = {
    currentStreak: 6,
    longestStreak: 10,
    lastSolvedDate: utc(2026, 5, 19),
  };

  it("active when last solve is today", () => {
    expect(isStreakActive(base, utc(2026, 5, 19, 18))).toBe(true);
    expect(effectiveCurrentStreak(base, utc(2026, 5, 19, 18))).toBe(6);
  });

  it("active when last solve was yesterday (grace day)", () => {
    expect(isStreakActive(base, utc(2026, 5, 20, 6))).toBe(true);
    expect(effectiveCurrentStreak(base, utc(2026, 5, 20, 6))).toBe(6);
  });

  it("lapsed once we are 2+ days past the last solve", () => {
    expect(isStreakActive(base, utc(2026, 5, 21))).toBe(false);
    expect(effectiveCurrentStreak(base, utc(2026, 5, 21))).toBe(0);
  });

  it("inactive when there is no last solve at all", () => {
    const empty: StreakState = { currentStreak: 0, longestStreak: 0, lastSolvedDate: null };
    expect(isStreakActive(empty, utc(2026, 5, 19))).toBe(false);
    expect(effectiveCurrentStreak(empty, utc(2026, 5, 19))).toBe(0);
  });

  it("inactive when persisted streak is 0 even if a date exists", () => {
    const odd: StreakState = {
      currentStreak: 0,
      longestStreak: 5,
      lastSolvedDate: utc(2026, 5, 19),
    };
    expect(isStreakActive(odd, utc(2026, 5, 19))).toBe(false);
  });
});

describe("applyDailySolve — multi-step trajectory", () => {
  it("walks day1 -> day2 -> day3 -> gap -> day7 correctly", () => {
    let s: StreakState = { currentStreak: 0, longestStreak: 0, lastSolvedDate: null };
    s = applyDailySolve(s, utc(2026, 5, 19)).state;
    s = applyDailySolve(s, utc(2026, 5, 20)).state;
    s = applyDailySolve(s, utc(2026, 5, 21)).state;
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
    s = applyDailySolve(s, utc(2026, 5, 25)).state;
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(3);
  });
});
