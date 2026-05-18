import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { GET } from "@/app/api/admin/stats/route";

describe("GET /api/admin/stats", () => {
  it("403 for non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await GET(asNextRequest(new Request("http://x/api/admin/stats")));
    expect(res.status).toBe(403);
  });

  it("403 unauthenticated", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/admin/stats")));
    expect(res.status).toBe(403);
  });

  it("returns the eight counters for admin", async () => {
    await loginAs({ role: "admin" });
    prismaMock.problem.count.mockResolvedValue(120);
    prismaMock.contest.count
      .mockResolvedValueOnce(40) // total
      .mockResolvedValueOnce(2);  // active
    prismaMock.user.count
      .mockResolvedValueOnce(500) // total
      .mockResolvedValueOnce(3);   // admins
    prismaMock.submission.count
      .mockResolvedValueOnce(9999) // total
      .mockResolvedValueOnce(4321); // accepted
    prismaMock.discussion.count.mockResolvedValue(75);

    const res = await GET(asNextRequest(new Request("http://x/api/admin/stats")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      problems: 120,
      contests: 40,
      activeContests: 2,
      users: 500,
      adminUsers: 3,
      submissions: 9999,
      acceptedSubmissions: 4321,
      discussions: 75,
    });
  });

  it("500 on db error", async () => {
    await loginAs({ role: "admin" });
    prismaMock.problem.count.mockRejectedValue(new Error("db down"));
    prismaMock.contest.count.mockRejectedValue(new Error("db down"));
    prismaMock.user.count.mockRejectedValue(new Error("db down"));
    prismaMock.submission.count.mockRejectedValue(new Error("db down"));
    prismaMock.discussion.count.mockRejectedValue(new Error("db down"));

    const res = await GET(asNextRequest(new Request("http://x/api/admin/stats")));
    expect(res.status).toBe(500);
  });
});
