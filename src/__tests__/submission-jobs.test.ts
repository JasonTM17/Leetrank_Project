import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "./setup";

/**
 * submission-jobs.ts registers a "judge-submission" handler against the
 * shared in-process queue at module import. To exercise it without
 * spinning a real Postgres or judge, we:
 *
 *   1. Mock @/services/judge so executeCode is deterministic per test.
 *   2. Use the global prismaMock from setup.ts to script DB outcomes.
 *   3. Import the module ONCE per test (vi.resetModules + dynamic
 *      import) so each test gets a fresh queue + freshly-registered
 *      handler — otherwise stats would accumulate across tests and
 *      retried jobs from one test would leak into the next.
 *
 * Branches covered:
 *   - happy path: all test cases pass -> "accepted"
 *   - mixed pass: some fail -> "wrong_answer"
 *   - per-case error -> "runtime_error"
 *   - TLE marker bubbled to "time_limit_exceeded"
 *   - JudgeUnavailableError -> rollback to "queued" + retry
 *   - submission missing -> early return, no update
 *   - submission already past queued -> idempotent skip
 *   - lost claim race (updateMany count=0) -> early return
 *   - non-judge crash -> "runtime_error" with error message
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

type RunResult = {
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  runtime: number;
  error?: string;
};

interface JudgeModule {
  executeCode: ReturnType<typeof vi.fn>;
  JudgeUnavailableError: new (cause?: unknown) => Error;
}

interface SubJobs {
  enqueueJudgeSubmission: (id: string) => string;
}

interface QueueModule {
  queue: { drain: () => Promise<void>; stats: () => Record<string, number> };
}

async function loadModules() {
  // Reset registry so the queue module is a fresh instance per test
  // (handlers are registered at import time on the singleton queue).
  vi.resetModules();
  const judgeMod = (await import("@/services/judge")) as unknown as JudgeModule;
  const queueMod = (await import("@/lib/queue")) as unknown as QueueModule;
  const subMod = (await import("@/lib/submission-jobs")) as unknown as SubJobs;
  return { judgeMod, queueMod, subMod };
}

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

function fail(i: string, e: string, actual: string, runtime = 5): RunResult {
  return { passed: false, input: i, expected: e, actual, runtime };
}

// setup.ts's makeModel() factory doesn't include updateMany (the
// submission handler is the only place that uses it across the suite).
// Inject it onto prismaMock.submission once at file load so tests can
// script its outcomes; setup.ts's beforeEach mockReset will then keep
// it clean across tests.
type MockedFn = ReturnType<typeof vi.fn>;
interface SubmissionMock {
  findUnique: MockedFn;
  update: MockedFn;
  updateMany: MockedFn;
}
const submissionWithUpdateMany = prismaMock.submission as unknown as SubmissionMock;
if (!submissionWithUpdateMany.updateMany) {
  submissionWithUpdateMany.updateMany = vi.fn();
}

describe("submission-jobs handler", () => {
  beforeEach(() => {
    // setup.ts already resets every mock on prismaMock between tests,
    // including the updateMany we attached above (mockReset preserves
    // the spy, just clears the implementation + calls).
    submissionWithUpdateMany.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.submission.update.mockResolvedValue({});
  });

  it("marks the submission accepted when every test case passes", async () => {
    const { judgeMod, queueMod, subMod } = await loadModules();
    prismaMock.submission.findUnique.mockResolvedValue(makeRow());
    judgeMod.executeCode.mockResolvedValue([pass("1", "1", 8), pass("2", "2", 12)]);

    subMod.enqueueJudgeSubmission("sub-1");
    await queueMod.queue.drain();

    expect(judgeMod.executeCode).toHaveBeenCalledTimes(1);
    expect(prismaMock.submission.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "accepted", runtime: 10, error: null, output: null },
    });
  });

  it("marks wrong_answer when any test case fails without a runtime error", async () => {
    const { judgeMod, queueMod, subMod } = await loadModules();
    prismaMock.submission.findUnique.mockResolvedValue(makeRow());
    judgeMod.executeCode.mockResolvedValue([pass("1", "1"), fail("2", "2", "3")]);

    subMod.enqueueJudgeSubmission("sub-1");
    await queueMod.queue.drain();

    const call = prismaMock.submission.update.mock.calls[0][0] as {
      data: { status: string };
    };
    expect(call.data.status).toBe("wrong_answer");
  });

  it("marks runtime_error when a case carries an error and not all pass", async () => {
    const { judgeMod, queueMod, subMod } = await loadModules();
    prismaMock.submission.findUnique.mockResolvedValue(makeRow());
    judgeMod.executeCode.mockResolvedValue([
      pass("1", "1"),
      { passed: false, input: "2", expected: "2", actual: "", runtime: 0, error: "ZeroDivisionError" },
    ]);

    subMod.enqueueJudgeSubmission("sub-1");
    await queueMod.queue.drain();

    const call = prismaMock.submission.update.mock.calls[0][0] as {
      data: { status: string; error: string | null };
    };
    expect(call.data.status).toBe("runtime_error");
    expect(call.data.error).toBe("ZeroDivisionError");
  });

  it("marks time_limit_exceeded when any case reports the TLE marker", async () => {
    const { judgeMod, queueMod, subMod } = await loadModules();
    prismaMock.submission.findUnique.mockResolvedValue(makeRow());
    judgeMod.executeCode.mockResolvedValue([
      pass("1", "1"),
      { passed: false, input: "2", expected: "2", actual: "", runtime: 5000, error: "Time Limit Exceeded" },
    ]);

    subMod.enqueueJudgeSubmission("sub-1");
    await queueMod.queue.drain();

    const call = prismaMock.submission.update.mock.calls[0][0] as {
      data: { status: string };
    };
    expect(call.data.status).toBe("time_limit_exceeded");
  });

  it("rolls back to queued and retries when the judge is unavailable", async () => {
    const { judgeMod, queueMod, subMod } = await loadModules();
    prismaMock.submission.findUnique.mockResolvedValue(makeRow());
    // First attempt: judge down. Second attempt: judge recovers.
    judgeMod.executeCode
      .mockRejectedValueOnce(new judgeMod.JudgeUnavailableError("ECONNREFUSED"))
      .mockResolvedValue([pass("1", "1"), pass("2", "2")]);

    subMod.enqueueJudgeSubmission("sub-1");
    await queueMod.queue.drain();

    // The handler must roll back judging -> queued so the retry can re-claim.
    const rollback = prismaMock.submission.updateMany.mock.calls.find(
      ([arg]) => (arg as { data: { status: string } }).data.status === "queued"
    );
    expect(rollback).toBeTruthy();
    // After retry, the row should ultimately land in accepted.
    const lastUpdate = prismaMock.submission.update.mock.calls.at(-1)?.[0] as {
      data: { status: string };
    };
    expect(lastUpdate.data.status).toBe("accepted");
  });

  it("marks runtime_error when the judge throws a non-availability error", async () => {
    const { judgeMod, queueMod, subMod } = await loadModules();
    prismaMock.submission.findUnique.mockResolvedValue(makeRow());
    judgeMod.executeCode.mockRejectedValue(new Error("HTTP 500: schema mismatch"));

    subMod.enqueueJudgeSubmission("sub-1");
    await queueMod.queue.drain();

    const lastUpdate = prismaMock.submission.update.mock.calls.at(-1)?.[0] as {
      data: { status: string; error: string | null };
    };
    expect(lastUpdate.data.status).toBe("runtime_error");
    expect(lastUpdate.data.error).toContain("HTTP 500: schema mismatch");
  });

  it("returns early without DB writes when the submission no longer exists", async () => {
    const { judgeMod, queueMod, subMod } = await loadModules();
    prismaMock.submission.findUnique.mockResolvedValue(null);

    subMod.enqueueJudgeSubmission("sub-missing");
    await queueMod.queue.drain();

    expect(judgeMod.executeCode).not.toHaveBeenCalled();
    expect(prismaMock.submission.update).not.toHaveBeenCalled();
    expect(prismaMock.submission.updateMany).not.toHaveBeenCalled();
  });

  it("skips idempotently when the row has already moved past queued", async () => {
    const { judgeMod, queueMod, subMod } = await loadModules();
    prismaMock.submission.findUnique.mockResolvedValue(makeRow({ status: "judging" }));

    subMod.enqueueJudgeSubmission("sub-1");
    await queueMod.queue.drain();

    expect(judgeMod.executeCode).not.toHaveBeenCalled();
    expect(prismaMock.submission.update).not.toHaveBeenCalled();
  });

  it("aborts when another worker won the claim race (updateMany count=0)", async () => {
    const { judgeMod, queueMod, subMod } = await loadModules();
    prismaMock.submission.findUnique.mockResolvedValue(makeRow());
    prismaMock.submission.updateMany.mockResolvedValue({ count: 0 });

    subMod.enqueueJudgeSubmission("sub-1");
    await queueMod.queue.drain();

    expect(judgeMod.executeCode).not.toHaveBeenCalled();
    expect(prismaMock.submission.update).not.toHaveBeenCalled();
  });
});

describe("enqueueJudgeSubmission", () => {
  it("returns the queue job id with the j_ prefix", async () => {
    const { subMod } = await loadModules();
    const id = subMod.enqueueJudgeSubmission("sub-id-test");
    expect(id).toMatch(/^j_\d+$/);
  });
});
