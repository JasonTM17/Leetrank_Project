import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { POST } from "@/app/api/discussions/[id]/upvote/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/discussions/[id]/upvote", () => {
  it("returns 401 unauthenticated", async () => {
    const res = await POST(asNextRequest(new Request("http://x/api/discussions/d1/upvote", { method: "POST" })), paramsFor("d1"));
    expect(res.status).toBe(401);
  });

  it("increments and returns the new total", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.update.mockResolvedValue({ id: "d1", upvotes: 7 } as never);

    const res = await POST(asNextRequest(new Request("http://x/api/discussions/d1/upvote", { method: "POST" })), paramsFor("d1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.upvotes).toBe(7);

    const args = prismaMock.discussion.update.mock.calls[0]?.[0];
    expect(args?.data).toEqual({ upvotes: { increment: 1 } });
  });

  it("returns 404 when prisma reports the record is missing", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.update.mockRejectedValue(new Error("Record to update not found."));

    const res = await POST(asNextRequest(new Request("http://x/api/discussions/missing/upvote", { method: "POST" })), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected db errors", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.update.mockRejectedValue(new Error("connection lost"));

    const res = await POST(asNextRequest(new Request("http://x/api/discussions/d1/upvote", { method: "POST" })), paramsFor("d1"));
    expect(res.status).toBe(500);
  });
});
