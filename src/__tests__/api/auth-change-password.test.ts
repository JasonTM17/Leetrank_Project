import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { POST } from "@/app/api/auth/change-password/route";

describe("POST /api/auth/change-password", () => {
  const valid = {
    currentPassword: "current123",
    newPassword: "shinypassword456",
  };

  it("401 unauthenticated", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/change-password", valid)));
    expect(res.status).toBe(401);
  });

  it("400 if same as current", async () => {
    await loginAs({ userId: "u1" });
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/change-password", {
      currentPassword: "samepass",
      newPassword: "samepass",
    })));
    expect(res.status).toBe(400);
  });

  it("400 if new password is too short", async () => {
    await loginAs({ userId: "u1" });
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/change-password", {
      currentPassword: "current123",
      newPassword: "12",
    })));
    expect(res.status).toBe(400);
  });

  it("404 if user disappeared", async () => {
    await loginAs({ userId: "ghost" });
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/change-password", valid)));
    expect(res.status).toBe(404);
  });

  it("401 if currentPassword doesn't match", async () => {
    await loginAs({ userId: "u1" });
    const hashed = await bcrypt.hash("different", 10);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", password: hashed } as never);
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/change-password", valid)));
    expect(res.status).toBe(401);
  });

  it("200 happy path updates the password hash", async () => {
    await loginAs({ userId: "u1" });
    const hashed = await bcrypt.hash(valid.currentPassword, 10);
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", password: hashed } as never);
    prismaMock.user.update.mockResolvedValue({ id: "u1" } as never);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/change-password", valid)));
    expect(res.status).toBe(200);

    const args = prismaMock.user.update.mock.calls[0]?.[0];
    expect(args?.where).toEqual({ id: "u1" });
    // Ensure the password isn't stored in plaintext.
    expect(args?.data.password).not.toBe(valid.newPassword);
    expect(args?.data.password.startsWith("$2")).toBe(true);
  });

  it("400 on malformed JSON", async () => {
    await loginAs({ userId: "u1" });
    const req = asNextRequest(new Request("http://x/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
