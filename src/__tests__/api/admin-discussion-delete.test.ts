import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { DELETE } from "@/app/api/admin/discussions/[id]/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const opts = { method: "DELETE" } as const;

describe("DELETE /api/admin/discussions/[id]", () => {
  it("403 non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await DELETE(asNextRequest(new Request("http://x/api/admin/discussions/d1", opts)), paramsFor("d1"));
    expect(res.status).toBe(403);
  });

  it("401 unauthenticated", async () => {
    const res = await DELETE(asNextRequest(new Request("http://x/api/admin/discussions/d1", opts)), paramsFor("d1"));
    expect(res.status).toBe(401);
  });

  it("happy path delegates to prisma.discussion.delete", async () => {
    await loginAs({ role: "admin" });
    prismaMock.discussion.delete.mockResolvedValue({ id: "d1" } as never);

    const res = await DELETE(asNextRequest(new Request("http://x/api/admin/discussions/d1", opts)), paramsFor("d1"));
    expect(res.status).toBe(200);
    expect(prismaMock.discussion.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
  });

  it("404 when prisma reports record missing", async () => {
    await loginAs({ role: "admin" });
    prismaMock.discussion.delete.mockRejectedValue(new Error("Record to delete does not exist."));

    const res = await DELETE(asNextRequest(new Request("http://x/api/admin/discussions/missing", opts)), paramsFor("missing"));
    expect(res.status).toBe(404);
  });
});
