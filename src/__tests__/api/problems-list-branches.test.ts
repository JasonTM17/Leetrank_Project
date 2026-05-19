import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/problems/route";

describe("GET /api/problems — branch padding", () => {
  it("uses no-store cache header when ?search is active (cache bypass)", async () => {
    prismaMock.problem.findMany.mockResolvedValue([] as never);
    prismaMock.problem.count.mockResolvedValue(0);
    const res = await GET(
      asNextRequest(new Request("http://x/api/problems?search=two"))
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("uses public cache header when ?search is absent", async () => {
    prismaMock.problem.findMany.mockResolvedValue([] as never);
    prismaMock.problem.count.mockResolvedValue(0);
    const res = await GET(asNextRequest(new Request("http://x/api/problems")));
    expect(res.headers.get("Cache-Control")).toMatch(/public/);
    expect(res.headers.get("Cache-Control")).toMatch(/stale-while-revalidate/);
  });

  it("passes case-insensitive title contains filter when search is set", async () => {
    prismaMock.problem.findMany.mockResolvedValue([] as never);
    prismaMock.problem.count.mockResolvedValue(0);
    await GET(asNextRequest(new Request("http://x/api/problems?search=Two")));
    const where = (prismaMock.problem.findMany as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { where?: { title?: unknown } };
    expect(where?.where?.title).toMatchObject({ contains: "Two", mode: "insensitive" });
  });

  it("clamps non-numeric ?page to 1", async () => {
    prismaMock.problem.findMany.mockResolvedValue([] as never);
    prismaMock.problem.count.mockResolvedValue(0);
    const res = await GET(asNextRequest(new Request("http://x/api/problems?page=foo")));
    const data = await res.json();
    expect(data.page).toBe(1);
  });

  it("clamps non-numeric ?limit to default 50", async () => {
    prismaMock.problem.findMany.mockResolvedValue([] as never);
    prismaMock.problem.count.mockResolvedValue(0);
    const res = await GET(asNextRequest(new Request("http://x/api/problems?limit=abc")));
    const data = await res.json();
    expect(data.limit).toBe(50);
  });

  it("uses (page-1)*limit skip on page>1", async () => {
    prismaMock.problem.findMany.mockResolvedValue([] as never);
    prismaMock.problem.count.mockResolvedValue(0);
    await GET(asNextRequest(new Request("http://x/api/problems?page=3&limit=10")));
    const args = (prismaMock.problem.findMany as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { skip?: number; take?: number };
    expect(args?.skip).toBe(20);
    expect(args?.take).toBe(10);
  });
});
