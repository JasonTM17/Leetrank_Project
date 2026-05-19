import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";
import { POST } from "@/app/api/auth/change-password/route";
import { POST as LOGIN } from "@/app/api/auth/login/route";

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
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "u1@x.com", password: hashed } as never);
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

  // Bug #2: after a successful change-password, the next login on the
  // *new* credential must succeed even if recent failed logins burned
  // through the per-account budget. The route bumps the per-account
  // bucket generation; the login route should land in a fresh bucket.
  it("Bug #2: re-arms the per-account login bucket so login succeeds post-rotation", async () => {
    const email = "rotator@x.com";
    const oldHashed = await bcrypt.hash("oldpassword", 10);
    const newPassword = "shinypassword456";
    const newHashed = await bcrypt.hash(newPassword, 10);
    const sticky = "10.0.99.42";

    // 1) Burn the per-account login bucket with wrong-password attempts.
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email,
      username: "rotator",
      password: oldHashed,
      role: "user",
      avatar: null,
      bio: null,
      createdAt: new Date(),
    } as never);
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const res = await LOGIN(asNextRequest(jsonRequest("http://x/api/auth/login", {
        email,
        password: "guess",
      }, { headers: { "x-forwarded-for": `10.0.${i}.1` } })));
      last = res.status;
    }
    expect(last).toBe(429);

    // 2) Authenticated change-password from a different IP — the user
    //    is signed-in via cookie, so the per-IP login bucket doesn't apply.
    await loginAs({ userId: "u1", email });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email,
      password: oldHashed,
    } as never);
    prismaMock.user.update.mockResolvedValue({ id: "u1" } as never);

    const cpRes = await POST(asNextRequest(jsonRequest("http://x/api/auth/change-password", {
      currentPassword: "oldpassword",
      newPassword,
    })));
    expect(cpRes.status).toBe(200);

    // 3) Fresh login with the rotated credential — same minute, fresh IP
    //    so only the per-account bucket is at issue.
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email,
      username: "rotator",
      password: newHashed,
      role: "user",
      avatar: null,
      bio: null,
      createdAt: new Date(),
    } as never);
    const ok = await LOGIN(asNextRequest(jsonRequest("http://x/api/auth/login", {
      email,
      password: newPassword,
    }, { headers: { "x-forwarded-for": "10.99.99.99" } })));
    expect(ok.status).toBe(200);
  });
});
