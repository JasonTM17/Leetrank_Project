import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/users/[username]/stats/route";

function paramsFor(username: string) {
  return { params: Promise.resolve({ username }) };
}

describe("GET /api/users/[username]/stats", () => {
  it("404 unknown user", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/users/missing/stats")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("buckets accepted submissions by UTC day", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" } as never);
    prismaMock.submission.findMany.mockResolvedValue([
      { createdAt: new Date("2026-04-01T10:00:00Z") },
      { createdAt: new Date("2026-04-01T22:00:00Z") },
      { createdAt: new Date("2026-04-02T05:00:00Z") },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/users/alice/stats")), paramsFor("alice"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(3);
    expect(data.byDay["2026-04-01"]).toBe(2);
    expect(data.byDay["2026-04-02"]).toBe(1);
    expect(data.windowDays).toBe(30);
  });

  it("returns empty byDay when no submissions in window", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1" } as never);
    prismaMock.submission.findMany.mockResolvedValue([]);
    const res = await GET(asNextRequest(new Request("http://x/api/users/alice/stats")), paramsFor("alice"));
    const data = await res.json();
    expect(data.total).toBe(0);
    expect(data.byDay).toEqual({});
  });
});
