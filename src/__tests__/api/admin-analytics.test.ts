import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { cache } from "@/lib/cache";
import { GET } from "@/app/api/admin/analytics/route";

// Tests live behind the requireAdmin gate. The aggregator query path
// uses prisma.$queryRaw + groupBy, so we drive each surface explicitly
// to keep the contract tight.

describe("GET /api/admin/analytics", () => {
  function freshRequest() {
    return asNextRequest(new Request("http://x/api/admin/analytics"));
  }

  it("401 unauthenticated", async () => {
    cache.clear();
    const res = await GET(freshRequest());
    expect(res.status).toBe(401);
  });

  it("403 for non-admin", async () => {
    cache.clear();
    await loginAs({ role: "user" });
    const res = await GET(freshRequest());
    expect(res.status).toBe(403);
  });

  it("200 for admin and returns the four rollups", async () => {
    cache.clear();
    await loginAs({ role: "admin", userId: "admin-1" });

    // $queryRaw is called twice — once for user growth, once for
    // submission volume. Order matches the Promise.all order in
    // loadAnalytics: userGrowth first, then submissionVolume.
    const monthRows = [
      { month: new Date("2026-04-01T00:00:00Z"), count: 12 },
      { month: new Date("2026-05-01T00:00:00Z"), count: 7 },
    ];
    const dayRows = [
      { day: new Date("2026-05-18T00:00:00Z"), count: 3 },
      { day: new Date("2026-05-19T00:00:00Z"), count: 11 },
    ];
    prismaMock.$queryRaw
      .mockResolvedValueOnce(monthRows)
      .mockResolvedValueOnce(dayRows);

    prismaMock.problem.groupBy.mockResolvedValue([
      { difficulty: "easy", _count: { _all: 50 } },
      { difficulty: "medium", _count: { _all: 30 } },
      { difficulty: "hard", _count: { _all: 5 } },
    ] as never);
    prismaMock.submission.groupBy.mockResolvedValue([
      { language: "python", _count: { _all: 1200 } },
      { language: "typescript", _count: { _all: 800 } },
    ] as never);

    const res = await GET(freshRequest());
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.userGrowth).toHaveLength(2);
    expect(data.userGrowth[0]).toMatchObject({ count: 12 });
    expect(data.userGrowth[0].month).toContain("2026-04");

    expect(data.submissionVolume).toHaveLength(2);
    expect(data.submissionVolume[1]).toMatchObject({ count: 11 });

    expect(data.problemDifficulty).toEqual([
      { label: "easy", count: 50 },
      { label: "medium", count: 30 },
      { label: "hard", count: 5 },
    ]);
    expect(data.topLanguages).toEqual([
      { label: "python", count: 1200 },
      { label: "typescript", count: 800 },
    ]);
    expect(typeof data.generatedAt).toBe("string");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("memoises across calls within the TTL window", async () => {
    cache.clear();
    await loginAs({ role: "admin", userId: "admin-1" });

    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.problem.groupBy.mockResolvedValue([] as never);
    prismaMock.submission.groupBy.mockResolvedValue([] as never);

    const a = await GET(freshRequest());
    const b = await GET(freshRequest());
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    // Second call must hit the cache; aggregator queries fired only once.
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prismaMock.problem.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaMock.submission.groupBy).toHaveBeenCalledTimes(1);
  });

  it("500 on aggregation failure", async () => {
    cache.clear();
    await loginAs({ role: "admin", userId: "admin-1" });
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("db down"));
    prismaMock.problem.groupBy.mockRejectedValue(new Error("db down") as never);
    prismaMock.submission.groupBy.mockRejectedValue(new Error("db down") as never);

    // Silence the logger.error call so the test output stays clean.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(freshRequest());
    errSpy.mockRestore();
    expect(res.status).toBe(500);
  });
});
