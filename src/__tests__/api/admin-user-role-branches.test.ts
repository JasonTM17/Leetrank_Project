import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { PATCH } from "@/app/api/admin/users/[id]/role/route";

describe("PATCH /api/admin/users/[id]/role — branch padding", () => {
  it("returns 404 when prisma reports the record was not found", async () => {
    await loginAs({ role: "admin", userId: "admin-1" });
    prismaMock.user.update.mockRejectedValue(
      new Error("Record to update not found.") as never
    );
    const res = await PATCH(
      asNextRequest(jsonRequest("http://x/api/admin/users/u-missing/role", { role: "user" })),
      { params: Promise.resolve({ id: "u-missing" }) }
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("User not found");
  });

  it("returns 500 on an unrelated db error", async () => {
    await loginAs({ role: "admin", userId: "admin-1" });
    prismaMock.user.update.mockRejectedValue(new Error("connection lost") as never);
    const res = await PATCH(
      asNextRequest(jsonRequest("http://x/api/admin/users/u-1/role", { role: "user" })),
      { params: Promise.resolve({ id: "u-1" }) }
    );
    expect(res.status).toBe(500);
  });

  it("rejects malformed JSON body with 400", async () => {
    await loginAs({ role: "admin", userId: "admin-1" });
    const req = asNextRequest(
      new Request("http://x/api/admin/users/u-1/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      })
    );
    const res = await PATCH(req, { params: Promise.resolve({ id: "u-1" }) });
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported role value with 400", async () => {
    await loginAs({ role: "admin", userId: "admin-1" });
    const res = await PATCH(
      asNextRequest(jsonRequest("http://x/api/admin/users/u-1/role", { role: "superuser" })),
      { params: Promise.resolve({ id: "u-1" }) }
    );
    expect(res.status).toBe(400);
  });
});
