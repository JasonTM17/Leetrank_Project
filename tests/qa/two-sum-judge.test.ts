/**
 * Regression test for QA bug-1 — "textbook-correct Two Sum returns
 * wrong_answer". The judge runtime + nsjail aren't reachable from unit
 * tests, so we mock @/services/judge to assert two contracts the bug
 * exposed:
 *
 *   1. POST /api/submissions accepts a canonical two-sum solution and the
 *      route routes the seeded test cases to the runner *as stored*. The
 *      seed change ships a stdin harness so the runner sees the same data
 *      the canonical answer expects.
 *
 *   2. The terminal verdict carries both `output` and `error` (bug-16):
 *      the row hydrated by the worker and the sync fallback path both
 *      surface stdout from the first failing test.
 *
 * Both rules previously failed silently; this file pins them so the next
 * regression shows up as a unit failure instead of an UAT scream.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../../src/__tests__/setup";
import {
  jsonRequest,
  asNextRequest,
  loginAs,
} from "../../src/__tests__/helpers";

vi.mock("@/services/judge", () => {
  class JudgeUnavailableError extends Error {
    constructor(cause: unknown) {
      super(`Judge unavailable: ${cause}`);
      this.name = "JudgeUnavailableError";
    }
  }
  return { executeCode: vi.fn(), JudgeUnavailableError };
});

import { POST } from "@/app/api/submissions/route";
import { executeCode } from "@/services/judge";

const TWO_SUM_TESTCASES = [
  { input: "[2,7,11,15]\n9", expected: "[0,1]" },
  { input: "[3,2,4]\n6", expected: "[1,2]" },
  { input: "[3,3]\n6", expected: "[0,1]" },
];

const CANONICAL_TWO_SUM = `def twoSum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return []
`;

beforeEach(() => {
  // Sync-fallback path so we can assert the row created in one POST.
  process.env.SUBMISSIONS_SYNC_FALLBACK = "true";
});

describe("QA bug-1 / bug-16: Two Sum verdict pipeline", () => {
  it("accepts the canonical Two Sum solution against seeded testcases", async () => {
    await loginAs({ userId: "u-twosum" });

    prismaMock.problem.findUnique.mockResolvedValue({
      id: "p-two-sum",
      testCases: TWO_SUM_TESTCASES.map((tc, i) => ({
        ...tc,
        order: i + 1,
        isHidden: false,
      })),
    } as never);

    // Simulate the judge running the canonical solution against the
    // seeded inputs — every test passes with `actual` matching `expected`.
    (executeCode as ReturnType<typeof vi.fn>).mockResolvedValue(
      TWO_SUM_TESTCASES.map((tc) => ({
        passed: true,
        input: tc.input,
        expected: tc.expected,
        actual: tc.expected,
        runtime: 12,
        error: undefined,
      }))
    );

    prismaMock.submission.create.mockImplementation(
      (async ({ data }: { data: Record<string, unknown> }) => ({
        id: "sub-ok",
        ...data,
      })) as never
    );

    const res = await POST(
      asNextRequest(
        jsonRequest("http://x/api/submissions", {
          code: CANONICAL_TWO_SUM,
          language: "python",
          problemId: "p-two-sum",
        })
      )
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.submission.status).toBe("accepted");

    // The runner MUST see the seeded testcases verbatim, not a remapped
    // shape — this was the silent failure mode for bug-1.
    const args = (executeCode as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(args.testCases).toEqual(TWO_SUM_TESTCASES);
    expect(args.language).toBe("python");
  });

  it("on wrong_answer, persists both stdout (output) and any error string", async () => {
    await loginAs({ userId: "u-wa" });

    prismaMock.problem.findUnique.mockResolvedValue({
      id: "p-two-sum",
      testCases: TWO_SUM_TESTCASES.map((tc, i) => ({
        ...tc,
        order: i + 1,
        isHidden: false,
      })),
    } as never);

    // First test fails with stdout "[1,0]" instead of "[0,1]" — the row
    // MUST capture that stdout under `output` (bug-16 regression).
    (executeCode as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        passed: false,
        input: TWO_SUM_TESTCASES[0].input,
        expected: TWO_SUM_TESTCASES[0].expected,
        actual: "[1,0]",
        runtime: 8,
      },
      {
        passed: true,
        input: TWO_SUM_TESTCASES[1].input,
        expected: TWO_SUM_TESTCASES[1].expected,
        actual: TWO_SUM_TESTCASES[1].expected,
        runtime: 9,
      },
    ]);

    prismaMock.submission.create.mockImplementation(
      (async ({ data }: { data: Record<string, unknown> }) => ({
        id: "sub-wa",
        ...data,
      })) as never
    );

    const res = await POST(
      asNextRequest(
        jsonRequest("http://x/api/submissions", {
          code: "buggy",
          language: "python",
          problemId: "p-two-sum",
        })
      )
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.submission.status).toBe("wrong_answer");
    // bug-16: output MUST surface the failing test's stdout.
    expect(body.submission.output).toBe("[1,0]");
  });
});

void prismaMock;
