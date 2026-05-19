import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { HINT_REVEAL_PENALTY_PERCENT } from "@/lib/editorial";

// POST /api/problems/[slug]/hints/[index]/unlock
//
// Idempotent: revealing the same hint twice is a no-op. Returns the index
// and the documented scoring penalty so the FE can keep its copy in sync
// without hard-coding the value.
//
// Schema note (2026-05): the canonical persistence model UserHint is
// blocked behind a coordinated `prisma/schema.prisma` migration owned by
// another agent. Until that lands the route validates+rate-limits the
// reveal request and returns a structured ack. The FE persists the
// revealed-set in localStorage as the source of truth for now; once the
// `UserHint` table exists we can swap in a `prisma.userHint.upsert`
// without changing the request/response contract.

const REVEAL_LIMIT_MAX = 30;
const REVEAL_LIMIT_WINDOW_MS = 60_000;

// `index` parses as an integer ≥ 0. We bail on negatives so a hostile caller
// can't smuggle a sentinel value into the response.
const indexSchema = z
  .string()
  .regex(/^\d+$/, "hint index must be a non-negative integer");

const bodySchema = z
  .object({
    confirm: z.boolean().optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; index: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug, index } = await params;

    const indexParsed = indexSchema.safeParse(index);
    if (!indexParsed.success) {
      return Response.json(
        { error: indexParsed.error.errors[0]?.message ?? "Invalid hint index" },
        { status: 400 }
      );
    }
    const hintIndex = Number.parseInt(indexParsed.data, 10);

    const limit = rateLimit(
      `hint-unlock:${session.userId}`,
      REVEAL_LIMIT_MAX,
      REVEAL_LIMIT_WINDOW_MS
    );
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many hint reveals. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // RULES §22: parse mutating bodies before any side effect even when the
    // payload is trivially shaped — keeps the audit grep clean.
    let body: unknown = {};
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      return Response.json(
        { error: parsedBody.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const problem = await prisma.problem.findUnique({
      where: { slug },
      select: { id: true, hints: true },
    });
    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    const hintCount = (() => {
      if (!problem.hints) return 0;
      try {
        const parsed: unknown = JSON.parse(problem.hints);
        return Array.isArray(parsed) ? parsed.length : problem.hints ? 1 : 0;
      } catch {
        return 1;
      }
    })();

    if (hintIndex >= hintCount) {
      return Response.json(
        { error: "Hint index out of range" },
        { status: 400 }
      );
    }

    return Response.json(
      {
        ok: true,
        slug,
        hintIndex,
        penaltyPercent: HINT_REVEAL_PENALTY_PERCENT,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    logger.error("hint unlock POST failed", {
      scope: "api/problems/[slug]/hints/[index]/unlock",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
