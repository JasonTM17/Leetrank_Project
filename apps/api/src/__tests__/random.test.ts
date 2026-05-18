import { describe, it, expect } from "vitest";
import { app } from "../server.js";
import { prisma } from "../db.js";

type MockFn = ReturnType<typeof import("vitest").vi.fn>;
type Mocked = {
  problem: { count: MockFn; findMany: MockFn };
};
const mocked = prisma as unknown as Mocked;

describe("GET /problems/random", () => {
  it("returns one problem when total > 0", async () => {
    mocked.problem.count.mockResolvedValueOnce(5);
    mocked.problem.findMany.mockResolvedValueOnce([
      { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
    ]);
    const res = await app.request("/problems/random");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { problem: { slug: string } };
    expect(body.problem.slug).toBe("two-sum");
  });

  it("filters by difficulty when provided", async () => {
    mocked.problem.count.mockResolvedValueOnce(2);
    mocked.problem.findMany.mockResolvedValueOnce([
      { id: "p1", title: "Hard One", slug: "hard-one", difficulty: "hard" },
    ]);
    await app.request("/problems/random?difficulty=hard");
    const args = mocked.problem.findMany.mock.calls[0]?.[0] as { where?: { difficulty?: string } };
    expect(args?.where?.difficulty).toBe("hard");
  });

  it("returns 404 when total === 0", async () => {
    mocked.problem.count.mockResolvedValueOnce(0);
    const res = await app.request("/problems/random");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("No problems available");
  });
});
