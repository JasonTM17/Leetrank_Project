import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/problems/[slug]/stats/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/problems/[slug]/stats", () => {
  it("404 unknown slug", async () => {
    prismaMock.problem.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/problems/missing/stats")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("computes acceptance rate and per-language breakdown", async () => {
    prismaMock.problem.findUnique.mockResolvedValue({ id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" } as never);
    prismaMock.submission.count
      .mockResolvedValueOnce(100)  // total
      .mockResolvedValueOnce(60);  // accepted
    prismaMock.submission.groupBy.mockResolvedValue([
      { language: "python", _count: { _all: 30 } },
      { language: "javascript", _count: { _all: 20 } },
      { language: "go", _count: { _all: 10 } },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/problems/two-sum/stats")), paramsFor("two-sum"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stats.total).toBe(100);
    expect(data.stats.accepted).toBe(60);
    expect(data.stats.acceptanceRate).toBe(60);
    expect(data.stats.byLanguage).toEqual({ python: 30, javascript: 20, go: 10 });
  });

  it("returns 0 acceptance rate when total is 0 (no divide-by-zero)", async () => {
    prismaMock.problem.findUnique.mockResolvedValue({ id: "p1", title: "X", slug: "x", difficulty: "easy" } as never);
    prismaMock.submission.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prismaMock.submission.groupBy.mockResolvedValue([] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/problems/x/stats")), paramsFor("x"));
    const data = await res.json();
    expect(data.stats.acceptanceRate).toBe(0);
  });
});
