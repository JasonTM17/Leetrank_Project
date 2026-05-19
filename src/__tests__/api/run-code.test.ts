import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest, loginAs } from "../helpers";

vi.mock("@/services/judge", () => {
  class JudgeUnavailableError extends Error {
    constructor(cause: unknown) {
      super(`Judge unavailable: ${cause}`);
      this.name = "JudgeUnavailableError";
    }
  }
  return {
    executeCode: vi.fn(),
    JudgeUnavailableError,
  };
});

import { POST } from "@/app/api/run-code/route";
import { executeCode, JudgeUnavailableError } from "@/services/judge";

describe("POST /api/run-code", () => {
  const validBody = {
    code: "print('hi')",
    language: "python",
    testCases: [{ input: "", expected: "hi" }],
  };

  it("returns 401 unauthenticated", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/run-code", validBody)));
    expect(res.status).toBe(401);
  });

  it("returns judged results on the happy path", async () => {
    await loginAs({ userId: "u1" });
    (executeCode as ReturnType<typeof vi.fn>).mockResolvedValue([
      { passed: true, input: "", expected: "hi", actual: "hi", runtime: 12 },
    ]);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/run-code", validBody)));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].passed).toBe(true);
  });

  it("returns 400 on malformed JSON", async () => {
    await loginAs({ userId: "u1" });
    const req = asNextRequest(new Request("http://x/api/run-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on unsupported language", async () => {
    await loginAs({ userId: "u1" });
    const res = await POST(asNextRequest(jsonRequest("http://x/api/run-code", {
      ...validBody, language: "cobol",
    })));
    expect(res.status).toBe(400);
  });

  it("accepts a missing testCases array (defaults to stdin-only run)", async () => {
    await loginAs({ userId: "u1" });
    (executeCode as ReturnType<typeof vi.fn>).mockResolvedValue([
      { passed: false, input: "", expected: "", actual: "hello", runtime: 3 },
    ]);
    const res = await POST(
      asNextRequest(
        jsonRequest("http://x/api/run-code", { code: "x", language: "python" })
      )
    );
    expect(res.status).toBe(200);
    // Confirm the runner was invoked with a single empty test case as a fallback.
    const args = (executeCode as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(args?.testCases).toEqual([{ input: "", expected: "" }]);
  });

  it("includes the missing field name in the 400 message", async () => {
    await loginAs({ userId: "u1" });
    const res = await POST(
      asNextRequest(
        jsonRequest("http://x/api/run-code", { language: "python" })
      )
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    // "code" is the offending field — its name MUST appear in the error.
    expect(data.error).toMatch(/code/);
  });

  it("returns 503 when the judge is unreachable", async () => {
    await loginAs({ userId: "u1" });
    (executeCode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new (JudgeUnavailableError as new (c: unknown) => Error)("ECONNREFUSED")
    );

    const res = await POST(asNextRequest(jsonRequest("http://x/api/run-code", validBody)));
    expect(res.status).toBe(503);
  });

  it("returns 500 on unexpected errors", async () => {
    await loginAs({ userId: "u1" });
    (executeCode as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));

    const res = await POST(asNextRequest(jsonRequest("http://x/api/run-code", validBody)));
    expect(res.status).toBe(500);
  });

  it("rate-limits after 10 calls within the window", async () => {
    await loginAs({ userId: "rate-victim" });
    (executeCode as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    for (let i = 0; i < 10; i++) {
      const ok = await POST(asNextRequest(jsonRequest("http://x/api/run-code", validBody)));
      expect(ok.status).toBe(200);
    }
    const blocked = await POST(asNextRequest(jsonRequest("http://x/api/run-code", validBody)));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});

void prismaMock;
