import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/contests/active/route";

describe("GET /api/contests/active", () => {
  it("returns currently active contests", async () => {
    prismaMock.contest.findMany.mockResolvedValue([
      { id: "c1", title: "Live Cup", slug: "live-cup", startTime: new Date(), endTime: new Date(Date.now() + 3600_000), status: "active" },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/contests/active")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contests).toHaveLength(1);

    const args = prismaMock.contest.findMany.mock.calls[0]?.[0];
    expect(args?.where?.status).toBe("active");
  });

  it("returns empty array when nothing is live", async () => {
    prismaMock.contest.findMany.mockResolvedValue([]);
    const res = await GET(asNextRequest(new Request("http://x/api/contests/active")));
    const data = await res.json();
    expect(data.contests).toEqual([]);
  });

  it("returns 500 on db error", async () => {
    prismaMock.contest.findMany.mockRejectedValue(new Error("db down"));
    const res = await GET(asNextRequest(new Request("http://x/api/contests/active")));
    expect(res.status).toBe(500);
  });
});
