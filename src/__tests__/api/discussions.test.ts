import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { GET, POST } from "@/app/api/discussions/route";

describe("GET /api/discussions", () => {
  it("returns 400 if problemId is missing", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/discussions")));
    expect(res.status).toBe(400);
  });

  it("returns paginated discussions for a problem", async () => {
    prismaMock.discussion.findMany.mockResolvedValue([
      {
        id: "d1",
        title: "My approach",
        body: "I used DP",
        createdAt: new Date(),
        user: { id: "u1", username: "alice", avatar: null },
        _count: { comments: 3 },
      },
    ] as never);
    prismaMock.discussion.count.mockResolvedValue(1);
    prismaMock.discussionVote.groupBy.mockResolvedValue([] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/discussions?problemId=p1&sort=new")));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.discussions).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
  });

  it("clamps limit to MAX_LIMIT", async () => {
    prismaMock.discussion.findMany.mockResolvedValue([]);
    prismaMock.discussion.count.mockResolvedValue(0);
    prismaMock.discussionVote.groupBy.mockResolvedValue([] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/discussions?problemId=p1&limit=999&sort=new")));
    const data = await res.json();
    expect(data.limit).toBe(50);
  });
});

describe("POST /api/discussions", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/discussions", {
      problemId: "p1",
      title: "Approach",
      body: "Hello world",
    })));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid body", async () => {
    await loginAs();
    const res = await POST(asNextRequest(jsonRequest("http://x/api/discussions", {
      title: "ab", // too short
      body: "x",
      problemId: "p1",
    })));
    expect(res.status).toBe(400);
  });

  it("returns 404 if problem doesn't exist", async () => {
    await loginAs();
    prismaMock.problem.findUnique.mockResolvedValue(null);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/discussions", {
      problemId: "missing",
      title: "Valid title",
      body: "Some body",
    })));
    expect(res.status).toBe(404);
  });

  it("creates discussion and returns 201", async () => {
    await loginAs({ userId: "u-author" });
    prismaMock.problem.findUnique.mockResolvedValue({ id: "p1" } as never);
    prismaMock.discussion.create.mockResolvedValue({
      id: "d-new",
      problemId: "p1",
      userId: "u-author",
      title: "Valid title",
      body: "Some body",
      upvotes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: "u-author", username: "u1", avatar: null },
    } as never);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/discussions", {
      problemId: "p1",
      title: "Valid title",
      body: "Some body",
    })));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.discussion.id).toBe("d-new");
  });

  it("returns 400 on malformed JSON", async () => {
    await loginAs();
    const req = asNextRequest(new Request("http://x/api/discussions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    }));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// Suppress the noisy mock when imported in isolation
void vi;
