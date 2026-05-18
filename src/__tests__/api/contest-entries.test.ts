import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/contests/[slug]/entries/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/contests/[slug]/entries", () => {
  it("404 unknown slug", async () => {
    prismaMock.contest.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/contests/missing/entries")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns entries ordered by joinedAt asc", async () => {
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1" } as never);
    prismaMock.contestEntry.findMany.mockResolvedValue([] as never);
    prismaMock.contestEntry.count.mockResolvedValue(0);

    await GET(asNextRequest(new Request("http://x/api/contests/cup/entries")), paramsFor("cup"));

    const args = prismaMock.contestEntry.findMany.mock.calls[0]?.[0];
    expect(args?.orderBy).toEqual({ joinedAt: "asc" });
    expect(args?.where?.contestId).toBe("c1");
  });

  it("returns total alongside the entries", async () => {
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1" } as never);
    prismaMock.contestEntry.findMany.mockResolvedValue([
      { id: "e1", score: 100, user: { id: "u1", username: "alice", avatar: null } },
    ] as never);
    prismaMock.contestEntry.count.mockResolvedValue(42);

    const res = await GET(asNextRequest(new Request("http://x/api/contests/cup/entries")), paramsFor("cup"));
    const data = await res.json();
    expect(data.entries).toHaveLength(1);
    expect(data.total).toBe(42);
  });

  it("clamps limit to 500", async () => {
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1" } as never);
    prismaMock.contestEntry.findMany.mockResolvedValue([]);
    prismaMock.contestEntry.count.mockResolvedValue(0);

    await GET(
      asNextRequest(new Request("http://x/api/contests/cup/entries?limit=99999")),
      paramsFor("cup")
    );
    const args = prismaMock.contestEntry.findMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(500);
  });
});
