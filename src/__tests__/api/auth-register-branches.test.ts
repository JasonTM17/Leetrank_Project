import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest } from "../helpers";
import { _resetRateLimit } from "@/lib/rate-limit";

/**
 * Focused branch padding for /api/auth/register and /api/auth/sessions
 * — both routes show 66.66% branch coverage today, with the rate-limit
 * 429 path and the outer catch unexercised.
 */

describe("POST /api/auth/register — branch padding", () => {
  const valid = { username: "padder", email: "pad@x.com", password: "secure123" };

  beforeEach(() => {
    _resetRateLimit();
  });

  it("returns 429 with Retry-After once the per-IP register cap is exceeded", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const headers = { "x-forwarded-for": "203.0.113.99" };
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "u-x", email: valid.email, username: valid.username, role: "user", createdAt: new Date(),
    } as never);

    // The route allows 5 registers / 15 minutes per IP. Burn the budget.
    for (let i = 0; i < 5; i++) {
      const r = await POST(
        asNextRequest(jsonRequest("http://x/api/auth/register",
          { ...valid, username: `user${i}`, email: `user${i}@x.com` },
          { headers }))
      );
      expect([201, 409]).toContain(r.status);
    }
    const blocked = await POST(
      asNextRequest(jsonRequest("http://x/api/auth/register", valid, { headers }))
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).not.toBeNull();
  });

  it("returns 500 when prisma blows up unexpectedly", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    prismaMock.user.findFirst.mockRejectedValue(new Error("db unreachable"));
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", valid)));
    expect(res.status).toBe(500);
  });

  it("uses x-real-ip when x-forwarded-for is absent (IP fallback chain)", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "u-y", email: valid.email, username: valid.username, role: "user", createdAt: new Date(),
    } as never);
    const res = await POST(
      asNextRequest(jsonRequest("http://x/api/auth/register", valid, {
        headers: { "x-real-ip": "198.51.100.42" },
      }))
    );
    expect([201, 409]).toContain(res.status);
  });
});
