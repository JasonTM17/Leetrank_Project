import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { asNextRequest } from "../helpers";
import { GET } from "@/app/api/users/route";

describe("GET /api/users", () => {
  it("returns public user fields only", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", username: "alice", avatar: null, bio: "Hi", createdAt: new Date() },
    ] as never);
    prismaMock.user.count.mockResolvedValue(1);

    const res = await GET(asNextRequest(new Request("http://x/api/users")));
    const data = await res.json();
    expect(data.users[0].username).toBe("alice");
    expect(data.users[0]).not.toHaveProperty("email");
    expect(data.users[0]).not.toHaveProperty("password");
    expect(data.users[0]).not.toHaveProperty("role");
  });

  it("filters by search when provided", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    await GET(asNextRequest(new Request("http://x/api/users?search=al")));

    const args = prismaMock.user.findMany.mock.calls[0]?.[0];
    expect(args?.where).toEqual({ username: { contains: "al" } });
  });

  it("clamps limit to 100", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);
    await GET(asNextRequest(new Request("http://x/api/users?limit=999")));
    const args = prismaMock.user.findMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(100);
  });
});
