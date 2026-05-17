import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { GET } from "@/app/api/contests/route";

describe("GET /api/contests", () => {
  it("returns contests sorted by start time desc", async () => {
    prismaMock.contest.findMany.mockResolvedValue([
      { id: "c1", title: "Latest", slug: "latest", startTime: new Date("2026-05-01") },
      { id: "c2", title: "Older", slug: "older", startTime: new Date("2026-04-01") },
    ] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contests).toHaveLength(2);
    expect(data.contests[0].slug).toBe("latest");

    const args = prismaMock.contest.findMany.mock.calls[0]?.[0];
    expect(args?.orderBy).toEqual({ startTime: "desc" });
  });

  it("returns 500 on db error", async () => {
    prismaMock.contest.findMany.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
