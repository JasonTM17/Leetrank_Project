import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { GET } from "@/app/api/submissions/[id]/stream/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/submissions/[id]/stream", () => {
  it("401 unauthenticated", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/submissions/s1/stream")), paramsFor("s1"));
    expect(res.status).toBe(401);
  });

  it("404 unknown submission", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findUnique.mockResolvedValue(null);
    const res = await GET(asNextRequest(new Request("http://x/api/submissions/missing/stream")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("403 when viewer is neither author nor admin", async () => {
    await loginAs({ userId: "stranger" });
    prismaMock.submission.findUnique.mockResolvedValue({ id: "s1", userId: "u1", status: "pending" } as never);
    const res = await GET(asNextRequest(new Request("http://x/api/submissions/s1/stream")), paramsFor("s1"));
    expect(res.status).toBe(403);
  });

  it("returns text/event-stream content type when authorised", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findUnique.mockResolvedValue({ id: "s1", userId: "u1", status: "pending" } as never);

    const res = await GET(asNextRequest(new Request("http://x/api/submissions/s1/stream")), paramsFor("s1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toMatch(/no-cache/);
    // Accel-Buffering off so Caddy/Nginx don't buffer SSE chunks.
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    // Cancel the stream so the test doesn't leak the poll timer.
    await res.body?.cancel();
  });

  it("admin can stream someone else's submission", async () => {
    await loginAs({ userId: "admin-1", role: "admin" });
    prismaMock.submission.findUnique.mockResolvedValue({ id: "s1", userId: "u1", status: "pending" } as never);

    const res = await GET(asNextRequest(new Request("http://x/api/submissions/s1/stream")), paramsFor("s1"));
    expect(res.status).toBe(200);
    await res.body?.cancel();
  });
});
