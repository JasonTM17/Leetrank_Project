import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/leaderboard/top/route";

describe("GET /api/leaderboard/top", () => {
  it("returns the top 10 with rank starting at 1", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([
      { userId: "u1", problemId: "p1" },
      { userId: "u1", problemId: "p2" },
      { userId: "u2", problemId: "p1" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", username: "alice", avatar: null },
      { id: "u2", username: "bob", avatar: null },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard/top")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.leaderboard[0].rank).toBe(1);
    expect(data.leaderboard[0].user.username).toBe("alice");
    expect(data.leaderboard[0].solved).toBe(2);
  });

  it("sets Cache-Control even on empty leaderboard", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard/top")));
    expect(res.headers.get("Cache-Control")).toMatch(/max-age=60/);
    const data = await res.json();
    expect(data.leaderboard).toEqual([]);
  });

  it("500 on db error", async () => {
    prismaMock.submission.groupBy.mockRejectedValue(new Error("db down"));
    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard/top")));
    expect(res.status).toBe(500);
  });
});
