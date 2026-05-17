import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/submissions/recent/route";

describe("GET /api/submissions/recent", () => {
  it("returns recent accepted submissions, no code field", async () => {
    prismaMock.submission.findMany.mockResolvedValue([
      {
        id: "s1",
        language: "python",
        runtime: 12,
        createdAt: new Date(),
        problem: { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
        user: { id: "u1", username: "alice", avatar: null },
      },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/submissions/recent")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissions).toHaveLength(1);
    expect(data.submissions[0]).not.toHaveProperty("code");
    expect(data.submissions[0].user.username).toBe("alice");
  });

  it("only includes accepted submissions in the prisma query", async () => {
    prismaMock.submission.findMany.mockResolvedValue([]);
    await GET(asNextRequest(new Request("http://x/api/submissions/recent")));

    const args = prismaMock.submission.findMany.mock.calls[0]?.[0];
    expect(args?.where).toEqual({ status: "accepted" });
    expect(args?.orderBy).toEqual({ createdAt: "desc" });
  });

  it("clamps limit to 100", async () => {
    prismaMock.submission.findMany.mockResolvedValue([]);
    await GET(asNextRequest(new Request("http://x/api/submissions/recent?limit=9999")));

    const args = prismaMock.submission.findMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(100);
  });

  it("returns 500 on db error", async () => {
    prismaMock.submission.findMany.mockRejectedValue(new Error("db down"));
    const res = await GET(asNextRequest(new Request("http://x/api/submissions/recent")));
    expect(res.status).toBe(500);
  });
});
