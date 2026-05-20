import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { GET } from "@/app/api/recommendations/route";

describe("GET /api/recommendations", () => {
  it("anon: returns top trending problems by submission count", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([
      { problemId: "p1", _count: { _all: 100 } },
      { problemId: "p2", _count: { _all: 50 } },
    ] as never);
    prismaMock.problem.findMany.mockResolvedValue([
      { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
      { id: "p2", title: "Reverse List", slug: "reverse-list", difficulty: "easy" },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/recommendations")));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.recommendations).toHaveLength(2);
    expect(data.recommendations[0].slug).toBe("two-sum");
    expect(data.recommendations[0].reason).toBe("trending");
  });

  it("anon: falls back to fresh problems when no submissions exist", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([] as never);
    prismaMock.problem.findMany.mockResolvedValue([
      { id: "p9", title: "Brand New", slug: "brand-new", difficulty: "medium" },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/recommendations")));
    const data = await res.json();
    expect(data.recommendations).toHaveLength(1);
    expect(data.recommendations[0].reason).toBe("trending");
  });

  it("authed: ranks candidates against user solve history", async () => {
    await loginAs({ userId: "u1" });

    // History fetch — one accepted easy "array" solve.
    prismaMock.submission.findMany.mockResolvedValue([
      {
        problemId: "solved-1",
        createdAt: new Date("2026-05-01"),
        problem: {
          difficulty: "easy",
          tags: [{ tag: { slug: "array" } }],
        },
      },
    ] as never);

    // Candidate pool, then attach-meta lookup.
    prismaMock.problem.findMany
      .mockResolvedValueOnce([
        {
          id: "cand-array",
          difficulty: "easy",
          acceptanceRate: 0.55,
          createdAt: new Date("2026-05-10"),
          tags: [{ tag: { slug: "array" } }],
        },
        {
          id: "cand-graph",
          difficulty: "hard",
          acceptanceRate: 0.15,
          createdAt: new Date("2024-01-01"),
          tags: [{ tag: { slug: "graph" } }],
        },
      ] as never)
      .mockResolvedValueOnce([
        { id: "cand-array", title: "Array Pair", slug: "array-pair", difficulty: "easy" },
      ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/recommendations")));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.recommendations[0].slug).toBe("array-pair");
    expect(data.recommendations[0].reason).toBe("same-topic");
    expect(data.recommendations[0].reasonTag).toBe("array");
  });

  it("caches per-user across calls within TTL", async () => {
    prismaMock.submission.groupBy.mockResolvedValue([
      { problemId: "p1", _count: { _all: 10 } },
    ] as never);
    prismaMock.problem.findMany.mockResolvedValue([
      { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
    ] as never);

    await GET(asNextRequest(new Request("http://x/api/recommendations")));
    await GET(asNextRequest(new Request("http://x/api/recommendations")));

    // Second call should hit cache — only one DB invocation total.
    expect(prismaMock.submission.groupBy).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on db error", async () => {
    prismaMock.submission.groupBy.mockRejectedValue(new Error("db down"));
    prismaMock.problem.findMany.mockRejectedValue(new Error("db down"));
    const res = await GET(asNextRequest(new Request("http://x/api/recommendations")));
    expect(res.status).toBe(500);
  });
});
