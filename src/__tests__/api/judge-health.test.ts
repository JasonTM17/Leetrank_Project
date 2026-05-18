import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/judge/health/route";

const originalFetch = global.fetch;

describe("GET /api/judge/health", () => {
  beforeEach(() => {
    global.fetch = originalFetch;
    void prismaMock;
  });

  it("forwards the judge status when reachable", async () => {
    global.fetch = (async () => new Response(JSON.stringify({
      status: "ok",
      scheduler: { globalMax: 16, inUse: 3 },
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    const res = await GET(asNextRequest(new Request("http://x/api/judge/health")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.scheduler.globalMax).toBe(16);
  });

  it("returns 502 when the judge responds non-2xx", async () => {
    global.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    const res = await GET(asNextRequest(new Request("http://x/api/judge/health")));
    expect(res.status).toBe(502);
  });

  it("returns 503 when the judge is unreachable", async () => {
    global.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
    const res = await GET(asNextRequest(new Request("http://x/api/judge/health")));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe("down");
  });
});
