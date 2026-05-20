/**
 * Submission judging — async worker that calls the judge service so the
 * POST /api/submissions handler can return 202 immediately instead of
 * blocking a Node request thread for 5–30 seconds while a contest runs.
 *
 * Wired through the existing in-process WorkerQueue (lib/queue.ts) so
 * concurrency is bounded and retries follow the same backoff policy as
 * cache-bust / recompute-stats jobs.
 *
 * Per-replica only. Multi-replica coordination + fan-out for SSE arrives
 * with the Phase 3.2 service split (Redis Streams). The current SSE
 * handler at app/api/submissions/[id]/stream/route.ts polls Postgres,
 * so it already picks up the terminal state regardless of which replica
 * processed the job.
 */
import { queue } from "./queue";
import { prisma } from "./db";
import { executeCode, JudgeUnavailableError } from "@/services/judge";
import { logger } from "./logger";

const log = logger.with({ scope: "submission-jobs" });

/**
 * Trust the judge's top-level status for these verdicts — they carry
 * classification info (compile vs memory vs security) that we cannot
 * reliably re-derive from the per-test-case results alone.
 */
const TRUSTED_JUDGE_STATUSES = new Set([
  "compile_error",
  "memory_limit_exceeded",
  "time_limit_exceeded",
  "security_error",
]);

/** Defense-in-depth: detect compile errors from the error string even if
 *  the judge didn't classify properly at the top level. */
function isCompileError(errorMsg: string): boolean {
  if (!errorMsg) return false;
  const patterns = [
    /SyntaxError/i,
    /syntax error/i,
    /Unexpected identifier/i,
    /Unexpected token/i,
    /IndentationError/i,
    /compile error/i,
    /compilation failed/i,
  ];
  return patterns.some((p) => p.test(errorMsg));
}

interface JudgeSubmissionPayload {
  submissionId: string;
}

interface TerminalUpdate {
  status: string;
  runtime: number | null;
  error: string | null;
  output: string | null;
}

queue.on<JudgeSubmissionPayload>("judge-submission", async ({ submissionId }) => {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      code: true,
      language: true,
      problem: {
        select: {
          id: true,
          testCases: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!submission) {
    log.warn("submission disappeared before judging", { submissionId });
    return;
  }
  if (submission.status !== "queued") {
    // Idempotency: if the row already moved past `queued`, another worker
    // has it (or did) — abandon this run.
    log.info("submission already past queued, skipping", {
      submissionId,
      status: submission.status,
    });
    return;
  }

  // Atomically claim the row by transitioning queued → judging. If the
  // count-affected is 0, another worker beat us to it.
  const claim = await prisma.submission.updateMany({
    where: { id: submissionId, status: "queued" },
    data: { status: "judging" },
  });
  if (claim.count === 0) {
    log.info("lost race claiming submission", { submissionId });
    return;
  }

  const testCases = submission.problem.testCases.map((tc) => ({
    input: tc.input,
    expected: tc.expected,
  }));

  let update: TerminalUpdate;
  try {
    const { results, status: judgeStatus } = await executeCode({
      code: submission.code,
      language: submission.language,
      testCases,
    });

    const allPassed = results.every((r) => r.passed);
    const hasError = results.some((r) => r.error);
    const firstError = results.find((r) => r.error)?.error ?? "";

    // Trust the judge's top-level status for verdicts that carry
    // classification info we cannot reliably re-derive locally.
    let status: string;
    if (TRUSTED_JUDGE_STATUSES.has(judgeStatus)) {
      status = judgeStatus;
    } else if (hasError && !allPassed) {
      // Defense-in-depth: detect compile/memory errors from the string
      if (isCompileError(firstError)) {
        status = "compile_error";
      } else if (firstError.includes("MemoryError") || firstError.includes("out of memory")) {
        status = "memory_limit_exceeded";
      } else {
        status = "runtime_error";
      }
    } else if (allPassed) {
      status = "accepted";
    } else {
      status = "wrong_answer";
    }

    const avgRuntime =
      results.reduce((sum, r) => sum + (r.runtime ?? 0), 0) / Math.max(1, results.length);
    // bug-16: persist BOTH stdout (`actual`) and the error string on the
    // submission row. Without this, /api/submissions/{id} shows null/null
    // and the user can't self-diagnose. Accepted rows keep both null to
    // avoid bloating the table; non-accepted rows pin the first failing
    // test's stdout under `output`.
    const firstFail = results.find((r) => !r.passed);
    const errorMsg = results.find((r) => r.error)?.error ?? null;
    const outputStr = status === "accepted" ? null : firstFail?.actual?.trim() || null;
    update = {
      status,
      runtime: Math.round(avgRuntime),
      error: errorMsg,
      output: outputStr,
    };
  } catch (err) {
    if (err instanceof JudgeUnavailableError) {
      // The judge being down is not a failure of the user's code — leave
      // the submission as judging so a retry can pick it up. Throw so the
      // queue applies its retry/backoff policy.
      log.warn("judge unavailable, will retry", { submissionId });
      // Roll back so the next attempt can claim again.
      await prisma.submission.updateMany({
        where: { id: submissionId, status: "judging" },
        data: { status: "queued" },
      });
      throw err;
    }
    log.error("submission judging crashed", {
      submissionId,
      error: err instanceof Error ? err.message : String(err),
    });
    update = {
      status: "runtime_error",
      runtime: null,
      error: err instanceof Error ? err.message : "Internal judging error",
      output: null,
    };
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: update,
  });
  log.info("submission judged", { submissionId, status: update.status });
});

/**
 * Enqueue a previously-created submission row for asynchronous judging.
 * The row must already exist in the DB with status "queued".
 */
export function enqueueJudgeSubmission(submissionId: string): string {
  return queue.enqueue<JudgeSubmissionPayload>("judge-submission", {
    submissionId,
  });
}
