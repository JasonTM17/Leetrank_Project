import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { POST } from "@/app/api/discussions/[id]/vote/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const url = (id: string) => `http://x/api/discussions/${id}/vote`;

describe("POST /api/discussions/[id]/vote", () => {
  it("401 unauthenticated", async () => {
    const res = await POST(asNextRequest(jsonRequest(url("d1"), { value: 1 })), paramsFor("d1"));
    expect(res.status).toBe(401);
  });

  it("400 invalid value", async () => {
    await loginAs({ userId: "u1" });
    const res = await POST(asNextRequest(jsonRequest(url("d1"), { value: 7 })), paramsFor("d1"));
    expect(res.status).toBe(400);
  });

  it("404 when discussion missing", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.findUnique.mockResolvedValue(null);
    const res = await POST(asNextRequest(jsonRequest(url("missing"), { value: 1 })), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("creates a +1 vote when none exists; returns aggregate score", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.findUnique.mockResolvedValue({ id: "d1" } as never);
    prismaMock.discussionVote.findUnique.mockResolvedValue(null);
    prismaMock.discussionVote.create.mockResolvedValue({ id: "v1" } as never);
    prismaMock.discussionVote.aggregate.mockResolvedValue({ _sum: { value: 1 } } as never);

    const res = await POST(asNextRequest(jsonRequest(url("d1"), { value: 1 })), paramsFor("d1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(1);
    expect(data.userVote).toBe(1);
    // Verify create called with the right shape — no double-write.
    expect(prismaMock.discussionVote.create).toHaveBeenCalledTimes(1);
  });

  it("removes the vote when toggling the same direction", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.findUnique.mockResolvedValue({ id: "d1" } as never);
    prismaMock.discussionVote.findUnique.mockResolvedValue({ id: "v1", value: 1 } as never);
    prismaMock.discussionVote.delete.mockResolvedValue({ id: "v1" } as never);
    prismaMock.discussionVote.aggregate.mockResolvedValue({ _sum: { value: 0 } } as never);

    const res = await POST(asNextRequest(jsonRequest(url("d1"), { value: 1 })), paramsFor("d1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.userVote).toBe(0);
    expect(prismaMock.discussionVote.delete).toHaveBeenCalledTimes(1);
    expect(prismaMock.discussionVote.create).not.toHaveBeenCalled();
  });

  it("flips the vote when toggling the opposite direction", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.findUnique.mockResolvedValue({ id: "d1" } as never);
    prismaMock.discussionVote.findUnique.mockResolvedValue({ id: "v1", value: 1 } as never);
    prismaMock.discussionVote.update.mockResolvedValue({ id: "v1", value: -1 } as never);
    prismaMock.discussionVote.aggregate.mockResolvedValue({ _sum: { value: -1 } } as never);

    const res = await POST(asNextRequest(jsonRequest(url("d1"), { value: -1 })), paramsFor("d1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(-1);
    expect(data.userVote).toBe(-1);
    expect(prismaMock.discussionVote.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.discussionVote.delete).not.toHaveBeenCalled();
  });
});
