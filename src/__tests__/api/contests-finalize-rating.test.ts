import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { POST } from "@/app/api/contests/[slug]/finalize-rating/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

const url = "http://x/api/contests/spring-cup/finalize-rating";

function entry(userId: string, score: number, rating = 1500) {
  return {
    id: `e-${userId}`,
    userId,
    contestId: "c1",
    score,
    rank: null,
    joinedAt: new Date(),
    user: {
      id: userId,
      rating,
      maxRating: rating,
      ratingDeviation: 350,
      ratingVolatility: 0.06,
    },
  };
}

describe("POST /api/contests/[slug]/finalize-rating", () => {
  it("403 non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await POST(asNextRequest(jsonRequest(url, {})), paramsFor("spring-cup"));
    expect(res.status).toBe(403);
  });

  it("404 unknown contest", async () => {
    await loginAs({ role: "admin" });
    prismaMock.contest.findUnique.mockResolvedValue(null);
    const res = await POST(asNextRequest(jsonRequest(url, {})), paramsFor("spring-cup"));
    expect(res.status).toBe(404);
  });

  it("409 contest still running", async () => {
    await loginAs({ role: "admin" });
    prismaMock.contest.findUnique.mockResolvedValue({
      id: "c1",
      status: "active",
      endTime: new Date(Date.now() + 3600_000),
    } as never);
    const res = await POST(asNextRequest(jsonRequest(url, {})), paramsFor("spring-cup"));
    expect(res.status).toBe(409);
  });
});

describe("POST /api/contests/[slug]/finalize-rating: integration", () => {
  it("3 contestants → finalize → rows created in RatingChange", async () => {
    await loginAs({ role: "admin" });

    prismaMock.contest.findUnique.mockResolvedValue({
      id: "c1",
      status: "ended",
      endTime: new Date(Date.now() - 3600_000),
    } as never);
    prismaMock.ratingChange.count.mockResolvedValue(0 as never);
    prismaMock.contestEntry.findMany.mockResolvedValue([
      entry("u-winner", 300, 1500),
      entry("u-mid", 200, 1500),
      entry("u-loser", 100, 1500),
    ] as never);

    // We don't care what the transaction returns; we verify the calls.
    prismaMock.$transaction.mockResolvedValue([] as never);
    prismaMock.contestEntry.updateMany.mockResolvedValue({ count: 1 } as never);

    const res = await POST(asNextRequest(jsonRequest(url, {})), paramsFor("spring-cup"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.finalized).toBe(3);
    expect(data.changes).toHaveLength(3);

    const winner = data.changes.find((c: { userId: string }) => c.userId === "u-winner")!;
    const loser = data.changes.find((c: { userId: string }) => c.userId === "u-loser")!;
    expect(winner.rank).toBe(1);
    expect(loser.rank).toBe(3);
    expect(winner.delta).toBeGreaterThan(0);
    expect(loser.delta).toBeLessThan(0);

    // The transaction was called with user.update + ratingChange.create entries
    // for each of the 3 participants, plus the bulk updateMany + contest.update.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const txArg = prismaMock.$transaction.mock.calls[0][0] as unknown[];
    expect(Array.isArray(txArg)).toBe(true);
    // 3 user.update + 3 ratingChange.create + 1 contestEntry.updateMany + 1 contest.update
    expect(txArg.length).toBe(8);
  });

  it("422 when fewer than two participants", async () => {
    await loginAs({ role: "admin" });
    prismaMock.contest.findUnique.mockResolvedValue({
      id: "c1",
      status: "ended",
      endTime: new Date(Date.now() - 60_000),
    } as never);
    prismaMock.ratingChange.count.mockResolvedValue(0 as never);
    prismaMock.contestEntry.findMany.mockResolvedValue([entry("only", 100)] as never);
    const res = await POST(asNextRequest(jsonRequest(url, {})), paramsFor("spring-cup"));
    expect(res.status).toBe(422);
  });

  it("409 when rating already finalised (idempotency guard)", async () => {
    await loginAs({ role: "admin" });
    prismaMock.contest.findUnique.mockResolvedValue({
      id: "c1",
      status: "ended",
      endTime: new Date(Date.now() - 60_000),
    } as never);
    prismaMock.ratingChange.count.mockResolvedValue(3 as never);
    const res = await POST(asNextRequest(jsonRequest(url, {})), paramsFor("spring-cup"));
    expect(res.status).toBe(409);
  });
});

// Silence unused-import lint when vi is unused.
void vi;
