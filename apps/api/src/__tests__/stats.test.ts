import { describe, it, expect } from "vitest";
import { app } from "../server.js";
import { prisma } from "../db.js";

type MockFn = ReturnType<typeof import("vitest").vi.fn>;
type Mocked = {
  problem: { count: MockFn };
  contest: { count: MockFn };
  user: { count: MockFn };
  submission: { count: MockFn };
};
const mocked = prisma as unknown as Mocked;

describe("GET /stats", () => {
  it("returns the four counters in parallel", async () => {
    mocked.problem.count.mockResolvedValueOnce(120);
    mocked.contest.count.mockResolvedValueOnce(40);
    mocked.user.count.mockResolvedValueOnce(500);
    mocked.submission.count.mockResolvedValueOnce(9999);

    const res = await app.request("/stats");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      problems: number;
      contests: number;
      users: number;
      accepted: number;
    };
    expect(body).toEqual({
      problems: 120,
      contests: 40,
      users: 500,
      accepted: 9999,
    });
    expect(res.headers.get("Cache-Control") ?? "").toContain("public");
  });
});
