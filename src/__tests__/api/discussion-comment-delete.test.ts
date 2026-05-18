import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { DELETE } from "@/app/api/discussions/[id]/comments/[commentId]/route";

function paramsFor(id: string, commentId: string) {
  return { params: Promise.resolve({ id, commentId }) };
}

describe("DELETE /api/discussions/[id]/comments/[commentId]", () => {
  const opts = { method: "DELETE" } as const;

  it("401 unauthenticated", async () => {
    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/d1/comments/c1", opts)), paramsFor("d1", "c1"));
    expect(res.status).toBe(401);
  });

  it("404 if comment missing", async () => {
    await loginAs();
    prismaMock.discussionComment.findUnique.mockResolvedValue(null);
    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/d1/comments/missing", opts)), paramsFor("d1", "missing"));
    expect(res.status).toBe(404);
  });

  it("403 non-author non-admin", async () => {
    await loginAs({ userId: "u-other", role: "user" });
    prismaMock.discussionComment.findUnique.mockResolvedValue({ id: "c1", userId: "u1", discussionId: "d1" } as never);
    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/d1/comments/c1", opts)), paramsFor("d1", "c1"));
    expect(res.status).toBe(403);
  });

  it("403 if comment belongs to a different discussion", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussionComment.findUnique.mockResolvedValue({ id: "c1", userId: "u1", discussionId: "d-other" } as never);
    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/d1/comments/c1", opts)), paramsFor("d1", "c1"));
    expect(res.status).toBe(403);
  });

  it("200 author deletes own comment", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussionComment.findUnique.mockResolvedValue({ id: "c1", userId: "u1", discussionId: "d1" } as never);
    prismaMock.discussionComment.delete.mockResolvedValue({ id: "c1" } as never);

    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/d1/comments/c1", opts)), paramsFor("d1", "c1"));
    expect(res.status).toBe(200);
  });

  it("200 admin deletes anyone's comment", async () => {
    await loginAs({ userId: "admin-1", role: "admin" });
    prismaMock.discussionComment.findUnique.mockResolvedValue({ id: "c1", userId: "u1", discussionId: "d1" } as never);
    prismaMock.discussionComment.delete.mockResolvedValue({ id: "c1" } as never);

    const res = await DELETE(asNextRequest(new Request("http://x/api/discussions/d1/comments/c1", opts)), paramsFor("d1", "c1"));
    expect(res.status).toBe(200);
  });
});

void jsonRequest;
