// /api/problems/[slug]/solutions
//
// GET  — list shared solutions for the problem with sort=top|new pagination.
// POST — author posts a writeup tied to one of their accepted submissions.
//        Requires auth; rate-limited to 3/hour to prevent spam-floor.
//
// Feature flag: SOLUTIONS_ENABLED. When unset/falsy the endpoints respond
// 404 so the surface stays dark in environments where the migration has
// not been applied yet.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  createSharedSolutionSchema,
  firstZodError,
} from "@/lib/validations";
import { rateLimitAsync } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { createSolution, listSolutions } from "@/lib/solutions";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Anti-spam: 3 solutions per hour per user. Solutions are heavyweight
// posts (markdown writeup ≥ 100 chars) so even spammers slow down at
// this rate; the cap is per-account on top of any per-IP limiter that
// the platform layer adds.
const POST_LIMIT_MAX = 3;
const POST_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function flagged(): boolean {
  return process.env.SOLUTIONS_ENABLED === "true";
}

function notFound() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

function parseSort(raw: string | null): "top" | "new" {
  return raw === "new" ? "new" : "top";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!flagged()) return notFound();
  try {
    const { slug } = await params;
    const problem = await prisma.problem.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const sort = parseSort(searchParams.get("sort"));
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const { items, total } = await listSolutions({
      problemId: problem.id,
      sort,
      page,
      limit,
    });

    return Response.json({ solutions: items, total, page, limit, sort });
  } catch (err) {
    logger.error("solutions GET failed", {
      scope: "api/problems/[slug]/solutions",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!flagged()) return notFound();
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await rateLimitAsync(
      `solution-create:${session.userId}`,
      POST_LIMIT_MAX,
      POST_LIMIT_WINDOW_MS
    );
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many solutions posted. Try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { slug } = await params;
    const problem = await prisma.problem.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createSharedSolutionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    // Author must own the submission AND it must be accepted on this problem.
    // We check ownership + status + problem membership in one read so the
    // 403 vs 404 vs 409 branches can be distinguished cleanly.
    const submission = await prisma.submission.findUnique({
      where: { id: parsed.data.submissionId },
      select: {
        id: true,
        userId: true,
        problemId: true,
        status: true,
        language: true,
      },
    });
    if (!submission || submission.problemId !== problem.id) {
      return Response.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.userId !== session.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (submission.status !== "accepted") {
      return Response.json(
        { error: "Only accepted submissions can be shared as solutions." },
        { status: 400 }
      );
    }

    try {
      const created = await createSolution({
        problemId: problem.id,
        userId: session.userId,
        submissionId: submission.id,
        title: parsed.data.title,
        writeup: parsed.data.writeup,
        language: submission.language,
      });
      return Response.json({ solution: created }, { status: 201 });
    } catch (err) {
      // Postgres UNIQUE violation surfaces as code 23505. The DAL layer
      // re-raises the error verbatim; we map it to 409 here so the client
      // can show "you've already shared this submission".
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("23505") || /unique constraint/i.test(msg)) {
        return Response.json(
          { error: "This submission has already been shared." },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err) {
    logger.error("solutions POST failed", {
      scope: "api/problems/[slug]/solutions",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
