import { describe, it, expect } from "vitest";
import { setCookie } from "../setup";
import { signToken } from "@/lib/auth";
import { GET } from "@/app/api/auth/me/route";
import { prismaMock } from "../setup";

describe("GET /api/auth/me", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the user when token is valid", async () => {
    const token = await signToken({
      userId: "u1",
      email: "u1@x.com",
      username: "u1",
      role: "user",
    });
    setCookie("token", token);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "u1@x.com",
      username: "u1",
      role: "user",
      avatar: null,
      bio: null,
      createdAt: new Date(),
    } as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.username).toBe("u1");
    expect(data.user).not.toHaveProperty("password");
  });

  it("returns 404 if the token is valid but the user was deleted", async () => {
    const token = await signToken({
      userId: "u-deleted",
      email: "x@y.com",
      username: "ghost",
      role: "user",
    });
    setCookie("token", token);
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(404);
  });
});
