import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { GET, POST, DELETE } from "@/app/api/discussions/[id]/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/discussions/[id]", () => {
  it("returns the thread with comments", async () => {
    prismaMock.discussion.findUnique.mockResolvedValue({
      id: "d1",
      problemId: "p1",
      title: "Approach",
      body: "Use DP",
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { id: "u1", username: "alice", avatar: null },
      comments: [
        { id: "c1", body: "Nice", createdAt: new Date(), user: { id: "u2", username: "bob", avatar: null } },
      ],
    } as never);

    const res = await GET(asNextRequest(new Request("http://x/api/discussions/d1")), paramsFor("d1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.discussion.title).toBe("Approach");
    expect(data.discussion.comments).toHaveLength(1);
  });

  it("returns 404 for unknown id", async () => {
    prismaMock.discussion.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/discussions/missing")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/discussions/[id] (comment)", () => {
  it("401 unauthenticated", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/discussions/d1", { body: "hi" })), paramsFor("d1"));
    expect(res.status).toBe(401);
  });

  it("400 on invalid body", async () => {
    await loginAs();
    const res = await POST(asNextRequest(jsonRequest("http://x/api/discussions/d1", { body: "" })), paramsFor("d1"));
    expect(res.status).toBe(400);
  });

  it("404 when discussion missing", async () => {
    await loginAs();
    prismaMock.discussion.findUnique.mockResolvedValue(null);
    const res = await POST(asNextRequest(jsonRequest("http://x/api/discussions/missing", { body: "hi" })), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("201 happy path returns the new comment", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.findUnique.mockResolvedValue({ id: "d1" } as never);
    prismaMock.discussionComment.create.mockResolvedValue({
      id: "c-new",
      body: "Nice",
      createdAt: new Date(),
      user: { id: "u1", username: "u1", avatar: null },
    } as never);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/discussions/d1", { body: "Nice" })), paramsFor("d1"));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.comment.id).toBe("c-new");
  });
});

describe("DELETE /api/discussions/[id]", () => {
  it("401 unauthenticated", async () => {
    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/d1", { method: "DELETE" })), paramsFor("d1"));
    expect(res.status).toBe(401);
  });

  it("403 if not author and not admin", async () => {
    await loginAs({ userId: "u-other", role: "user" });
    prismaMock.discussion.findUnique.mockResolvedValue({ userId: "u1" } as never);
    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/d1", { method: "DELETE" })), paramsFor("d1"));
    expect(res.status).toBe(403);
  });

  it("200 when author deletes their own", async () => {
    await loginAs({ userId: "u1", role: "user" });
    prismaMock.discussion.findUnique.mockResolvedValue({ userId: "u1" } as never);
    prismaMock.discussion.delete.mockResolvedValue({ id: "d1" } as never);
    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/d1", { method: "DELETE" })), paramsFor("d1"));
    expect(res.status).toBe(200);
  });

  it("200 when admin deletes someone else's", async () => {
    await loginAs({ userId: "admin-u", role: "admin" });
    prismaMock.discussion.findUnique.mockResolvedValue({ userId: "u-other" } as never);
    prismaMock.discussion.delete.mockResolvedValue({ id: "d1" } as never);
    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/d1", { method: "DELETE" })), paramsFor("d1"));
    expect(res.status).toBe(200);
  });

  it("404 if discussion missing", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.findUnique.mockResolvedValue(null);
    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/missing", { method: "DELETE" })), paramsFor("missing"));
    expect(res.status).toBe(404);
  });
});
