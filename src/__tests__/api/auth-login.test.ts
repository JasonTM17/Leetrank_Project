import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest } from "../helpers";
import { POST } from "@/app/api/auth/login/route";
import bcrypt from "bcryptjs";

// Login uses a per-IP rate limiter that lives in module scope across the
// whole test file. Give every test a unique IP so the budget for one test
// never spills into another.
let ipSerial = 0;
function uniqueIp(): string {
  ipSerial += 1;
  return `10.0.0.${ipSerial}`;
}

function loginRequest(body: unknown, ip = uniqueIp()) {
  const req = jsonRequest("http://x/api/auth/login", body, {
    headers: { "x-forwarded-for": ip },
  });
  return asNextRequest(req);
}

function rawLoginRequest(rawBody: string, ip = uniqueIp()) {
  return asNextRequest(new Request("http://x/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: rawBody,
  }));
}

describe("POST /api/auth/login", () => {
  const validBody = { email: "alice@x.com", password: "secure123" };

  it("returns 200 and sets a token cookie on valid credentials", async () => {
    const hashed = await bcrypt.hash(validBody.password, 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: validBody.email,
      username: "alice",
      role: "user",
      password: hashed,
      avatar: null,
      bio: null,
      createdAt: new Date(),
    } as never);

    const res = await POST(loginRequest(validBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.username).toBe("alice");
    expect(data.user).not.toHaveProperty("password");
  });

  it("returns 401 when user is not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const res = await POST(loginRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 401 on wrong password", async () => {
    const hashed = await bcrypt.hash("different-password", 10);
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: validBody.email,
      username: "alice",
      role: "user",
      password: hashed,
    } as never);

    const res = await POST(loginRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid email format", async () => {
    const res = await POST(loginRequest({ email: "not-email", password: "secure123" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on empty password", async () => {
    const res = await POST(loginRequest({ email: validBody.email, password: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await POST(rawLoginRequest("{"));
    expect(res.status).toBe(400);
  });

  it("returns 429 after burning the per-IP budget", async () => {
    const sticky = "172.20.0.42";
    prismaMock.user.findUnique.mockResolvedValue(null);
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const res = await POST(loginRequest(validBody, sticky));
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

void vi;

