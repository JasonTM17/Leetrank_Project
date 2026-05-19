import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest } from "../helpers";
import { POST } from "@/app/api/auth/register/route";

describe("POST /api/auth/register", () => {
  const validBody = { username: "alice", email: "alice@x.com", password: "secure123" };

  it("creates a user and returns 201", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "u-new",
      email: validBody.email,
      username: validBody.username,
      role: "user",
      createdAt: new Date(),
    } as never);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", validBody)));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.username).toBe("alice");
    expect(data.user).not.toHaveProperty("password");
  });

  it("returns 409 when email already exists", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ email: validBody.email, username: "other" } as never);
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", validBody)));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/email/i);
  });

  it("returns 409 when username already exists", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ email: "other@x.com", username: validBody.username } as never);
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", validBody)));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/username/i);
  });

  it("rejects invalid email", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", { ...validBody, email: "not-email" })));
    expect(res.status).toBe(400);
  });

  it("rejects short password", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", { ...validBody, password: "12" })));
    expect(res.status).toBe(400);
  });

  it("rejects username with special characters", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", { ...validBody, username: "<bad>" })));
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON body", async () => {
    const req = asNextRequest(new Request("http://x/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    }));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // Bug #19: validation runs before the rate-limiter, so a typo doesn't
  // burn a bucket slot. Hammer the route with malformed bodies on the
  // same IP and verify a subsequent valid registration still goes through.
  it("Bug #19: invalid bodies do not consume the per-IP rate-limit budget", async () => {
    const ip = "10.42.0.7";
    for (let i = 0; i < 10; i++) {
      const r = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", {
        email: "not-email",
        username: "alice",
        password: "secure123",
      }, { headers: { "x-forwarded-for": ip } })));
      expect(r.status).toBe(400);
    }
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "u-x",
      email: "alice@x.com",
      username: "alice",
      role: "user",
      createdAt: new Date(),
    } as never);
    const ok = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", {
      ...validBody,
    }, { headers: { "x-forwarded-for": ip } })));
    expect(ok.status).toBe(201);
  });

  // Bug #8: the per-IP register bucket is wide enough (5/hour) to allow
  // a 2nd legitimate account from the same IP. Exercise that path.
  it("Bug #8: same IP can register two distinct accounts", async () => {
    const ip = "10.42.0.8";
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValueOnce({
      id: "u-a",
      email: "alpha@x.com",
      username: "alpha",
      role: "user",
      createdAt: new Date(),
    } as never).mockResolvedValueOnce({
      id: "u-b",
      email: "beta@x.com",
      username: "beta",
      role: "user",
      createdAt: new Date(),
    } as never);

    const r1 = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", {
      email: "alpha@x.com",
      username: "alpha",
      password: "secure123",
    }, { headers: { "x-forwarded-for": ip } })));
    expect(r1.status).toBe(201);

    const r2 = await POST(asNextRequest(jsonRequest("http://x/api/auth/register", {
      email: "beta@x.com",
      username: "beta",
      password: "secure123",
    }, { headers: { "x-forwarded-for": ip } })));
    expect(r2.status).toBe(201);
  });
});
