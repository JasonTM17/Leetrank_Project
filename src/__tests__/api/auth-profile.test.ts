import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { PATCH } from "@/app/api/auth/profile/route";

describe("PATCH /api/auth/profile", () => {
  it("returns 401 unauthenticated", async () => {
    const res = await PATCH(asNextRequest(jsonRequest("http://x/api/auth/profile", { bio: "hi" })));
    expect(res.status).toBe(401);
  });

  it("400 on too-long bio", async () => {
    await loginAs();
    const res = await PATCH(asNextRequest(jsonRequest("http://x/api/auth/profile", {
      bio: "a".repeat(501),
    })));
    expect(res.status).toBe(400);
  });

  it("400 on non-URL avatar", async () => {
    await loginAs();
    const res = await PATCH(asNextRequest(jsonRequest("http://x/api/auth/profile", {
      avatar: "not a url",
    })));
    expect(res.status).toBe(400);
  });

  it("updates the bio and returns the public user", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.user.update.mockResolvedValue({
      id: "u1",
      email: "u1@x.com",
      username: "u1",
      role: "user",
      avatar: null,
      bio: "Hello world",
      createdAt: new Date(),
    } as never);

    const res = await PATCH(asNextRequest(jsonRequest("http://x/api/auth/profile", {
      bio: "Hello world",
    })));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.bio).toBe("Hello world");
    expect(data.user).not.toHaveProperty("password");
  });

  it("treats empty-string avatar as a clear (null)", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.user.update.mockResolvedValue({
      id: "u1",
      email: "u1@x.com",
      username: "u1",
      role: "user",
      avatar: null,
      bio: null,
      createdAt: new Date(),
    } as never);

    await PATCH(asNextRequest(jsonRequest("http://x/api/auth/profile", { avatar: "" })));

    const args = prismaMock.user.update.mock.calls[0]?.[0];
    expect(args?.data.avatar).toBeNull();
  });

  it("400 on malformed JSON", async () => {
    await loginAs();
    const req = asNextRequest(new Request("http://x/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }));
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
