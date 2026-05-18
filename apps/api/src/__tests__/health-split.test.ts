import { describe, it, expect } from "vitest";
import { app } from "../server.js";
import { prisma } from "../db.js";

type MockFn = ReturnType<typeof import("vitest").vi.fn>;
type Mocked = { $queryRaw: MockFn };
const mocked = prisma as unknown as Mocked;

describe("/healthz vs /readyz split", () => {
  it("/healthz returns 200 even when DB is down (no DB call)", async () => {
    mocked.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("leetrank-api");
  });

  it("/readyz returns 503 when DB is down", async () => {
    mocked.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    const res = await app.request("/readyz");
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      status: string;
      services: { database: { status: string; error?: string } };
    };
    expect(body.status).toBe("down");
    expect(body.services.database.status).toBe("down");
  });

  it("/readyz returns 200 with database.status ok when DB is up", async () => {
    const res = await app.request("/readyz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      services: { database: { status: string; latencyMs?: number } };
    };
    expect(body.status).toBe("ok");
    expect(body.services.database.status).toBe("ok");
  });

  it("/health is an alias of /readyz", async () => {
    mocked.$queryRaw.mockRejectedValueOnce(new Error("oops"));
    const res = await app.request("/health");
    expect(res.status).toBe(503);
  });
});
