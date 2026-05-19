// /api/solutions/[id]/vote
//
// POST — toggle the user's +1/-1 vote on a shared solution.
//   * No existing vote: create with the requested value.
//   * Same direction:  delete the row (untoggle).
//   * Opposite:        update the row to the new value.
//
// `voteCount` on SharedSolution mirrors the aggregate so list pages can
// sort by "top" without a join. We keep both in sync inside a transaction-
// safe sequence: the SUM(value) recompute runs after the vote write.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { voteSchema, firstZodError } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { findSolutionRowById } from "@/lib/solutions";

function flagged(): boolean {
  return process.env.SOLUTIONS_ENABLED === "true";
}

function notFound() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

type RawClient = {
  $queryRawUnsafe: (sql: string, ...args: unknown[]) => Promise<unknown[]>;
  $executeRawUnsafe: (sql: string, ...args: unknown[]) => Promise<number>;
};

async function recomputeVoteCount(solutionId: string): Promise<number> {
  const rows = (await (prisma as unknown as RawClient).$queryRawUnsafe(
    `SELECT COALESCE(SUM(value), 0)::int AS sum
     FROM "SharedSolutionVote" WHERE "solutionId" = $1`,
    solutionId
  )) as Array<{ sum: number }>;
  const sum = Number(rows[0]?.sum ?? 0);
  await (prisma as unknown as RawClient).$executeRawUnsafe(
    `UPDATE "SharedSolution" SET "voteCount" = $1 WHERE id = $2`,
    sum,
    solutionId
  );
  return sum;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!flagged()) return notFound();
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const solution = await findSolutionRowById(id);
    if (!solution) {
      return Response.json({ error: "Solution not found" }, { status: 404 });
    }

    const raw = prisma as unknown as RawClient;
    const existingRows = (await raw.$queryRawUnsafe(
      `SELECT value FROM "SharedSolutionVote"
       WHERE "userId" = $1 AND "solutionId" = $2 LIMIT 1`,
      session.userId,
      id
    )) as Array<{ value: number }>;
    const existing = existingRows[0];

    let userVote: 1 | -1 | 0 = parsed.data.value;

    if (!existing) {
      await raw.$executeRawUnsafe(
        `INSERT INTO "SharedSolutionVote" ("userId", "solutionId", value)
         VALUES ($1, $2, $3)`,
        session.userId,
        id,
        parsed.data.value
      );
    } else if (existing.value === parsed.data.value) {
      // Untoggle — same direction means clear the vote.
      await raw.$executeRawUnsafe(
        `DELETE FROM "SharedSolutionVote"
         WHERE "userId" = $1 AND "solutionId" = $2`,
        session.userId,
        id
      );
      userVote = 0;
    } else {
      await raw.$executeRawUnsafe(
        `UPDATE "SharedSolutionVote" SET value = $1
         WHERE "userId" = $2 AND "solutionId" = $3`,
        parsed.data.value,
        session.userId,
        id
      );
    }

    const score = await recomputeVoteCount(id);
    return Response.json({ score, userVote });
  } catch (err) {
    logger.error("solutions/[id]/vote POST failed", {
      scope: "api/solutions/[id]/vote",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
