import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/tags/[slug]/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/tags/[slug]", () => {
  it("404 unknown tag", async () => {
    prismaMock.tag.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/tags/missing")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns the tag with paginated problems", async () => {
    prismaMock.tag.findUnique.mockResolvedValue({ id: "t1", name: "Array", slug: "array" } as never);
    prismaMock.problem.findMany.mockResolvedValue([
      {
        id: "p1",
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "easy",
        _count: { submissions: 42 },
      },
    ] as never);
    prismaMock.problem.count.mockResolvedValue(1);

    const res = await GET(asNextRequest(new Request("http://x/api/tags/array")), paramsFor("array"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tag.slug).toBe("array");
    expect(data.problems).toHaveLength(1);
    expect(data.total).toBe(1);
  });

  it("clamps limit to 100", async () => {
    prismaMock.tag.findUnique.mockResolvedValue({ id: "t1", name: "Array", slug: "array" } as never);
    prismaMock.problem.findMany.mockResolvedValue([]);
    prismaMock.problem.count.mockResolvedValue(0);

    const res = await GET(
      asNextRequest(new Request("http://x/api/tags/array?limit=99999")),
      paramsFor("array")
    );
    const data = await res.json();
    expect(data.limit).toBe(100);
  });
});
