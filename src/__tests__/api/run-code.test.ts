import { describe, it, expect, vi } from "vitest";
import { prismaMock } from "../setup";
import { jsonRequest, asNextRequest } from "../helpers";

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

  it("returns judged results on the happy path", async () => {
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
    const req = asNextRequest(new Request("http://x/api/run-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on unsupported language", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/run-code", {
      ...validBody, language: "cobol",
    })));
    expect(res.status).toBe(400);
  });

  it("returns 400 on missing testCases", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/run-code", {
      code: "x", language: "python", testCases: [],
    })));
    expect(res.status).toBe(400);
  });

  it("returns 503 when the judge is unreachable", async () => {
    (executeCode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new (JudgeUnavailableError as new (c: unknown) => Error)("ECONNREFUSED")
    );

    const res = await POST(asNextRequest(jsonRequest("http://x/api/run-code", validBody)));
    expect(res.status).toBe(503);
  });

  it("returns 500 on unexpected errors", async () => {
    (executeCode as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));

    const res = await POST(asNextRequest(jsonRequest("http://x/api/run-code", validBody)));
    expect(res.status).toBe(500);
  });
});

void prismaMock;
