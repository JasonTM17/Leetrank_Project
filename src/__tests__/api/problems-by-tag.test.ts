import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/problems/by-tag/route";

describe("GET /api/problems/by-tag", () => {
  it("400 when tag param missing", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/problems/by-tag")));
    expect(res.status).toBe(400);
  });

  it("returns problems matching the tag slug", async () => {
    prismaMock.problem.findMany.mockResolvedValue([
      { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/problems/by-tag?tag=array")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.problems).toHaveLength(1);

    const args = prismaMock.problem.findMany.mock.calls[0]?.[0];
    expect(args?.where).toEqual({ tags: { some: { tag: { slug: "array" } } } });
  });

  it("clamps limit to 100", async () => {
    prismaMock.problem.findMany.mockResolvedValue([]);
    await GET(asNextRequest(new Request("http://x/api/problems/by-tag?tag=array&limit=999")));
    const args = prismaMock.problem.findMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(100);
  });

  it("500 on db error", async () => {
    prismaMock.problem.findMany.mockRejectedValue(new Error("db down"));
    const res = await GET(asNextRequest(new Request("http://x/api/problems/by-tag?tag=array")));
    expect(res.status).toBe(500);
  });
});
