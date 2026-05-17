import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/leaderboard/route";

describe("GET /api/leaderboard", () => {
  it("dedupes accepted submissions before counting", async () => {
    // 3 AC submissions for u1 across 2 distinct problems → solved=2, not 3
    prismaMock.submission.groupBy.mockResolvedValue([
      { userId: "u1", problemId: "p1" },
      { userId: "u1", problemId: "p2" },
      { userId: "u2", problemId: "p1" },
    ] as never);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", username: "alice", avatar: null, createdAt: new Date() },
      { id: "u2", username: "bob", avatar: null, createdAt: new Date() },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.leaderboard[0].username).toBe("alice");
    expect(data.leaderboard[0].solved).toBe(2);
    expect(data.leaderboard[1].solved).toBe(1);
    expect(data.total).toBe(2);
  });

  it("paginates results", async () => {
    prismaMock.submission.groupBy.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ userId: `u${i}`, problemId: "p1" })) as never
    );
    prismaMock.user.findMany.mockResolvedValue(
      Array.from({ length: 2 }, (_, i) => ({
        id: `u${i + 2}`,
        username: `user${i + 2}`,
        avatar: null,
        createdAt: new Date(),
      })) as never
    );

    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard?page=2&limit=2")));
    const data = await res.json();
    expect(data.page).toBe(2);
    expect(data.limit).toBe(2);
    expect(data.total).toBe(5);
  });

  it("clamps limit to 100 max", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard?limit=9999")));
    const data = await res.json();
    expect(data.limit).toBe(100);
  });

  it("returns empty leaderboard when nobody has solved anything", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    const res = await GET(asNextRequest(new Request("http://x/api/leaderboard")));
    const data = await res.json();
    expect(data.leaderboard).toEqual([]);
    expect(data.total).toBe(0);
  });
});
