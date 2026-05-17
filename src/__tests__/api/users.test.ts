import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/users/[username]/route";

function paramsFor(username: string) {
  return { params: Promise.resolve({ username }) };
}

describe("GET /api/users/[username]", () => {
  it("returns 404 when the user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/users/missing")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns aggregated stats for an existing user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      username: "alice",
      avatar: null,
      bio: "Hi",
      createdAt: new Date(),
    } as never);
    prismaMock.submission.count
      .mockResolvedValueOnce(20) // total
      .mockResolvedValueOnce(12); // accepted
    prismaMock.submission.findMany
      .mockResolvedValueOnce([
        { problemId: "p1", problem: { difficulty: "easy" } },
        { problemId: "p2", problem: { difficulty: "medium" } },
        { problemId: "p3", problem: { difficulty: "medium" } },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: "s1",
          status: "accepted",
          language: "python",
          createdAt: new Date(),
          problem: { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
        },
      ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/users/alice")), paramsFor("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.username).toBe("alice");
    expect(data.stats.totalSubmissions).toBe(20);
    expect(data.stats.accepted).toBe(12);
    expect(data.stats.solved).toBe(3);
    expect(data.stats.byDifficulty.easy).toBe(1);
    expect(data.stats.byDifficulty.medium).toBe(2);
    expect(data.stats.byDifficulty.hard).toBe(0);
    expect(data.recentSubmissions).toHaveLength(1);
    expect(data.user).not.toHaveProperty("password");
    expect(data.user).not.toHaveProperty("email");
  });
});
