import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/contests/upcoming/route";

describe("GET /api/contests/upcoming", () => {
  it("returns upcoming contests ordered by startTime asc", async () => {
    prismaMock.contest.findMany.mockResolvedValue([
      { id: "c1", title: "Soon", slug: "soon", startTime: new Date("2026-06-01") },
      { id: "c2", title: "Later", slug: "later", startTime: new Date("2026-07-01") },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/contests/upcoming")));
    expect(res.status).toBe(200);

    const args = prismaMock.contest.findMany.mock.calls[0]?.[0];
    expect(args?.where?.status).toBe("upcoming");
    expect(args?.orderBy).toEqual({ startTime: "asc" });
  });

  it("clamps limit to 50", async () => {
    prismaMock.contest.findMany.mockResolvedValue([]);
    await GET(asNextRequest(new Request("http://x/api/contests/upcoming?limit=999")));
    const args = prismaMock.contest.findMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(50);
  });

  it("returns 500 on db error", async () => {
    prismaMock.contest.findMany.mockRejectedValue(new Error("db down"));
    const res = await GET(asNextRequest(new Request("http://x/api/contests/upcoming")));
    expect(res.status).toBe(500);
  });
});
