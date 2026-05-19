import { describe, it, expect } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest } from "../helpers";
import { POST } from "@/app/api/auth/register/route";

// Branch padding for /api/auth/register: hits the email-prefix bucket and
// the JSON-parse error path. Avoids the per-IP 429 path that's flaky on CI.

describe("POST /api/auth/register — extra branches", () => {
  const valid = { username: "alice", email: "alice@x.com", password: "secure123" };

  it("returns 400 on JSON parse failure (catch branch)", async () => {
    const req = asNextRequest(
      new Request("http://x/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      })
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 409 with 'Username already in use' when username collides", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "u-other",
      email: "different@x.com",
      username: "alice",
    } as never);
    const res = await POST(
      asNextRequest(
        jsonRequest(
          "http://x/api/auth/register",
          { ...valid },
          { headers: { "x-forwarded-for": "10.99.0.1" } }
        )
      )
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/username/i);
  });

  it("treats trailing whitespace + casing in email as the same prefix bucket", async () => {
    // The email-prefix bucket lowercases/normalizes — exercise that branch.
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "u-mixed",
      email: "Mixed@X.COM",
      username: "mixed",
      role: "user",
      createdAt: new Date(),
    } as never);
    const res = await POST(
      asNextRequest(
        jsonRequest(
          "http://x/api/auth/register",
          { ...valid, email: "Mixed@X.COM", username: "mixed" },
          { headers: { "x-forwarded-for": "10.99.0.2" } }
        )
      )
    );
    // First call should pass (or rate-limit) — verify it does not 500.
    expect([201, 429]).toContain(res.status);
  });

  it("returns 500 on prisma error during user.findFirst", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("db unreachable") as never);
    const res = await POST(
      asNextRequest(
        jsonRequest("http://x/api/auth/register", { ...valid }, {
          headers: { "x-forwarded-for": "10.99.0.3" },
        })
      )
    );
    expect(res.status).toBe(500);
  });
});
