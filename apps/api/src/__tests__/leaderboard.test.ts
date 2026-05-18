import { describe, it, expect } from "vitest";
import { app } from "../server.js";
import { prisma } from "../db.js";

type MockFn = ReturnType<typeof import("vitest").vi.fn>;
type Mocked = {
  submission: { groupBy: MockFn };
  user: { findMany: MockFn };
};
const mocked = prisma as unknown as Mocked;

describe("GET /leaderboard/top", () => {
  it("returns ranked entries sorted by solved desc", async () => {
    mocked.submission.groupBy.mockResolvedValueOnce([
      { userId: "u1", problemId: "p1" },
      { userId: "u1", problemId: "p2" },
      { userId: "u2", problemId: "p1" },
    ]);
    mocked.user.findMany.mockResolvedValueOnce([
      { id: "u1", username: "alice", avatar: null },
      { id: "u2", username: "bob", avatar: null },
    ]);

    const res = await app.request("/leaderboard/top");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      leaderboard: Array<{ rank: number; user: { id: string }; solved: number }>;
    };
    expect(body.leaderboard).toHaveLength(2);
    expect(body.leaderboard[0]?.rank).toBe(1);
    expect(body.leaderboard[0]?.user.id).toBe("u1");
    expect(body.leaderboard[0]?.solved).toBe(2);
    expect(body.leaderboard[1]?.user.id).toBe("u2");
    expect(body.leaderboard[1]?.solved).toBe(1);
  });

  it("returns empty leaderboard when no accepted submissions", async () => {
    mocked.submission.groupBy.mockResolvedValueOnce([]);
    const res = await app.request("/leaderboard/top");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { leaderboard: unknown[] };
    expect(body.leaderboard).toEqual([]);
  });

  it("returns 500 when DB rejects", async () => {
    mocked.submission.groupBy.mockRejectedValueOnce(new Error("db down"));
    const res = await app.request("/leaderboard/top");
    expect(res.status).toBe(500);
  });
});
