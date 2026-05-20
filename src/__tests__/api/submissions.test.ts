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

import { GET, POST } from "@/app/api/submissions/route";
import { executeCode, JudgeUnavailableError } from "@/services/judge";

describe("GET /api/submissions", () => {
  it("returns 401 unauthenticated", async () => {
    const res = await GET(asNextRequest(new Request("http://x/api/submissions")));
    expect(res.status).toBe(401);
  });

  it("filters by problemId when provided", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findMany.mockResolvedValue([] as never);

    await GET(asNextRequest(new Request("http://x/api/submissions?problemId=p1")));

    const args = prismaMock.submission.findMany.mock.calls[0]?.[0];
    expect(args?.where).toMatchObject({ userId: "u1", problemId: "p1" });
  });

  it("returns submissions for the authenticated user", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.submission.findMany.mockResolvedValue([
      {
        id: "s1",
        userId: "u1",
        status: "accepted",
        problem: { id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy" },
      },
    ] as never);

    const res = await GET(asNextRequest(new Request("http://x/api/submissions")));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.submissions).toHaveLength(1);
  });
});

describe("POST /api/submissions", () => {
  const validBody = {
    code: "print(sum([1,2,3]))",
    language: "python",
    problemId: "p1",
  };

  it("returns 401 unauthenticated", async () => {
    const res = await POST(asNextRequest(jsonRequest("http://x/api/submissions", validBody)));
    expect(res.status).toBe(401);
  });

  it("returns 404 when problem missing", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue(null);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/submissions", validBody)));
    expect(res.status).toBe(404);
  });

  it("records accepted when all tests pass", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue({
      id: "p1",
      testCases: [{ input: "", expected: "6" }],
    } as never);
    (executeCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [{ passed: true, input: "", expected: "6", actual: "6", runtime: 5 }],
      status: "accepted",
    });
    prismaMock.submission.create.mockResolvedValue({ id: "s1", status: "accepted" } as never);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/submissions", validBody)));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.submission.status).toBe("accepted");

    const args = prismaMock.submission.create.mock.calls[0]?.[0];
    expect(args?.data.status).toBe("accepted");
  });

  it("records wrong_answer when output mismatches", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue({
      id: "p1",
      testCases: [{ input: "", expected: "6" }],
    } as never);
    (executeCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [{ passed: false, input: "", expected: "6", actual: "5", runtime: 5 }],
      status: "wrong_answer",
    });
    prismaMock.submission.create.mockResolvedValue({ id: "s1", status: "wrong_answer" } as never);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/submissions", validBody)));
    expect(res.status).toBe(201);
    const args = prismaMock.submission.create.mock.calls[0]?.[0];
    expect(args?.data.status).toBe("wrong_answer");
  });

  it("records runtime_error when judge reports error", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue({
      id: "p1",
      testCases: [{ input: "", expected: "6" }],
    } as never);
    (executeCode as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [
        { passed: false, input: "", expected: "6", actual: "", error: "ZeroDivisionError" },
      ],
      status: "runtime_error",
    });
    prismaMock.submission.create.mockResolvedValue({ id: "s1", status: "runtime_error" } as never);

    const res = await POST(asNextRequest(jsonRequest("http://x/api/submissions", validBody)));
    expect(res.status).toBe(201);
    const args = prismaMock.submission.create.mock.calls[0]?.[0];
    expect(args?.data.status).toBe("runtime_error");
    expect(args?.data.error).toBe("ZeroDivisionError");
  });

  it("returns 503 when judge is unavailable", async () => {
    await loginAs({ userId: "u1" });
    prismaMock.problem.findUnique.mockResolvedValue({
      id: "p1",
      testCases: [{ input: "", expected: "6" }],
    } as never);
    (executeCode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new (JudgeUnavailableError as new (c: unknown) => Error)("ECONNREFUSED")
    );

    const res = await POST(asNextRequest(jsonRequest("http://x/api/submissions", validBody)));
    expect(res.status).toBe(503);
  });
});
