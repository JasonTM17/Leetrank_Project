import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { plainRequest, asNextRequest, loginAs } from "../helpers";
import { GET } from "@/app/api/admin/problems/route";

describe("GET /api/admin/problems", () => {
  it("returns 401 with no session", async () => {
    const res = await GET(asNextRequest(plainRequest("http://x/api/admin/problems")));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await GET(asNextRequest(plainRequest("http://x/api/admin/problems")));
    expect(res.status).toBe(403);
  });

  it("returns problems list for an admin", async () => {
    await loginAs({ role: "admin" });
    prismaMock.problem.findMany.mockResolvedValue([
      { id: "p1", title: "A", slug: "a", difficulty: "easy", order: 1, tags: [], _count: { submissions: 0, testCases: 1 } },
    ] as never);
    const res = await GET(asNextRequest(plainRequest("http://x/api/admin/problems")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.problems).toHaveLength(1);
  });

  it("filters by difficulty + search query (case-insensitive)", async () => {
    await loginAs({ role: "admin" });
    prismaMock.problem.findMany.mockResolvedValue([] as never);
    const res = await GET(asNextRequest(plainRequest("http://x/api/admin/problems?difficulty=hard&search=two")));
    expect(res.status).toBe(200);
    const callArgs = (prismaMock.problem.findMany as ReturnType<typeof prismaMock.problem.findMany>) as never;
    void callArgs;
    expect((prismaMock.problem.findMany as { mock: { calls: unknown[][] } }).mock.calls.length).toBeGreaterThan(0);
    const where = (prismaMock.problem.findMany as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(where?.where).toMatchObject({ difficulty: "hard" });
    expect(where?.where).toMatchObject({ title: { contains: "two", mode: "insensitive" } });
  });

  it("returns 500 on db error", async () => {
    await loginAs({ role: "admin" });
    prismaMock.problem.findMany.mockRejectedValue(new Error("db down") as never);
    const res = await GET(asNextRequest(plainRequest("http://x/api/admin/problems")));
    expect(res.status).toBe(500);
  });
});
