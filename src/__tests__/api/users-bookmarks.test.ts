import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/users/[username]/bookmarks/route";

function paramsFor(username: string) {
  return { params: Promise.resolve({ username }) };
}

describe("GET /api/users/[username]/bookmarks", () => {
  it("404 unknown user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/users/missing/bookmarks")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns the flattened problems", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" } as never);
    prismaMock.bookmark.findMany.mockResolvedValue([
      { problem: { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" } },
      { problem: { id: "p2", title: "DP", slug: "dp", difficulty: "hard" } },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/users/alice/bookmarks")), paramsFor("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bookmarks).toHaveLength(2);
    expect(data.bookmarks[0].slug).toBe("two-sum");
  });

  it("clamps limit to 50", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" } as never);
    prismaMock.bookmark.findMany.mockResolvedValue([]);

    await GET(asNextRequest(new Request("http://x/api/users/alice/bookmarks?limit=999")), paramsFor("alice"));

    const args = prismaMock.bookmark.findMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(50);
  });
});
