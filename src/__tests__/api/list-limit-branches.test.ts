import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, plainRequest } from "../helpers";
import { GET as upcomingGET } from "@/app/api/contests/upcoming/route";
import { GET as recentGET } from "@/app/api/submissions/recent/route";

describe("GET /api/contests/upcoming — limit branches", () => {
  it("clamps limit to MAX_LIMIT=50 when above cap", async () => {
    prismaMock.contest.findMany.mockResolvedValue([] as never);
    await upcomingGET(asNextRequest(plainRequest("http://x/api/contests/upcoming?limit=999")));
    const args = (prismaMock.contest.findMany as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { take?: number };
    expect(args?.take).toBe(50);
  });

  it("clamps non-numeric limit to default 20", async () => {
    prismaMock.contest.findMany.mockResolvedValue([] as never);
    await upcomingGET(asNextRequest(plainRequest("http://x/api/contests/upcoming?limit=abc")));
    const args = (prismaMock.contest.findMany as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { take?: number };
    expect(args?.take).toBe(20);
  });

  it("clamps zero / negative to 1", async () => {
    prismaMock.contest.findMany.mockResolvedValue([] as never);
    await upcomingGET(asNextRequest(plainRequest("http://x/api/contests/upcoming?limit=0")));
    const args = (prismaMock.contest.findMany as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { take?: number };
    expect(args?.take).toBe(20); // 0 falsy → fallback 20
  });
});

describe("GET /api/submissions/recent — limit branches", () => {
  it("clamps limit to MAX_LIMIT=100 when above cap", async () => {
    prismaMock.submission.findMany.mockResolvedValue([] as never);
    await recentGET(asNextRequest(plainRequest("http://x/api/submissions/recent?limit=9999")));
    const args = (prismaMock.submission.findMany as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { take?: number };
    expect(args?.take).toBe(100);
  });

  it("clamps non-numeric limit to default 20", async () => {
    prismaMock.submission.findMany.mockResolvedValue([] as never);
    await recentGET(asNextRequest(plainRequest("http://x/api/submissions/recent?limit=foo")));
    const args = (prismaMock.submission.findMany as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { take?: number };
    expect(args?.take).toBe(20);
  });

  it("respects an explicit valid limit between 1 and 100", async () => {
    prismaMock.submission.findMany.mockResolvedValue([] as never);
    await recentGET(asNextRequest(plainRequest("http://x/api/submissions/recent?limit=15")));
    const args = (prismaMock.submission.findMany as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { take?: number };
    expect(args?.take).toBe(15);
  });
});
