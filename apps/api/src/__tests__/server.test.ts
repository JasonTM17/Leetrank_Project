import { describe, it, expect } from "vitest";
import { app } from "../server.js";
import { prisma } from "../db.js";

type MockFn = ReturnType<typeof import("vitest").vi.fn>;
type Mocked = {
  $queryRaw: MockFn;
};
const mocked = prisma as unknown as Mocked;

describe("server entry routes", () => {
  it("GET / returns the service banner", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string; version: string; docs: string };
    expect(body.service).toBe("leetrank-api");
    expect(typeof body.version).toBe("string");
  });

  it("GET /healthz is cheap liveness — no DB call", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("leetrank-api");
    expect(mocked.$queryRaw).not.toHaveBeenCalled();
  });

  it("GET /readyz returns 200 when DB probe succeeds", async () => {
    const res = await app.request("/readyz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      services: { database: { status: string; latencyMs?: number } };
    };
    expect(body.status).toBe("ok");
    expect(body.services.database.status).toBe("ok");
    expect(mocked.$queryRaw).toHaveBeenCalled();
  });

  it("GET /readyz returns 503 when DB probe fails", async () => {
    mocked.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("down");
  });

  it("GET /metrics returns Prometheus exposition format", async () => {
    const res = await app.request("/metrics");
    expect(res.status).toBe(200);
    const ct = res.headers.get("Content-Type") ?? "";
    expect(ct.startsWith("text/plain")).toBe(true);
    const body = await res.text();
    expect(body).toContain("leetrank_api_http_requests_total");
  });

  it("unknown path returns 404 with requestId", async () => {
    const res = await app.request("/this-path-does-not-exist");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; requestId: string };
    expect(body.error).toBe("Not Found");
    expect(typeof body.requestId).toBe("string");
  });
});
