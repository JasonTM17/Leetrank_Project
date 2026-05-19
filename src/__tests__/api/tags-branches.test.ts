import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";

/**
 * Branch padding for routes with 60-70% branch coverage where the
 * pagination/limit/error branches go untested. Each test exercises a
 * single uncovered branch to keep the focus tight.
 */

describe("GET /api/tags/[slug] — branch padding", () => {
  beforeEach(() => {
    prismaMock.problem.findMany.mockResolvedValue([]);
    prismaMock.problem.count.mockResolvedValue(0);
  });

  it("returns 404 when the tag slug doesn't exist", async () => {
    prismaMock.tag.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/tags/[slug]/route");
    const res = await GET(
      asNextRequest(new Request("http://x/api/tags/nope")),
      { params: Promise.resolve({ slug: "nope" }) }
    );
    expect(res.status).toBe(404);
  });

  it("falls back to default limit when ?limit is unparseable", async () => {
    prismaMock.tag.findUnique.mockResolvedValue({ id: "t1", name: "Arrays", slug: "arrays" } as never);
    const { GET } = await import("@/app/api/tags/[slug]/route");
    await GET(
      asNextRequest(new Request("http://x/api/tags/arrays?limit=abc")),
      { params: Promise.resolve({ slug: "arrays" }) }
    );
    const args = prismaMock.problem.findMany.mock.calls.at(-1)?.[0] as { take: number };
    expect(args.take).toBe(50);
  });

  it("clamps page to 1 when negative", async () => {
    prismaMock.tag.findUnique.mockResolvedValue({ id: "t1", name: "Arrays", slug: "arrays" } as never);
    const { GET } = await import("@/app/api/tags/[slug]/route");
    await GET(
      asNextRequest(new Request("http://x/api/tags/arrays?page=-9")),
      { params: Promise.resolve({ slug: "arrays" }) }
    );
    const args = prismaMock.problem.findMany.mock.calls.at(-1)?.[0] as { skip: number };
    expect(args.skip).toBe(0);
  });

  it("returns 500 when the tag lookup throws", async () => {
    prismaMock.tag.findUnique.mockRejectedValue(new Error("db down"));
    const { GET } = await import("@/app/api/tags/[slug]/route");
    const res = await GET(
      asNextRequest(new Request("http://x/api/tags/arrays")),
      { params: Promise.resolve({ slug: "arrays" }) }
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/users/[username]/submissions — branch padding", () => {
  beforeEach(() => {
    prismaMock.submission.findMany.mockResolvedValue([]);
    prismaMock.submission.count.mockResolvedValue(0);
  });

  it("returns 404 when the username has no row", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/users/[username]/submissions/route");
    const res = await GET(
      asNextRequest(new Request("http://x/api/users/ghost/submissions")),
      { params: Promise.resolve({ username: "ghost" }) }
    );
    expect(res.status).toBe(404);
  });

  it("falls back to default limit when ?limit is unparseable", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" } as never);
    const { GET } = await import("@/app/api/users/[username]/submissions/route");
    await GET(
      asNextRequest(new Request("http://x/api/users/alice/submissions?limit=abc")),
      { params: Promise.resolve({ username: "alice" }) }
    );
    expect(prismaMock.submission.findMany).toHaveBeenCalled();
  });
});
