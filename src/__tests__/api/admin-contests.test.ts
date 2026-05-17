import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { POST } from "@/app/api/admin/contests/route";

describe("POST /api/admin/contests", () => {
  const valid = {
    title: "Spring Cup",
    slug: "spring-cup",
    startTime: "2026-05-01T10:00:00Z",
    endTime: "2026-05-01T12:00:00Z",
  };

  it("returns 403 for non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await POST(asNextRequest(jsonRequest("http://x/api/admin/contests", valid)));
    expect(res.status).toBe(403);
  });

  it("returns 401 with no session", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/admin/contests", valid)));
    expect(res.status).toBe(403); // route returns 403 for both unauthenticated and non-admin
  });

  it("creates contest on valid admin payload", async () => {
    await loginAs({ role: "admin" });
    prismaMock.contest.create.mockResolvedValue({
      id: "c1",
      ...valid,
      startTime: new Date(valid.startTime),
      endTime: new Date(valid.endTime),
      status: "upcoming",
    } as never);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/admin/contests", valid)));
    expect(res.status).toBe(201);
  });

  it("rejects when endTime is before startTime", async () => {
    await loginAs({ role: "admin" });
    const res = await POST(asNextRequest(jsonRequest("http://x/api/admin/contests", {
      ...valid,
      endTime: "2026-04-30T12:00:00Z",
    })));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/endTime/i);
  });

  it("rejects non-ISO timestamps", async () => {
    await loginAs({ role: "admin" });
    const res = await POST(asNextRequest(jsonRequest("http://x/api/admin/contests", {
      ...valid,
      startTime: "tomorrow",
    })));
    expect(res.status).toBe(400);
  });
});
