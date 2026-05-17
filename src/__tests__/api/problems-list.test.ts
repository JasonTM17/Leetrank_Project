import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/problems/route";

const sampleProblem = {
  id: "p1",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy",
  tags: [{ tag: { id: "t1", name: "Array", slug: "array" } }],
  _count: { submissions: 42 },
};

describe("GET /api/problems", () => {
  it("returns the paginated default page", async () => {
    prismaMock.problem.findMany.mockResolvedValue([sampleProblem] as never);
    prismaMock.problem.count.mockResolvedValue(1);

    const res = await GET(asNextRequest(new Request("http://x/api/problems")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.problems).toHaveLength(1);
    expect(data.problems[0].slug).toBe("two-sum");
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
  });

  it("clamps limit to 50 max", async () => {
    prismaMock.problem.findMany.mockResolvedValue([]);
    prismaMock.problem.count.mockResolvedValue(0);

    const res = await GET(asNextRequest(new Request("http://x/api/problems?limit=999")));
    const data = await res.json();
    expect(data.limit).toBe(50);
  });

  it("treats negative page as 1", async () => {
    prismaMock.problem.findMany.mockResolvedValue([]);
    prismaMock.problem.count.mockResolvedValue(0);

    const res = await GET(asNextRequest(new Request("http://x/api/problems?page=-5")));
    const data = await res.json();
    expect(data.page).toBe(1);
  });

  it("filters by difficulty", async () => {
    prismaMock.problem.findMany.mockResolvedValue([]);
    prismaMock.problem.count.mockResolvedValue(0);

    await GET(asNextRequest(new Request("http://x/api/problems?difficulty=hard")));

    const where = prismaMock.problem.findMany.mock.calls[0]?.[0]?.where;
    expect(where?.difficulty).toBe("hard");
  });

  it("filters by tag slug", async () => {
    prismaMock.problem.findMany.mockResolvedValue([]);
    prismaMock.problem.count.mockResolvedValue(0);

    await GET(asNextRequest(new Request("http://x/api/problems?tag=array")));

    const where = prismaMock.problem.findMany.mock.calls[0]?.[0]?.where;
    expect(where?.tags).toEqual({ some: { tag: { slug: "array" } } });
  });

  it("returns 500 on db error", async () => {
    prismaMock.problem.findMany.mockRejectedValue(new Error("db down"));
    prismaMock.problem.count.mockRejectedValue(new Error("db down"));

    const res = await GET(asNextRequest(new Request("http://x/api/problems")));
    expect(res.status).toBe(500);
  });
});
