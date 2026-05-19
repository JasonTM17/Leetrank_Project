import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";

/**
 * Branch padding for /api/users, /api/judge/health and adjacent routes
 * where the existing tests cover the happy path but skip the limit /
 * page / error / degraded branches.
 */

describe("GET /api/users — branch padding", () => {
  beforeEach(() => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);
  });

  it("falls back to default limit when ?limit is unparseable", async () => {
    const { GET } = await import("@/app/api/users/route");
    await GET(asNextRequest(new Request("http://x/api/users?limit=abc")));
    const args = prismaMock.user.findMany.mock.calls.at(-1)?.[0] as { take: number };
    expect(args.take).toBe(30);
  });

  it("falls back to page=1 when ?page is negative", async () => {
    const { GET } = await import("@/app/api/users/route");
    await GET(asNextRequest(new Request("http://x/api/users?page=-3")));
    const args = prismaMock.user.findMany.mock.calls.at(-1)?.[0] as { skip: number };
    expect(args.skip).toBe(0);
  });

  it("paginates with skip when page>1", async () => {
    const { GET } = await import("@/app/api/users/route");
    await GET(asNextRequest(new Request("http://x/api/users?page=3&limit=10")));
    const args = prismaMock.user.findMany.mock.calls.at(-1)?.[0] as { skip: number };
    expect(args.skip).toBe(20);
  });

  it("returns 500 when the user query throws", async () => {
    prismaMock.user.findMany.mockRejectedValue(new Error("db unreachable"));
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(asNextRequest(new Request("http://x/api/users")));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/judge/health — branch padding", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 'ok' when the judge omits a status field in its body", async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    const { GET } = await import("@/app/api/judge/health/route");
    const res = await GET(asNextRequest(new Request("http://x/api/judge/health")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.scheduler).toBeNull();
  });

  it("uses 'unknown' as the error message when fetch throws a non-Error", async () => {
    global.fetch = (async () => {
      throw "string-rejection";
    }) as typeof fetch;
    const { GET } = await import("@/app/api/judge/health/route");
    const res = await GET(asNextRequest(new Request("http://x/api/judge/health")));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("unknown");
  });
});
