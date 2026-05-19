import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { PATCH } from "@/app/api/discussions/[id]/edit/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/discussions/[id]/edit — branch padding", () => {
  const url = "http://x/api/discussions/d-1/edit";

  it("returns 401 when no session cookie present", async () => {
    const res = await PATCH(
      asNextRequest(jsonRequest(url, { body: "edited" }, { method: "PATCH" })),
      params("d-1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when discussion not found", async () => {
    await loginAs({ userId: "u-1" });
    prismaMock.discussion.findUnique.mockResolvedValue(null);
    const res = await PATCH(
      asNextRequest(jsonRequest(url, { body: "edited" }, { method: "PATCH" })),
      params("d-1")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller is not the author", async () => {
    await loginAs({ userId: "u-1" });
    prismaMock.discussion.findUnique.mockResolvedValue({
      id: "d-1",
      userId: "u-other",
    } as never);
    const res = await PATCH(
      asNextRequest(jsonRequest(url, { body: "edited" }, { method: "PATCH" })),
      params("d-1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when JSON body is malformed", async () => {
    await loginAs({ userId: "u-1" });
    prismaMock.discussion.findUnique.mockResolvedValue({
      id: "d-1",
      userId: "u-1",
    } as never);
    const req = asNextRequest(
      new Request(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      })
    );
    const res = await PATCH(req, params("d-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body field is missing or empty", async () => {
    await loginAs({ userId: "u-1" });
    prismaMock.discussion.findUnique.mockResolvedValue({
      id: "d-1",
      userId: "u-1",
    } as never);
    const res = await PATCH(
      asNextRequest(jsonRequest(url, { body: "" }, { method: "PATCH" })),
      params("d-1")
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when prisma update throws unrelated error", async () => {
    await loginAs({ userId: "u-1" });
    prismaMock.discussion.findUnique.mockResolvedValue({
      id: "d-1",
      userId: "u-1",
    } as never);
    prismaMock.discussion.update.mockRejectedValue(new Error("db down") as never);
    const res = await PATCH(
      asNextRequest(jsonRequest(url, { body: "valid" }, { method: "PATCH" })),
      params("d-1")
    );
    expect(res.status).toBe(500);
  });
});
