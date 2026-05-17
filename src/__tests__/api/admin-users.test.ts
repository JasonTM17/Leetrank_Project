import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest, loginAs } from "../helpers";
import { GET } from "@/app/api/admin/users/route";

describe("GET /api/admin/users", () => {
  it("returns 403 for non-admin", async () => {
    await loginAs({ role: "user" });
    const res = await GET();
    expect(res.status).toBe(403);
    void asNextRequest;
  });

  it("returns 403 for unauthenticated", async () => {
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns user list with submission counts for admin", async () => {
    await loginAs({ role: "admin" });
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "u1",
        email: "a@x.com",
        username: "alice",
        role: "user",
        avatar: null,
        createdAt: new Date(),
        _count: { submissions: 5 },
      },
    ] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.users).toHaveLength(1);
    expect(data.users[0]._count.submissions).toBe(5);
  });
});
