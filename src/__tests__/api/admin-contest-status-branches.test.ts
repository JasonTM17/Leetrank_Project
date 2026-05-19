import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { POST } from "@/app/api/admin/contests/[id]/status/route";

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/admin/contests/[id]/status — branch padding", () => {
  const url = "http://x/api/admin/contests/c1/status";

  it("returns 401 when no session is present", async () => {
    const res = await POST(
      asNextRequest(jsonRequest(url, { status: "active" })),
      paramsFor("c1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for malformed JSON body", async () => {
    await loginAs({ role: "admin" });
    const req = asNextRequest(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      })
    );
    const res = await POST(req, paramsFor("c1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when status field is missing entirely", async () => {
    await loginAs({ role: "admin" });
    const res = await POST(
      asNextRequest(jsonRequest(url, {})),
      paramsFor("c1")
    );
    expect(res.status).toBe(400);
  });

  it("invalidates the cache on successful update (slug threaded through)", async () => {
    await loginAs({ role: "admin" });
    prismaMock.contest.update.mockResolvedValue({
      id: "c1",
      slug: "spring-cup",
      status: "ended",
    } as never);
    const res = await POST(
      asNextRequest(jsonRequest(url, { status: "ended" })),
      paramsFor("c1")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contest.slug).toBe("spring-cup");
    expect(data.contest.status).toBe("ended");
  });

  it("returns 500 on an unrelated db error", async () => {
    await loginAs({ role: "admin" });
    prismaMock.contest.update.mockRejectedValue(new Error("connection lost"));
    const res = await POST(
      asNextRequest(jsonRequest(url, { status: "active" })),
      paramsFor("c1")
    );
    expect(res.status).toBe(500);
  });
});
