import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { PUT, DELETE } from "@/app/api/admin/problems/[id]/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PUT /api/admin/problems/[id]", () => {
  it("returns 403 for non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await PUT(
      asNextRequest(jsonRequest("http://x/api/admin/problems/p1", { title: "x" })),
      paramsFor("p1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 on Zod failure (invalid difficulty)", async () => {
    await loginAs({ role: "admin" });
    const res = await PUT(
      asNextRequest(jsonRequest("http://x/api/admin/problems/p1", { difficulty: "extreme" })),
      paramsFor("p1")
    );
    expect(res.status).toBe(400);
  });

  it("accepts an empty body (no-op partial update)", async () => {
    await loginAs({ role: "admin" });
    prismaMock.problem.update.mockResolvedValue({ id: "p1" } as never);

    const res = await PUT(
      asNextRequest(jsonRequest("http://x/api/admin/problems/p1", {})),
      paramsFor("p1")
    );
    expect(res.status).toBe(200);
  });

  it("400 on malformed JSON", async () => {
    await loginAs({ role: "admin" });
    const req = asNextRequest(new Request("http://x/api/admin/problems/p1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }));
    const res = await PUT(req, paramsFor("p1"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/problems/[id]", () => {
  it("returns 403 for non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await DELETE(
      asNextRequest(new Request("http://x/api/admin/problems/p1", { method: "DELETE" })),
      paramsFor("p1")
    );
    expect(res.status).toBe(403);
  });

  it("deletes for admin", async () => {
    await loginAs({ role: "admin" });
    prismaMock.problem.delete.mockResolvedValue({ id: "p1" } as never);

    const res = await DELETE(
      asNextRequest(new Request("http://x/api/admin/problems/p1", { method: "DELETE" })),
      paramsFor("p1")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
