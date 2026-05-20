import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the prisma client
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import {
  checkLockout,
  recordFailedLogin,
  resetFailedLogins,
  LOCKOUT_THRESHOLD,
  LOCKOUT_DURATION,
} from "@/lib/account-lockout";

describe("account-lockout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkLockout", () => {
    it("returns unlocked when user has no lockedUntil", async () => {
      mockFindUnique.mockResolvedValueOnce({ lockedUntil: null });

      const result = await checkLockout("user-1");

      expect(result).toEqual({ locked: false, lockedUntil: null, remainingMs: 0 });
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { lockedUntil: true },
      });
    });

    it("returns unlocked when user is not found", async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      const result = await checkLockout("nonexistent");

      expect(result).toEqual({ locked: false, lockedUntil: null, remainingMs: 0 });
    });

    it("returns unlocked when lockout has expired", async () => {
      const pastDate = new Date("2026-01-15T11:00:00Z"); // 1 hour ago
      mockFindUnique.mockResolvedValueOnce({ lockedUntil: pastDate });

      const result = await checkLockout("user-1");

      expect(result).toEqual({ locked: false, lockedUntil: null, remainingMs: 0 });
    });

    it("returns locked with remaining time when lockout is active", async () => {
      const futureDate = new Date("2026-01-15T12:10:00Z"); // 10 min from now
      mockFindUnique.mockResolvedValueOnce({ lockedUntil: futureDate });

      const result = await checkLockout("user-1");

      expect(result.locked).toBe(true);
      expect(result.lockedUntil).toEqual(futureDate);
      expect(result.remainingMs).toBe(10 * 60 * 1000); // 10 minutes
    });
  });

  describe("recordFailedLogin", () => {
    it("increments count and returns unlocked when below threshold", async () => {
      mockUpdate.mockResolvedValueOnce({ failedLoginCount: 3 });

      const result = await recordFailedLogin("user-1");

      expect(result).toEqual({ locked: false, lockedUntil: null, remainingMs: 0 });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginCount: { increment: 1 } },
        select: { failedLoginCount: true },
      });
    });

    it("locks account when threshold is reached", async () => {
      mockUpdate
        .mockResolvedValueOnce({ failedLoginCount: LOCKOUT_THRESHOLD })
        .mockResolvedValueOnce({}); // second update for lockedUntil

      const result = await recordFailedLogin("user-1");

      expect(result.locked).toBe(true);
      expect(result.lockedUntil).toEqual(new Date(Date.now() + LOCKOUT_DURATION));
      expect(result.remainingMs).toBe(LOCKOUT_DURATION);
      // Verify the second update sets lockedUntil
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(mockUpdate).toHaveBeenLastCalledWith({
        where: { id: "user-1" },
        data: { lockedUntil: expect.any(Date) },
      });
    });

    it("locks account when count exceeds threshold", async () => {
      mockUpdate
        .mockResolvedValueOnce({ failedLoginCount: LOCKOUT_THRESHOLD + 5 })
        .mockResolvedValueOnce({});

      const result = await recordFailedLogin("user-1");

      expect(result.locked).toBe(true);
    });
  });

  describe("resetFailedLogins", () => {
    it("resets count and clears lockedUntil", async () => {
      mockUpdate.mockResolvedValueOnce({});

      await resetFailedLogins("user-1");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    });
  });

  describe("exported constants", () => {
    it("exports expected threshold and duration", () => {
      expect(LOCKOUT_THRESHOLD).toBe(10);
      expect(LOCKOUT_DURATION).toBe(15 * 60 * 1000);
    });
  });
});
