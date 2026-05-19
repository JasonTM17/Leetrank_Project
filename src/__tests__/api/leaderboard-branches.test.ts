import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/leaderboard/route";

describe("GET /api/leaderboard — branch padding", () => {
  it("filters out users that have ranked but no longer exist (orphan rank rows)", async () => {
    // Two users have AC submissions, but only one is returned by user.findMany
    // (the other was deleted). Must not appear in the response.
    prismaMock.submission.groupBy.mockResolvedValue([
      { userId: "u1", problemId: "p1" },
      { userId: "u2", problemId: "p1" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", username: "alice", avatar: null, createdAt: new Date() },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard")));
    const data = await res.json();
    // u2 was orphaned → only u1 remains
    expect(data.leaderboard.map((e: { username: string }) => e.username)).toEqual(["alice"]);
  });

  it("computes rank as start + i + 1 across pages (page 2)", async () => {
    prismaMock.submission.groupBy.mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({ userId: `u${i + 1}`, problemId: "p1" })) as never
    );
    prismaMock.user.findMany.mockResolvedValue(
      Array.from({ length: 2 }, (_, i) => ({
        id: `u${i + 3}`,
        username: `user${i + 3}`,
        avatar: null,
        createdAt: new Date(),
      })) as never
    );

    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard?page=2&limit=2")));
    const data = await res.json();
    // page 2 with limit 2 → start=2 → rank fields = 3 and 4.
    expect(data.leaderboard[0].rank).toBe(3);
    expect(data.leaderboard[1].rank).toBe(4);
  });

  it("returns 500 with logged error when groupBy throws", async () => {
    prismaMock.submission.groupBy.mockRejectedValue(new Error("db down") as never);
    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard")));
    expect(res.status).toBe(500);
  });

  it("score equals solved * 100", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([
      { userId: "u1", problemId: "p1" },
      { userId: "u1", problemId: "p2" },
      { userId: "u1", problemId: "p3" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", username: "alice", avatar: null, createdAt: new Date() },
    ] as never);
    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard")));
    const data = await res.json();
    expect(data.leaderboard[0].solved).toBe(3);
    expect(data.leaderboard[0].score).toBe(300);
  });

  it("skips the user lookup query when there are no entries on the page", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([] as never);
    prismaMock.user.findMany.mockResolvedValue([] as never);
    await GET(asNextRequest(new Request("http://x/api/leaderboard")));
    // findMany should NOT have been invoked when pageUserIds is empty.
    expect(
      (prismaMock.user.findMany as { mock: { calls: unknown[][] } }).mock.calls.length
    ).toBe(0);
  });
});
