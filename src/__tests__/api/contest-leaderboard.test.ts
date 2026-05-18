import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/contests/[slug]/leaderboard/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/contests/[slug]/leaderboard", () => {
  it("404 unknown slug", async () => {
    prismaMock.contest.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/contests/missing/leaderboard")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns ranked entries with rank starting at 1", async () => {
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "active" } as never);
    prismaMock.contestEntry.findMany.mockResolvedValue([
      { score: 300, user: { id: "u1", username: "alice", avatar: null } },
      { score: 200, user: { id: "u2", username: "bob", avatar: null } },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/contests/cup/leaderboard")), paramsFor("cup"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contestStatus).toBe("active");
    expect(data.leaderboard[0].rank).toBe(1);
    expect(data.leaderboard[0].score).toBe(300);
    expect(data.leaderboard[1].rank).toBe(2);
  });

  it("orders by score desc then joinedAt asc", async () => {
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "ended" } as never);
    prismaMock.contestEntry.findMany.mockResolvedValue([]);

    await GET(asNextRequest(new Request("http://x/api/contests/cup/leaderboard")), paramsFor("cup"));

    const args = prismaMock.contestEntry.findMany.mock.calls[0]?.[0];
    expect(args?.orderBy).toEqual([{ score: "desc" }, { joinedAt: "asc" }]);
  });

  it("clamps limit to 200", async () => {
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "ended" } as never);
    prismaMock.contestEntry.findMany.mockResolvedValue([]);

    await GET(
      asNextRequest(new Request("http://x/api/contests/cup/leaderboard?limit=99999")),
      paramsFor("cup")
    );
    const args = prismaMock.contestEntry.findMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(200);
  });
});
