import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "./setup";

/**
 * submission-jobs.ts registers a "judge-submission" handler against the
 * shared in-process queue at import time. Re-importing the module via
 * vi.resetModules causes leftover retry timers from earlier tests to
 * cross-pollute later tests, so this file imports everything once and
 * relies on per-test mock resets + queue drain instead.
 *
 * Branches covered:
 *   - happy path: every case passes -> "accepted"
 *   - mixed pass: some fail -> "wrong_answer"
 *   - per-case error -> "runtime_error" with carried error message
 *   - TLE marker bubbled to "time_limit_exceeded"
 *   - JudgeUnavailableError -> rollback to "queued" + retry to success
 *   - non-availability crash -> "runtime_error" with error.message
 *   - submission missing -> early return, no DB writes
 *   - already past queued -> idempotent skip
 *   - lost claim race (count=0) -> abort, no executeCode
 *   - enqueueJudgeSubmission returns the queue job id
 */

vi.mock("@/services/judge", () => {
  class JudgeUnavailableError extends Error {
    constructor(cause?: unknown) {
      super(`Judge unavailable: ${String(cause)}`);
      this.name = "JudgeUnavailableError";
    }
  }
  return {
    JudgeUnavailableError,
    executeCode: vi.fn(),
  };
});

import { executeCode, JudgeUnavailableError } from "@/services/judge";
import { queue } from "@/lib/queue";
import { enqueueJudgeSubmission } from "@/lib/submission-jobs";

type RunResult = {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  runtime: number;
  error?: string;
};

// Inject updateMany on the shared submission mock — setup.ts's makeModel
// factory ships the methods most routes use, but the judging handler is
// the only place that calls updateMany, so we attach it here once and
// rely on setup.ts's mockReset to clear calls between tests.
type MockedFn = ReturnType<typeof vi.fn>;
interface SubmissionMock {
  findUnique: MockedFn;
  update: MockedFn;
  updateMany: MockedFn;
}
const submission = prismaMock.submission as unknown as SubmissionMock;
if (!submission.updateMany) submission.updateMany = vi.fn();

const executeMock = executeCode as unknown as MockedFn;

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sub-1",
    status: "queued",
    code: "print(1)",
    language: "python",
    problem: {
      id: "p-1",
      testCases: [
        { input: "1", expected: "1", order: 0 },
        { input: "2", expected: "2", order: 1 },
      ],
    },
    ...overrides,
  };
}

function pass(i: string, e: string, runtime = 5): RunResult {
  return { passed: true, input: i, expected: e, actual: e, runtime };
}

function failCase(i: string, e: string, actual: string, runtime = 5): RunResult {
  return { passed: false, input: i, expected: e, actual, runtime };
}

beforeEach(async () => {
  // Drain anything still in flight from a prior test (e.g. a retry
  // timer that hadn't fired yet) before resetting state.
  await queue.drain();
  executeMock.mockReset();
  // setup.ts's beforeEach also resets prismaMock methods; we set the
  // baseline outcomes our handler needs.
  submission.updateMany.mockResolvedValue({ count: 1 });
  submission.update.mockResolvedValue({});
});

describe("submission-jobs handler", () => {
  it("marks the submission accepted when every test case passes", async () => {
    submission.findUnique.mockResolvedValue(makeRow());
    executeMock.mockResolvedValue([pass("1", "1", 8), pass("2", "2", 12)]);

    enqueueJudgeSubmission("sub-1");
    await queue.drain();

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(submission.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "accepted", runtime: 10, error: null, output: null },
    });
  });

  it("marks wrong_answer when any case fails without a runtime error", async () => {
    submission.findUnique.mockResolvedValue(makeRow());
    executeMock.mockResolvedValue([pass("1", "1"), failCase("2", "2", "3")]);

    enqueueJudgeSubmission("sub-1");
    await queue.drain();

    const data = (submission.update.mock.calls.at(-1)?.[0] as { data: { status: string } }).data;
    expect(data.status).toBe("wrong_answer");
  });

  it("marks runtime_error when a case carries an error and not all pass", async () => {
    submission.findUnique.mockResolvedValue(makeRow());
    executeMock.mockResolvedValue([
      pass("1", "1"),
      { passed: false, input: "2", expected: "2", actual: "", runtime: 0, error: "ZeroDivisionError" },
    ]);

    enqueueJudgeSubmission("sub-1");
    await queue.drain();

    const data = (submission.update.mock.calls.at(-1)?.[0] as { data: { status: string; error: string | null } }).data;
    expect(data.status).toBe("runtime_error");
    expect(data.error).toBe("ZeroDivisionError");
  });

  it("marks time_limit_exceeded when any case reports the TLE marker", async () => {
    submission.findUnique.mockResolvedValue(makeRow());
    executeMock.mockResolvedValue([
      pass("1", "1"),
      { passed: false, input: "2", expected: "2", actual: "", runtime: 5000, error: "Time Limit Exceeded" },
    ]);

    enqueueJudgeSubmission("sub-1");
    await queue.drain();

    const data = (submission.update.mock.calls.at(-1)?.[0] as { data: { status: string } }).data;
    expect(data.status).toBe("time_limit_exceeded");
  });

  it("rolls back to queued and retries when the judge is unavailable", async () => {
    submission.findUnique.mockResolvedValue(makeRow());
    executeMock
      .mockRejectedValueOnce(new JudgeUnavailableError("ECONNREFUSED"))
      .mockResolvedValue([pass("1", "1"), pass("2", "2")]);

    enqueueJudgeSubmission("sub-1");
    await queue.drain();

    // The handler must roll judging -> queued so the retry can re-claim.
    const rollback = submission.updateMany.mock.calls.find(
      ([arg]) => (arg as { data: { status: string } }).data.status === "queued"
    );
    expect(rollback).toBeTruthy();

    // After retry, the row ultimately lands in accepted.
    const last = (submission.update.mock.calls.at(-1)?.[0] as { data: { status: string } }).data;
    expect(last.status).toBe("accepted");
  });

  it("marks runtime_error when the judge throws a non-availability error", async () => {
    submission.findUnique.mockResolvedValue(makeRow());
    executeMock.mockRejectedValue(new Error("HTTP 500: schema mismatch"));

    enqueueJudgeSubmission("sub-1");
    await queue.drain();

    const data = (submission.update.mock.calls.at(-1)?.[0] as { data: { status: string; error: string | null } }).data;
    expect(data.status).toBe("runtime_error");
    expect(data.error).toContain("HTTP 500: schema mismatch");
  });

  it("returns early without DB writes when the submission no longer exists", async () => {
    submission.findUnique.mockResolvedValue(null);

    enqueueJudgeSubmission("sub-missing");
    await queue.drain();

    expect(executeMock).not.toHaveBeenCalled();
    expect(submission.update).not.toHaveBeenCalled();
    expect(submission.updateMany).not.toHaveBeenCalled();
  });

  it("skips idempotently when the row has already moved past queued", async () => {
    submission.findUnique.mockResolvedValue(makeRow({ status: "judging" }));

    enqueueJudgeSubmission("sub-1");
    await queue.drain();

    expect(executeMock).not.toHaveBeenCalled();
    expect(submission.update).not.toHaveBeenCalled();
  });

  it("aborts when another worker won the claim race (updateMany count=0)", async () => {
    submission.findUnique.mockResolvedValue(makeRow());
    submission.updateMany.mockResolvedValue({ count: 0 });

    enqueueJudgeSubmission("sub-1");
    await queue.drain();

    expect(executeMock).not.toHaveBeenCalled();
    expect(submission.update).not.toHaveBeenCalled();
  });

  it("falls back to runtime_error with a generic message for non-Error throwables", async () => {
    submission.findUnique.mockResolvedValue(makeRow());
    // Throw something that isn't an Error instance — handler should
    // still produce a terminal update without crashing the worker.
    executeMock.mockRejectedValue("plain-string-rejection");

    enqueueJudgeSubmission("sub-1");
    await queue.drain();

    const data = (submission.update.mock.calls.at(-1)?.[0] as { data: { status: string; error: string | null } }).data;
    expect(data.status).toBe("runtime_error");
    expect(data.error).toBe("Internal judging error");
  });
});

describe("enqueueJudgeSubmission", () => {
  it("returns the queue job id with the j_ prefix", () => {
    const id = enqueueJudgeSubmission("sub-id-only");
    expect(id).toMatch(/^j_\d+$/);
  });
});
