import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { DELETE } from "@/app/api/admin/users/[id]/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const opts = { method: "DELETE" } as const;

describe("DELETE /api/admin/users/[id]", () => {
  it("403 unauthenticated", async () => {
    const res = await DELETE(asNextRequest(new Request("http://x/api/admin/users/u1", opts)), paramsFor("u1"));
    expect(res.status).toBe(403);
  });

  it("403 non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await DELETE(asNextRequest(new Request("http://x/api/admin/users/u1", opts)), paramsFor("u1"));
    expect(res.status).toBe(403);
  });

  it("409 self-deletion attempt", async () => {
    await loginAs({ userId: "admin-1", role: "admin" });
    const res = await DELETE(asNextRequest(new Request("http://x/api/admin/users/admin-1", opts)), paramsFor("admin-1"));
    expect(res.status).toBe(409);
  });

  it("404 record missing", async () => {
    await loginAs({ userId: "admin-1", role: "admin" });
    prismaMock.user.delete.mockRejectedValue(new Error("Record to delete does not exist."));
    const res = await DELETE(asNextRequest(new Request("http://x/api/admin/users/missing", opts)), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("200 happy path delegates the cascade to prisma", async () => {
    await loginAs({ userId: "admin-1", role: "admin" });
    prismaMock.user.delete.mockResolvedValue({ id: "u2" } as never);

    const res = await DELETE(asNextRequest(new Request("http://x/api/admin/users/u2", opts)), paramsFor("u2"));
    expect(res.status).toBe(200);
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: "u2" } });
  });
});
