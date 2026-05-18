import { describe, it, expect } from "vitest";
import { app } from "../server.js";
import { prisma } from "../db.js";

type MockFn = ReturnType<typeof import("vitest").vi.fn>;
type Mocked = {
  contest: { findMany: MockFn; findUnique: MockFn };
};
const mocked = prisma as unknown as Mocked;

describe("/contests routes", () => {
  it("GET /contests returns the list ordered by startTime desc", async () => {
    mocked.contest.findMany.mockResolvedValueOnce([
      { id: "c1", title: "Spring Cup", slug: "spring-cup", status: "ended" },
    ]);
    const res = await app.request("/contests");
    expect(res.status).toBe(200);
    const args = mocked.contest.findMany.mock.calls[0]?.[0] as { orderBy?: { startTime?: string } };
    expect(args?.orderBy?.startTime).toBe("desc");
  });

  it("GET /contests/active filters by status active", async () => {
    mocked.contest.findMany.mockResolvedValueOnce([]);
    const res = await app.request("/contests/active");
    expect(res.status).toBe(200);
    const args = mocked.contest.findMany.mock.calls[0]?.[0] as { where?: { status?: string } };
    expect(args?.where?.status).toBe("active");
  });

  it("GET /contests/upcoming honours limit and clamps to max 50", async () => {
    mocked.contest.findMany.mockResolvedValueOnce([]);
    const res = await app.request("/contests/upcoming?limit=200");
    expect(res.status).toBe(200);
    const args = mocked.contest.findMany.mock.calls[0]?.[0] as { take?: number };
    expect(args?.take).toBe(50);
  });

  it("GET /contests/upcoming uses default limit 20", async () => {
    mocked.contest.findMany.mockResolvedValueOnce([]);
    await app.request("/contests/upcoming");
    const args = mocked.contest.findMany.mock.calls[0]?.[0] as { take?: number };
    expect(args?.take).toBe(20);
  });

  it("GET /contests/:slug returns the contest with nested problems", async () => {
    mocked.contest.findUnique.mockResolvedValueOnce({
      id: "c1",
      title: "Spring Cup",
      slug: "spring-cup",
      description: null,
      startTime: new Date("2026-05-01"),
      endTime: new Date("2026-05-01"),
      status: "ended",
      problems: [
        {
          order: 0,
          points: 100,
          problem: {
            id: "p1",
            title: "Two Sum",
            slug: "two-sum",
            difficulty: "easy",
            tags: [],
          },
        },
      ],
    });
    const res = await app.request("/contests/spring-cup");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { contest: { slug: string; problems: unknown[] } };
    expect(body.contest.slug).toBe("spring-cup");
    expect(body.contest.problems).toHaveLength(1);
  });

  it("GET /contests/:slug returns 404 when missing", async () => {
    mocked.contest.findUnique.mockResolvedValueOnce(null);
    const res = await app.request("/contests/no-such");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Contest not found");
  });
});
