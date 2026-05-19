import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { plainRequest, asNextRequest, loginAs } from "../helpers";
import { DELETE as deleteUser } from "@/app/api/admin/users/[id]/route";
import { DELETE as deleteDiscussion } from "@/app/api/admin/discussions/[id]/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("DELETE /api/admin/users/[id] — branch padding", () => {
  it("returns 401 when no session is set", async () => {
    const res = await deleteUser(
      asNextRequest(plainRequest("http://x/api/admin/users/u-1", { method: "DELETE" })),
      params("u-1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 409 if admin tries to delete their own account", async () => {
    await loginAs({ role: "admin", userId: "self-id" });
    const res = await deleteUser(
      asNextRequest(plainRequest("http://x/api/admin/users/self-id", { method: "DELETE" })),
      params("self-id")
    );
    expect(res.status).toBe(409);
  });

  it("returns 500 on unrelated db error during delete", async () => {
    await loginAs({ role: "admin", userId: "admin-1" });
    prismaMock.user.delete.mockRejectedValue(new Error("connection lost") as never);
    const res = await deleteUser(
      asNextRequest(plainRequest("http://x/api/admin/users/u-1", { method: "DELETE" })),
      params("u-1")
    );
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/admin/discussions/[id] — branch padding", () => {
  it("returns 401 with no session", async () => {
    const res = await deleteDiscussion(
      asNextRequest(plainRequest("http://x/api/admin/discussions/d-1", { method: "DELETE" })),
      params("d-1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await deleteDiscussion(
      asNextRequest(plainRequest("http://x/api/admin/discussions/d-1", { method: "DELETE" })),
      params("d-1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 500 on unrelated db error", async () => {
    await loginAs({ role: "admin" });
    prismaMock.discussion.delete.mockRejectedValue(new Error("db down") as never);
    const res = await deleteDiscussion(
      asNextRequest(plainRequest("http://x/api/admin/discussions/d-1", { method: "DELETE" })),
      params("d-1")
    );
    expect(res.status).toBe(500);
  });
});
