import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/users/[username]/discussions/route";

function paramsFor(username: string) {
  return { params: Promise.resolve({ username }) };
}

describe("GET /api/users/[username]/discussions", () => {
  it("404 for unknown user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/users/missing/discussions")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns the user's paginated discussions with problem snippets", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" } as never);
    prismaMock.discussion.findMany.mockResolvedValue([
      {
        id: "d1",
        title: "My approach",
        body: "...",
        createdAt: new Date(),
        problem: { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
        _count: { comments: 4 },
      },
    ] as never);
    prismaMock.discussion.count.mockResolvedValue(1);

    const res = await GET(asNextRequest(new Request("http://x/api/users/alice/discussions")), paramsFor("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.discussions).toHaveLength(1);
    expect(data.discussions[0].problem.slug).toBe("two-sum");
    expect(data.total).toBe(1);
  });

  it("clamps limit to 50", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" } as never);
    prismaMock.discussion.findMany.mockResolvedValue([]);
    prismaMock.discussion.count.mockResolvedValue(0);

    const res = await GET(
      asNextRequest(new Request("http://x/api/users/alice/discussions?limit=999")),
      paramsFor("alice")
    );
    const data = await res.json();
    expect(data.limit).toBe(50);
  });
});
