import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { PATCH } from "@/app/api/admin/users/[id]/role/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/admin/users/[id]/role", () => {
  it("403 non-admin", async () => {
    await loginAs({ userId: "u1", role: "user" });
    const res = await PATCH(asNextRequest(jsonRequest("http://x/api/admin/users/u2/role", { role: "admin" })), paramsFor("u2"));
    expect(res.status).toBe(403);
  });

  it("409 self-demotion attempt", async () => {
    await loginAs({ userId: "admin-1", role: "admin" });
    const res = await PATCH(asNextRequest(jsonRequest("http://x/api/admin/users/admin-1/role", { role: "user" })), paramsFor("admin-1"));
    expect(res.status).toBe(409);
  });

  it("400 invalid role enum", async () => {
    await loginAs({ role: "admin" });
    const res = await PATCH(asNextRequest(jsonRequest("http://x/api/admin/users/u2/role", { role: "superuser" })), paramsFor("u2"));
    expect(res.status).toBe(400);
  });

  it("happy path promotes user → admin", async () => {
    await loginAs({ userId: "admin-1", role: "admin" });
    prismaMock.user.update.mockResolvedValue({ id: "u2", username: "u2", role: "admin" } as never);

    const res = await PATCH(asNextRequest(jsonRequest("http://x/api/admin/users/u2/role", { role: "admin" })), paramsFor("u2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.role).toBe("admin");
  });

  it("404 when prisma reports record missing", async () => {
    await loginAs({ userId: "admin-1", role: "admin" });
    prismaMock.user.update.mockRejectedValue(new Error("Record to update not found."));

    const res = await PATCH(asNextRequest(jsonRequest("http://x/api/admin/users/missing/role", { role: "admin" })), paramsFor("missing"));
    expect(res.status).toBe(404);
  });
});
