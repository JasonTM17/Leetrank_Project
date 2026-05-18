import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/users/[username]/submissions/route";

function paramsFor(username: string) {
  return { params: Promise.resolve({ username }) };
}

describe("GET /api/users/[username]/submissions", () => {
  it("404 for unknown user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/users/missing/submissions")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns paginated submissions, no code field", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" } as never);
    prismaMock.submission.findMany.mockResolvedValue([
      {
        id: "s1",
        status: "accepted",
        language: "python",
        runtime: 10,
        createdAt: new Date(),
        problem: { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
      },
    ] as never);
    prismaMock.submission.count.mockResolvedValue(1);

    const res = await GET(asNextRequest(new Request("http://x/api/users/alice/submissions")), paramsFor("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissions[0]).not.toHaveProperty("code");
    expect(data.total).toBe(1);
  });

  it("filters by status when provided", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" } as never);
    prismaMock.submission.findMany.mockResolvedValue([]);
    prismaMock.submission.count.mockResolvedValue(0);

    await GET(
      asNextRequest(new Request("http://x/api/users/alice/submissions?status=accepted")),
      paramsFor("alice")
    );

    const args = prismaMock.submission.findMany.mock.calls[0]?.[0];
    expect(args?.where).toMatchObject({ userId: "u1", status: "accepted" });
  });
});
