import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/search/route";

describe("GET /api/search", () => {
  it("returns empty result sets when query is too short", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/search?q=a")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.problems).toEqual([]);
    expect(data.contests).toEqual([]);
    expect(data.tags).toEqual([]);
    expect(prismaMock.problem.findMany).not.toHaveBeenCalled();
  });

  it("treats whitespace-only as too short", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/search?q=%20%20%20")));
    const data = await res.json();
    expect(data.problems).toEqual([]);
  });

  it("returns matched problems, contests, and tags", async () => {
    prismaMock.problem.findMany.mockResolvedValue([
      { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
    ] as never);
    prismaMock.contest.findMany.mockResolvedValue([
      { id: "c1", title: "Sumathon", slug: "sumathon", status: "ended", startTime: new Date() },
    ] as never);
    prismaMock.tag.findMany.mockResolvedValue([
      { id: "t1", name: "Sum", slug: "sum" },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/search?q=sum")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.query).toBe("sum");
    expect(data.problems).toHaveLength(1);
    expect(data.contests).toHaveLength(1);
    expect(data.tags).toHaveLength(1);
  });

  it("clamps limit to 50", async () => {
    prismaMock.problem.findMany.mockResolvedValue([]);
    prismaMock.contest.findMany.mockResolvedValue([]);
    prismaMock.tag.findMany.mockResolvedValue([]);

    await GET(asNextRequest(new Request("http://x/api/search?q=algo&limit=999")));

    const args = prismaMock.problem.findMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(50);
  });

  it("returns 500 on db error", async () => {
    prismaMock.problem.findMany.mockRejectedValue(new Error("db down"));
    prismaMock.contest.findMany.mockRejectedValue(new Error("db down"));
    prismaMock.tag.findMany.mockRejectedValue(new Error("db down"));

    const res = await GET(asNextRequest(new Request("http://x/api/search?q=algo")));
    expect(res.status).toBe(500);
  });
});
