import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { executeCode, JudgeUnavailableError } from "@/services/judge";
import { submitCodeSchema } from "@/lib/validations";
import { enqueueJudgeSubmission } from "@/lib/submission-jobs";
import { logger } from "@/lib/logger";
import { recordDailySolveIfApplicable } from "@/lib/daily-challenge";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const problemId = searchParams.get("problemId");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20)
    );

    const where: Record<string, unknown> = { userId: session.userId };
    if (problemId) where.problemId = problemId;

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        // Listing view: exclude heavy code/output/error TEXT columns to keep
        // the response small. Detail page (/api/submissions/[id]) hydrates
        // them on demand for the author. See ADR 0028.
        select: {
          id: true,
          userId: true,
          problemId: true,
          language: true,
          status: true,
          runtime: true,
          memory: true,
          createdAt: true,
          problem: { select: { id: true, title: true, slug: true, difficulty: true } },
        },
      }),
      prisma.submission.count({ where }),
    ]);

    return Response.json(
      { submissions, total, page, limit },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    logger.error("submissions GET failed", { scope: "api/submissions", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/submissions
 *
 * Default flow (production): create the row in `queued` state, enqueue an
 * async judge job, return 202 Accepted with `{ submission }`. Clients
 * subscribe to /api/submissions/:id/stream for the verdict.
 *
 * Legacy/test flow (`SUBMISSIONS_SYNC_FALLBACK=true`): runs the judge
 * synchronously and returns 201 with `{ submission, results }`. This
 * mode keeps the existing test suite green and is the only safe choice
 * when the queue runtime isn't booted (e.g. in cold-start serverless).
 */
/**
 * Sync fallback decision: production defaults to async (queued + worker).
 * Tests default to sync so the existing 200+ submission-shape assertions
 * keep working without per-test env juggling. Either default can be
 * overridden via SUBMISSIONS_SYNC_FALLBACK=true|false.
 */
function syncFallbackEnabled(): boolean {
  const explicit = process.env.SUBMISSIONS_SYNC_FALLBACK;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return process.env.NODE_ENV === "test";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = submitCodeSchema.safeParse(body);
    if (!parsed.success) {
      // Always include the field name (e.g. "code: code is required") so
      // external clients hitting the OpenAPI doc with the wrong key get a
      // diagnosable 400 instead of an opaque "Required".
      const issue = parsed.error.errors[0];
      const field = issue?.path?.join(".") ?? "input";
      const msg = issue?.message ?? "Invalid input";
      return Response.json(
        { error: msg.includes(field) ? msg : `${field}: ${msg}` },
        { status: 400 }
      );
    }

    const { problemId, language, code } = parsed.data;

    // Look up the problem before creating a submission row so we can return
    // 404 cleanly without a dangling Submission. Sync path also needs the
    // testCases here.
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: { testCases: { orderBy: { order: "asc" } } },
    });

    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    if (syncFallbackEnabled()) {
      const testCases = problem.testCases.map((tc) => ({
        input: tc.input,
        expected: tc.expected,
      }));
      const results = await executeCode({ code, language, testCases });

      const allPassed = results.every((r) => r.passed);
      const hasError = results.some((r) => r.error);
      let status: string;
      if (hasError && !allPassed) {
        status = "runtime_error";
      } else if (allPassed) {
        status = "accepted";
      } else {
        status = "wrong_answer";
      }

      const avgRuntime =
        results.reduce((sum, r) => sum + (r.runtime ?? 0), 0) /
        Math.max(1, results.length);
      const errorMsg = results.find((r) => r.error)?.error;
      // bug-16: pin the first failing test's stdout to `output` so the
      // verdict page can show what the user printed. Accepted rows skip
      // it to keep the column small.
      const firstFail = results.find((r) => !r.passed);
      const outputStr =
        status === "accepted"
          ? undefined
          : firstFail?.actual?.trim() || undefined;

      const submission = await prisma.submission.create({
        data: {
          userId: session.userId,
          problemId,
          language,
          code,
          status,
          runtime: Math.round(avgRuntime),
          error: errorMsg,
          output: outputStr,
        },
      });

      // Daily-challenge streak: only on AC. Failures here are non-fatal —
      // the submission is the source of truth and a missed streak update
      // will be re-attempted on the next AC of today's problem.
      if (status === "accepted") {
        try {
          await recordDailySolveIfApplicable(prisma, session.userId, problemId);
        } catch (err) {
          logger.warn("daily-challenge streak update failed", {
            scope: "api/submissions",
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return Response.json({ submission, results }, { status: 201 });
    }

    // Default: async path.
    const submission = await prisma.submission.create({
      data: {
        userId: session.userId,
        problemId,
        language,
        code,
        status: "queued",
      },
    });

    enqueueJudgeSubmission(submission.id);

    return Response.json(
      { submission },
      {
        status: 202,
        headers: { Location: `/api/submissions/${submission.id}` },
      }
    );
  } catch (err) {
    if (err instanceof JudgeUnavailableError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    logger.error("submissions POST failed", { scope: "api/submissions", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
