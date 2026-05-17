import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { GET, POST } from "@/app/api/bookmarks/route";

describe("GET /api/bookmarks", () => {
  it("returns 401 without a session", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/bookmarks")));
    expect(res.status).toBe(401);
  });

  it("returns the single-problem state when problemId is provided", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.bookmark.findUnique.mockResolvedValue({ id: "b1" } as never);

    const res = await GET(asNextRequest(new Request("http://x/api/bookmarks?problemId=p1")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bookmarked).toBe(true);
  });

  it("returns false when no bookmark row exists for the problem", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.bookmark.findUnique.mockResolvedValue(null);

    const res = await GET(asNextRequest(new Request("http://x/api/bookmarks?problemId=p1")));
    const data = await res.json();
    expect(data.bookmarked).toBe(false);
  });

  it("lists all bookmarks for the user when no params", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.bookmark.findMany.mockResolvedValue([
      { id: "b1", problem: { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" } },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/bookmarks")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bookmarks).toHaveLength(1);
  });
});

describe("POST /api/bookmarks", () => {
  it("returns 401 without a session", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/bookmarks", { problemId: "p1" })));
    expect(res.status).toBe(401);
  });

  it("returns 400 on missing problemId", async () => {
    await loginAs();
    const res = await POST(asNextRequest(jsonRequest("http://x/api/bookmarks", {})));
    expect(res.status).toBe(400);
  });

  it("creates a bookmark when none exists", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.bookmark.findUnique.mockResolvedValue(null);
    prismaMock.problem.findUnique.mockResolvedValue({ id: "p1" } as never);
    prismaMock.bookmark.create.mockResolvedValue({ id: "b-new" } as never);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/bookmarks", { problemId: "p1" })));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bookmarked).toBe(true);
  });

  it("deletes when one already exists (toggle)", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.bookmark.findUnique.mockResolvedValue({ id: "b1" } as never);
    prismaMock.bookmark.delete.mockResolvedValue({ id: "b1" } as never);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/bookmarks", { problemId: "p1" })));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bookmarked).toBe(false);
    expect(prismaMock.bookmark.create).not.toHaveBeenCalled();
  });

  it("returns 404 if the problem doesn't exist", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.bookmark.findUnique.mockResolvedValue(null);
    prismaMock.problem.findUnique.mockResolvedValue(null);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/bookmarks", { problemId: "missing" })));
    expect(res.status).toBe(404);
  });
});
