import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { POST } from "@/app/api/admin/contests/[id]/status/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/contests/[id]/status", () => {
  const url = "http://x/api/admin/contests/c1/status";

  it("403 non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await POST(asNextRequest(jsonRequest(url, { status: "active" })), paramsFor("c1"));
    expect(res.status).toBe(403);
  });

  it("400 invalid status enum", async () => {
    await loginAs({ role: "admin" });
    const res = await POST(asNextRequest(jsonRequest(url, { status: "frozen" })), paramsFor("c1"));
    expect(res.status).toBe(400);
  });

  it("happy path advances status", async () => {
    await loginAs({ role: "admin" });
    prismaMock.contest.update.mockResolvedValue({ id: "c1", status: "active" } as never);
    const res = await POST(asNextRequest(jsonRequest(url, { status: "active" })), paramsFor("c1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contest.status).toBe("active");
  });

  it("404 record missing", async () => {
    await loginAs({ role: "admin" });
    prismaMock.contest.update.mockRejectedValue(new Error("Record to update not found."));
    const res = await POST(asNextRequest(jsonRequest(url, { status: "ended" })), paramsFor("c1"));
    expect(res.status).toBe(404);
  });
});
