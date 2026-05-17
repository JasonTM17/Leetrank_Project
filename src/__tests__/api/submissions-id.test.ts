import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { GET } from "@/app/api/submissions/[id]/route";

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/submissions/[id]", () => {
  it("returns 401 unauthenticated", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/submissions/s1")), paramsFor("s1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown id", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findUnique.mockResolvedValue(null);

    const res = await GET(asNextRequest(new Request("http://x/api/submissions/missing")), paramsFor("missing"));
    expect(res.status).toBe(404);
  });

  it("returns the submission to its author", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findUnique.mockResolvedValue({
      id: "s1",
      userId: "u1",
      code: "print('hi')",
      language: "python",
      status: "accepted",
      problem: { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
      user: { id: "u1", username: "alice", avatar: null },
    } as never);

    const res = await GET(asNextRequest(new Request("http://x/api/submissions/s1")), paramsFor("s1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submission.code).toBe("print('hi')");
  });

  it("returns 403 for a different user", async () => {
    await loginAs({ userId: "u2", role: "user" });
    prismaMock.submission.findUnique.mockResolvedValue({
      id: "s1",
      userId: "u1",
      code: "secret",
    } as never);

    const res = await GET(asNextRequest(new Request("http://x/api/submissions/s1")), paramsFor("s1"));
    expect(res.status).toBe(403);
  });

  it("returns 200 to admin even when not the author", async () => {
    await loginAs({ userId: "admin-u", role: "admin" });
    prismaMock.submission.findUnique.mockResolvedValue({
      id: "s1",
      userId: "u1",
      code: "secret",
      problem: { id: "p1", title: "X", slug: "x", difficulty: "easy" },
      user: { id: "u1", username: "u1", avatar: null },
    } as never);

    const res = await GET(asNextRequest(new Request("http://x/api/submissions/s1")), paramsFor("s1"));
    expect(res.status).toBe(200);
  });
});
