import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { POST } from "@/app/api/contests/[slug]/join/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("POST /api/contests/[slug]/join", () => {
  it("401 unauthenticated", async () => {
    const res = await POST(asNextRequest(new Request("http://x/api/contests/cup/join", { method: "POST" })), paramsFor("cup"));
    expect(res.status).toBe(401);
  });

  it("404 unknown slug", async () => {
    await loginAs();
    prismaMock.contest.findUnique.mockResolvedValue(null);
    const res = await POST(asNextRequest(new Request("http://x/api/contests/missing/join", { method: "POST" })), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("409 if contest has already ended", async () => {
    await loginAs();
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "ended" } as never);
    const res = await POST(asNextRequest(new Request("http://x/api/contests/cup/join", { method: "POST" })), paramsFor("cup"));
    expect(res.status).toBe(409);
  });

  it("201 happy path creates an entry", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "upcoming" } as never);
    prismaMock.contestEntry.findUnique.mockResolvedValue(null);
    prismaMock.contestEntry.create.mockResolvedValue({ id: "e1", score: 0, rank: null } as never);

    const res = await POST(asNextRequest(new Request("http://x/api/contests/cup/join", { method: "POST" })), paramsFor("cup"));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.alreadyJoined).toBe(false);
  });

  it("returns existing entry when already joined (idempotent)", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "active" } as never);
    prismaMock.contestEntry.findUnique.mockResolvedValue({ id: "e1", score: 100, rank: 5 } as never);

    const res = await POST(asNextRequest(new Request("http://x/api/contests/cup/join", { method: "POST" })), paramsFor("cup"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alreadyJoined).toBe(true);
    expect(data.entry.score).toBe(100);
    expect(prismaMock.contestEntry.create).not.toHaveBeenCalled();
  });
});
