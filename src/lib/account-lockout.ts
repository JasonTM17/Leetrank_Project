import { prisma } from "@/lib/db";

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LockoutStatus {
  locked: boolean;
  lockedUntil: Date | null;
  remainingMs: number;
}

export async function checkLockout(userId: string): Promise<LockoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true },
  });
  if (!user?.lockedUntil) return { locked: false, lockedUntil: null, remainingMs: 0 };
  const now = Date.now();
  const lockedUntilMs = user.lockedUntil.getTime();
  if (lockedUntilMs <= now) return { locked: false, lockedUntil: null, remainingMs: 0 };
  return { locked: true, lockedUntil: user.lockedUntil, remainingMs: lockedUntilMs - now };
}

export async function recordFailedLogin(userId: string): Promise<LockoutStatus> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });
  if (user.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil },
    });
    return { locked: true, lockedUntil, remainingMs: LOCKOUT_DURATION_MS };
  }
  return { locked: false, lockedUntil: null, remainingMs: 0 };
}

export async function resetFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
}

export const LOCKOUT_THRESHOLD = MAX_FAILED_ATTEMPTS;
export const LOCKOUT_DURATION = LOCKOUT_DURATION_MS;
