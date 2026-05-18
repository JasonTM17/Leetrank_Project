import { describe, it, expect } from "vitest";
import { cache } from "@/lib/cache";
import { asNextRequest, loginAs } from "../helpers";
import { GET } from "@/app/api/admin/cache/stats/route";

describe("GET /api/admin/cache/stats", () => {
  it("401 unauthenticated", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/admin/cache/stats")));
    expect(res.status).toBe(401);
  });

  it("403 non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await GET(asNextRequest(new Request("http://x/api/admin/cache/stats")));
    expect(res.status).toBe(403);
  });

  it("returns the stats payload to admin", async () => {
    await loginAs({ role: "admin" });
    cache.clear();
    cache.set("a", 1, 60_000);
    cache.get("a"); // hit
    cache.get("b"); // miss

    const res = await GET(asNextRequest(new Request("http://x/api/admin/cache/stats")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cache.hits).toBe(1);
    expect(data.cache.misses).toBe(1);
    expect(data.hitRatePercent).toBe(50);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
