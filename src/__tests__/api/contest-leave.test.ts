import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { DELETE } from "@/app/api/contests/[slug]/leave/route";

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

const opts = { method: "DELETE" } as const;

describe("DELETE /api/contests/[slug]/leave", () => {
  it("401 unauthenticated", async () => {
    const res = await DELETE(asNextRequest(new Request("http://x/api/contests/cup/leave", opts)), paramsFor("cup"));
    expect(res.status).toBe(401);
  });

  it("404 unknown slug", async () => {
    await loginAs();
    prismaMock.contest.findUnique.mockResolvedValue(null);
    const res = await DELETE(asNextRequest(new Request("http://x/api/contests/missing/leave", opts)), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("409 if contest has ended", async () => {
    await loginAs();
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "ended" } as never);
    const res = await DELETE(asNextRequest(new Request("http://x/api/contests/cup/leave", opts)), paramsFor("cup"));
    expect(res.status).toBe(409);
  });

  it("404 if user hasn't joined", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "upcoming" } as never);
    prismaMock.contestEntry.findUnique.mockResolvedValue(null);
    const res = await DELETE(asNextRequest(new Request("http://x/api/contests/cup/leave", opts)), paramsFor("cup"));
    expect(res.status).toBe(404);
  });

  it("200 happy path deletes the entry", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.contest.findUnique.mockResolvedValue({ id: "c1", status: "active" } as never);
    prismaMock.contestEntry.findUnique.mockResolvedValue({ id: "e1" } as never);
    prismaMock.contestEntry.delete.mockResolvedValue({ id: "e1" } as never);

    const res = await DELETE(asNextRequest(new Request("http://x/api/contests/cup/leave", opts)), paramsFor("cup"));
    expect(res.status).toBe(200);
    expect(prismaMock.contestEntry.delete).toHaveBeenCalledWith({ where: { id: "e1" } });
  });
});
