import { describe, it, expect } from "vitest";
import { app } from "../server.js";
import { prisma } from "../db.js";

type MockFn = ReturnType<typeof import("vitest").vi.fn>;
type Mocked = {
  problem: { findMany: MockFn; count: MockFn; findUnique: MockFn };
};
const mocked = prisma as unknown as Mocked;

describe("/problems routes", () => {
  it("GET /problems returns paginated list with Cache-Control on no-search", async () => {
    mocked.problem.findMany.mockResolvedValueOnce([
      {
        id: "p1",
        title: "Two Sum",
        slug: "two-sum",
        difficulty: "easy",
        tags: [],
        _count: { submissions: 0 },
      },
    ]);
    mocked.problem.count.mockResolvedValueOnce(1);

    const res = await app.request("/problems");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control") ?? "").toContain("public");
    const body = (await res.json()) as { problems: unknown[]; total: number; page: number; limit: number };
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
  });

  it("GET /problems?search=foo sets Cache-Control no-store", async () => {
    mocked.problem.findMany.mockResolvedValueOnce([]);
    mocked.problem.count.mockResolvedValueOnce(0);
    const res = await app.request("/problems?search=foo");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET /problems?difficulty=easy filters by difficulty", async () => {
    mocked.problem.findMany.mockResolvedValueOnce([]);
    mocked.problem.count.mockResolvedValueOnce(0);
    await app.request("/problems?difficulty=easy");
    const args = mocked.problem.findMany.mock.calls[0]?.[0] as { where?: { difficulty?: string } };
    expect(args?.where?.difficulty).toBe("easy");
  });

  it("GET /problems?tag=arr filters via tags relation", async () => {
    mocked.problem.findMany.mockResolvedValueOnce([]);
    mocked.problem.count.mockResolvedValueOnce(0);
    await app.request("/problems?tag=arr");
    const args = mocked.problem.findMany.mock.calls[0]?.[0] as {
      where?: { tags?: { some?: { tag?: { slug?: string } } } };
    };
    expect(args?.where?.tags?.some?.tag?.slug).toBe("arr");
  });

  it("GET /problems?page=2&limit=10 applies skip/take", async () => {
    mocked.problem.findMany.mockResolvedValueOnce([]);
    mocked.problem.count.mockResolvedValueOnce(0);
    await app.request("/problems?page=2&limit=10");
    const args = mocked.problem.findMany.mock.calls[0]?.[0] as { skip?: number; take?: number };
    expect(args?.skip).toBe(10);
    expect(args?.take).toBe(10);
  });

  it("GET /problems/:slug returns problem detail", async () => {
    mocked.problem.findUnique.mockResolvedValueOnce({
      id: "p1",
      title: "Two Sum",
      slug: "two-sum",
      description: "desc",
      difficulty: "easy",
      constraints: null,
      hints: null,
      editorial: null,
      starterCode: null,
      tags: [],
      testCases: [{ input: "1", expected: "1" }],
    });
    const res = await app.request("/problems/two-sum");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { problem: { slug: string } };
    expect(body.problem.slug).toBe("two-sum");
  });

  it("GET /problems/:slug returns 404 when missing", async () => {
    mocked.problem.findUnique.mockResolvedValueOnce(null);
    const res = await app.request("/problems/no-such");
    expect(res.status).toBe(404);
  });
});
