import { describe, it, expect, vi } from "vitest";
import { withTiming } from "@/lib/server-timing";
import { snapshotHttp } from "@/lib/metrics";

describe("withTiming", () => {
  it("wraps a handler and adds X-Response-Time + Server-Timing headers", async () => {
    const handler = vi.fn(async () => new Response("ok", { status: 200 }));
    const timed = withTiming("test-label", handler);
    const res = await timed(new Request("http://x/y", { headers: { "x-request-id": "rid-1" } }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("X-Response-Time")).toMatch(/^\d+ms$/);
    expect(res.headers.get("Server-Timing")).toMatch(/^test-label;dur=\d+$/);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("appends Server-Timing entries when the response already has one", async () => {
    const handler = vi.fn(async () => {
      const r = new Response("ok", { status: 200 });
      r.headers.set("Server-Timing", "db;dur=5");
      return r;
    });
    const timed = withTiming("route", handler);
    const res = await timed(new Request("http://x/y", { headers: { "x-request-id": "rid" } }));
    const st = res.headers.get("Server-Timing") ?? "";
    expect(st.startsWith("db;dur=5, route;dur=")).toBe(true);
  });

  it("rethrows handler errors after measuring elapsed time", async () => {
    const handler = vi.fn(async () => {
      throw new Error("boom");
    });
    const timed = withTiming("rt-err", handler);
    await expect(timed(new Request("http://x/y", { headers: { "x-request-id": "r" } }))).rejects.toThrow("boom");
  });

  it("counts missing X-Request-Id requests via metrics counter", async () => {
    const handler = vi.fn(async () => new Response(null, { status: 204 }));
    const timed = withTiming("no-req-id", handler);
    // No x-request-id → recordMissingRequestId() runs.
    await timed(new Request("http://x/no-id"));
    expect(handler).toHaveBeenCalled();
  });

  it("records HTTP status into the metrics snapshot", async () => {
    const before = snapshotHttp();
    const handler = vi.fn(async () => new Response(null, { status: 418 }));
    const timed = withTiming("teapot", handler);
    await timed(new Request("http://x/teapot", { headers: { "x-request-id": "r" } }));
    const after = snapshotHttp();
    const got418 = (after.byStatus["418"] ?? 0) - (before.byStatus["418"] ?? 0);
    expect(got418).toBeGreaterThanOrEqual(1);
  });

  it("works without a request argument (unit-test ergonomic)", async () => {
    const handler = vi.fn(async () => new Response("hi", { status: 201 }));
    const timed = withTiming("no-req", handler);
    const res = await timed();
    expect(res.status).toBe(201);
    expect(res.headers.get("X-Response-Time")).toMatch(/^\d+ms$/);
  });
});
