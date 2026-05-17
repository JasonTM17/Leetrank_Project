import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/health/route";
import { prismaMock } from "../setup";

const originalFetch = global.fetch;

describe("GET /api/health", () => {
  beforeEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 200 when db and judge are both healthy", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    global.fetch = (async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })) as typeof fetch;

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.services.database.status).toBe("ok");
    expect(data.services.judge.status).toBe("ok");
  });

  it("reports degraded when judge is down but db is up", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    global.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("degraded");
    expect(data.services.database.status).toBe("ok");
    expect(data.services.judge.status).toBe("down");
  });

  it("reports 503 when db is down", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connection refused"));
    global.fetch = (async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })) as typeof fetch;

    const res = await GET();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.services.database.status).toBe("down");
  });
});
