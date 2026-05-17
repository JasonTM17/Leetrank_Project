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
});
