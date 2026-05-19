import { describe, it, expect, beforeEach } from "vitest";
import { requireAdmin } from "@/lib/admin-guard";
import { signToken } from "@/lib/auth";
import { setCookie } from "./setup";
import { _resetRateLimit } from "@/lib/rate-limit";

/**
 * admin-guard surfaces three distinct gates:
 *   1. session presence  -> 401
 *   2. role check        -> 403
 *   3. per-user rate cap -> 429 with Retry-After header
 *
 * Each test exercises exactly one of those branches so a regression in
 * any single gate produces a precise red test rather than a tangled
 * cascade. Cookies are cleared per-test by setup.ts; we still call
 * _resetRateLimit() at the start of the rate-limit test so the bucket
 * counter doesn't leak in from earlier "ok" calls in this file.
 */

async function setAdminCookie(userId = "admin-1") {
  const token = await signToken({
    userId,
    email: `${userId}@test.local`,
    username: userId,
    role: "admin",
  });
  setCookie("token", token);
}

async function setUserCookie() {
  const token = await signToken({
    userId: "user-1",
    email: "user-1@test.local",
    username: "user1",
    role: "user",
  });
  setCookie("token", token);
}

describe("requireAdmin", () => {
  beforeEach(() => {
    _resetRateLimit();
  });

  it("returns 401 Unauthorized when no session cookie is present", async () => {
    const gate = await requireAdmin();
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(401);
    const body = (await gate.response.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 Unauthorized when the cookie holds a malformed token", async () => {
    setCookie("token", "not-a-jwt");
    const gate = await requireAdmin();
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(401);
  });

  it("returns 403 Forbidden when the session role is not admin", async () => {
    await setUserCookie();
    const gate = await requireAdmin();
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.response.status).toBe(403);
    const body = (await gate.response.json()) as { error: string };
    expect(body.error).toBe("Forbidden");
  });

  it("passes for admin role and returns the decoded session", async () => {
    await setAdminCookie("admin-pass");
    const gate = await requireAdmin();
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.session.role).toBe("admin");
    expect(gate.session.userId).toBe("admin-pass");
    expect(gate.session.email).toBe("admin-pass@test.local");
  });

  it("returns 429 with Retry-After once the per-user rate cap is exceeded", async () => {
    await setAdminCookie("admin-rate");
    // The guard allows 60 admin actions per minute. Burn through the
    // budget, then expect the 61st call to be blocked.
    for (let i = 0; i < 60; i++) {
      const ok = await requireAdmin();
      expect(ok.ok).toBe(true);
    }
    const blocked = await requireAdmin();
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.response.status).toBe(429);
    const retry = blocked.response.headers.get("Retry-After");
    expect(retry).not.toBeNull();
    expect(Number(retry)).toBeGreaterThanOrEqual(1);
    const body = (await blocked.response.json()) as { error: string };
    expect(body.error).toMatch(/Slow down/i);
  });

  it("rate cap is keyed per-user so a different admin is unaffected", async () => {
    await setAdminCookie("admin-A");
    for (let i = 0; i < 60; i++) {
      await requireAdmin();
    }
    // Switch identities; admin-B should not inherit admin-A's bucket.
    await setAdminCookie("admin-B");
    const fresh = await requireAdmin();
    expect(fresh.ok).toBe(true);
  });
});
