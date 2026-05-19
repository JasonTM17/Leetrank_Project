import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { GET } from "@/app/api/daily-challenge/route";

const utcDay = (y: number, m: number, d: number): Date =>
  new Date(Date.UTC(y, m - 1, d));

describe("GET /api/daily-challenge", () => {
  it("returns null challenge + null streak when no challenge exists and no session", async () => {
    prismaMock.dailyChallenge.findUnique.mockResolvedValue(null as never);

    const res = await GET(
      asNextRequest(new Request("http://x/api/daily-challenge"))
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.challenge).toBeNull();
    expect(body.streak).toBeNull();
    // anonymous response is publicly cacheable
    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("returns today's challenge for anonymous callers", async () => {
    prismaMock.dailyChallenge.findUnique.mockResolvedValue({
      id: "dc-1",
      date: utcDay(2026, 5, 19),
      completionCount: 42,
      problem: {
        id: "p-1",
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "easy",
        tags: [{ tag: { id: "t-1", name: "Array", slug: "array" } }],
      },
    } as never);

    const res = await GET(
      asNextRequest(new Request("http://x/api/daily-challenge"))
    );
    const body = await res.json();
    expect(body.challenge.problem.slug).toBe("two-sum");
    expect(body.challenge.completionCount).toBe(42);
    expect(body.challenge.problem.tags).toEqual([
      { id: "t-1", name: "Array", slug: "array" },
    ]);
    expect(body.streak).toBeNull();
  });

  it("includes streak data for authenticated callers", async () => {
    await loginAs({ userId: "u-1" });
    prismaMock.dailyChallenge.findUnique.mockResolvedValue({
      id: "dc-1",
      date: utcDay(2026, 5, 19),
      completionCount: 5,
      problem: {
        id: "p-1",
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "easy",
        tags: [],
      },
    } as never);
    prismaMock.dailyChallengeStreak.findUnique.mockResolvedValue({
      currentStreak: 6,
      longestStreak: 12,
      lastSolvedDate: new Date(),
    } as never);

    const res = await GET(
      asNextRequest(new Request("http://x/api/daily-challenge"))
    );
    const body = await res.json();
    expect(body.streak.currentStreak).toBe(6);
    expect(body.streak.longestStreak).toBe(12);
    expect(body.streak.active).toBe(true);
    expect(body.streak.solvedToday).toBe(true);
    // authed responses must not be publicly cached
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("zeroes lapsed streaks (last solve > 1 day ago)", async () => {
    await loginAs({ userId: "u-1" });
    prismaMock.dailyChallenge.findUnique.mockResolvedValue(null as never);
    const long = new Date();
    long.setUTCDate(long.getUTCDate() - 5);
    prismaMock.dailyChallengeStreak.findUnique.mockResolvedValue({
      currentStreak: 9,
      longestStreak: 9,
      lastSolvedDate: long,
    } as never);

    const res = await GET(
      asNextRequest(new Request("http://x/api/daily-challenge"))
    );
    const body = await res.json();
    expect(body.streak.currentStreak).toBe(0);
    expect(body.streak.active).toBe(false);
    expect(body.streak.longestStreak).toBe(9);
    expect(body.streak.solvedToday).toBe(false);
  });

  it("emits a zero-state streak when the user has never solved", async () => {
    await loginAs({ userId: "u-2" });
    prismaMock.dailyChallenge.findUnique.mockResolvedValue(null as never);
    prismaMock.dailyChallengeStreak.findUnique.mockResolvedValue(null as never);

    const res = await GET(
      asNextRequest(new Request("http://x/api/daily-challenge"))
    );
    const body = await res.json();
    expect(body.streak.currentStreak).toBe(0);
    expect(body.streak.longestStreak).toBe(0);
    expect(body.streak.lastSolvedDate).toBeNull();
    expect(body.streak.active).toBe(false);
  });

  it("returns 500 on db failure", async () => {
    prismaMock.dailyChallenge.findUnique.mockRejectedValue(new Error("boom"));
    const res = await GET(
      asNextRequest(new Request("http://x/api/daily-challenge"))
    );
    expect(res.status).toBe(500);
  });
});
