import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { GET } from "@/app/api/contests/[slug]/me/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe("GET /api/contests/[slug]/me", () => {
  it("404 unknown slug", async () => {
    prismaMock.contest.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/contests/missing/me")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns joined:false when not authenticated", async () => {
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "active" } as never);
    const res = await GET(asNextRequest(new Request("http://x/api/contests/cup/me")), paramsFor("cup"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.joined).toBe(false);
    expect(data.entry).toBeNull();
  });

  it("returns the entry when authenticated and joined", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "active" } as never);
    prismaMock.contestEntry.findUnique.mockResolvedValue({
      id: "e1", score: 250, rank: 7, joinedAt: new Date(),
    } as never);

    const res = await GET(asNextRequest(new Request("http://x/api/contests/cup/me")), paramsFor("cup"));
    const data = await res.json();
    expect(data.joined).toBe(true);
    expect(data.entry.score).toBe(250);
  });

  it("returns joined:false when authenticated but not joined", async () => {
    await loginAs({ userId: "u-other" });
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "active" } as never);
    prismaMock.contestEntry.findUnique.mockResolvedValue(null);

    const res = await GET(asNextRequest(new Request("http://x/api/contests/cup/me")), paramsFor("cup"));
    const data = await res.json();
    expect(data.joined).toBe(false);
  });
});
