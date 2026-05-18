import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/stats/route";

describe("GET /api/stats", () => {
  it("returns the four counters in parallel", async () => {
    prismaMock.problem.count.mockResolvedValue(100);
    prismaMock.contest.count.mockResolvedValue(20);
    prismaMock.user.count.mockResolvedValue(500);
    prismaMock.submission.count.mockResolvedValue(1234);

    const res = await GET(asNextRequest(new Request("http://x/api/stats")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ problems: 100, contests: 20, users: 500, accepted: 1234 });
  });

  it("sets a Cache-Control header for CDN caching", async () => {
    prismaMock.problem.count.mockResolvedValue(0);
    prismaMock.contest.count.mockResolvedValue(0);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.submission.count.mockResolvedValue(0);

    const res = await GET(asNextRequest(new Request("http://x/api/stats")));
    expect(res.headers.get("Cache-Control")).toMatch(/max-age=60/);
    expect(res.headers.get("Cache-Control")).toMatch(/stale-while-revalidate/);
  });

  it("returns 500 on db rejection", async () => {
    prismaMock.problem.count.mockRejectedValue(new Error("boom"));
    prismaMock.contest.count.mockRejectedValue(new Error("boom"));
    prismaMock.user.count.mockRejectedValue(new Error("boom"));
    prismaMock.submission.count.mockRejectedValue(new Error("boom"));

    const res = await GET(asNextRequest(new Request("http://x/api/stats")));
    expect(res.status).toBe(500);
  });
});
