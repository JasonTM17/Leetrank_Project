import { describe, it, expect } from "vitest";
import { app } from "../server.js";
import { prisma } from "../db.js";

type MockFn = ReturnType<typeof import("vitest").vi.fn>;
type Mocked = {
  tag: { findMany: MockFn; findUnique: MockFn };
  problem: { findMany: MockFn; count: MockFn };
};
const mocked = prisma as unknown as Mocked;

describe("/tags routes", () => {
  it("GET /tags returns the alphabetised list", async () => {
    mocked.tag.findMany.mockResolvedValueOnce([
      { id: "t1", name: "Array", slug: "array" },
      { id: "t2", name: "Dynamic Programming", slug: "dynamic-programming" },
    ]);
    const res = await app.request("/tags");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tags: Array<{ slug: string }> };
    expect(body.tags).toHaveLength(2);
    expect(body.tags[0]?.slug).toBe("array");
  });

  it("GET /tags/:slug returns the tag with paginated problems", async () => {
    mocked.tag.findUnique.mockResolvedValueOnce({ id: "t1", name: "Array", slug: "array" });
    mocked.problem.findMany.mockResolvedValueOnce([
      { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy", tags: [] },
    ]);
    mocked.problem.count.mockResolvedValueOnce(1);

    const res = await app.request("/tags/array?page=1&limit=10");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tag: { slug: string };
      problems: unknown[];
      total: number;
      page: number;
      limit: number;
    };
    expect(body.tag.slug).toBe("array");
    expect(body.problems).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("GET /tags/:slug returns 404 for unknown slug", async () => {
    mocked.tag.findUnique.mockResolvedValueOnce(null);
    const res = await app.request("/tags/no-such-tag");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Tag not found");
  });
});
