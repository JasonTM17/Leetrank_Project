import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { PATCH } from "@/app/api/discussions/[id]/edit/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/discussions/[id]/edit", () => {
  const url = (id: string) => `http://x/api/discussions/${id}/edit`;
  const validBody = { body: "edited content" };

  it("401 unauthenticated", async () => {
    const res = await PATCH(asNextRequest(jsonRequest(url("d1"), validBody, { method: "PATCH" })), paramsFor("d1"));
    expect(res.status).toBe(401);
  });

  it("404 missing discussion", async () => {
    await loginAs();
    prismaMock.discussion.findUnique.mockResolvedValue(null);
    const res = await PATCH(asNextRequest(jsonRequest(url("d-missing"), validBody, { method: "PATCH" })), paramsFor("d-missing"));
    expect(res.status).toBe(404);
  });

  it("403 admin can't edit someone else's content", async () => {
    await loginAs({ userId: "admin-1", role: "admin" });
    prismaMock.discussion.findUnique.mockResolvedValue({ id: "d1", userId: "u1" } as never);
    const res = await PATCH(asNextRequest(jsonRequest(url("d1"), validBody, { method: "PATCH" })), paramsFor("d1"));
    expect(res.status).toBe(403);
  });

  it("400 empty body", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.findUnique.mockResolvedValue({ id: "d1", userId: "u1" } as never);
    const res = await PATCH(asNextRequest(jsonRequest(url("d1"), { body: "" }, { method: "PATCH" })), paramsFor("d1"));
    expect(res.status).toBe(400);
  });

  it("200 author can edit", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.discussion.findUnique.mockResolvedValue({ id: "d1", userId: "u1" } as never);
    prismaMock.discussion.update.mockResolvedValue({
      id: "d1", body: validBody.body, updatedAt: new Date(),
    } as never);

    const res = await PATCH(asNextRequest(jsonRequest(url("d1"), validBody, { method: "PATCH" })), paramsFor("d1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.discussion.body).toBe(validBody.body);
  });
});
