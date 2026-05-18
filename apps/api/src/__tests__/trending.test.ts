import { describe, it, expect } from "vitest";
import { app } from "../server.js";
import { prisma } from "../db.js";

type MockFn = ReturnType<typeof import("vitest").vi.fn>;
type Mocked = {
  submission: { groupBy: MockFn };
  problem: { findMany: MockFn };
};
const mocked = prisma as unknown as Mocked;

describe("GET /problems/trending", () => {
  it("preserves rank order and attaches recentAccepted", async () => {
    mocked.submission.groupBy.mockResolvedValueOnce([
      { problemId: "p1", _count: { _all: 50 } },
      { problemId: "p2", _count: { _all: 20 } },
    ]);
    mocked.problem.findMany.mockResolvedValueOnce([
      { id: "p2", title: "B", slug: "b", difficulty: "easy" },
      { id: "p1", title: "A", slug: "a", difficulty: "easy" },
    ]);
    const res = await app.request("/problems/trending");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      problems: Array<{ id: string; recentAccepted: number }>;
    };
    expect(body.problems).toHaveLength(2);
    expect(body.problems[0]?.id).toBe("p1");
    expect(body.problems[0]?.recentAccepted).toBe(50);
    expect(body.problems[1]?.id).toBe("p2");
    expect(body.problems[1]?.recentAccepted).toBe(20);
  });

  it("returns empty array when no recent groups", async () => {
    mocked.submission.groupBy.mockResolvedValueOnce([]);
    const res = await app.request("/problems/trending");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { problems: unknown[] };
    expect(body.problems).toEqual([]);
  });

  it("clamps limit=100 to 30", async () => {
    mocked.submission.groupBy.mockResolvedValueOnce([]);
    await app.request("/problems/trending?limit=100");
    const args = mocked.submission.groupBy.mock.calls[0]?.[0] as { take?: number };
    expect(args?.take).toBe(30);
  });

  it("falls through to default when limit=0 (parseInt 0 is falsy)", async () => {
    mocked.submission.groupBy.mockResolvedValueOnce([]);
    await app.request("/problems/trending?limit=0");
    const args = mocked.submission.groupBy.mock.calls[0]?.[0] as { take?: number };
    expect(args?.take).toBe(10);
  });
});
