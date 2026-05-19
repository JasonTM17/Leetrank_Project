// /api/solutions/[id]
//
// GET    — fetch a single shared solution with author + current user vote
// PATCH  — author-only update of title/writeup
// DELETE — author or admin removes the solution
//
// Feature flag: SOLUTIONS_ENABLED.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  updateSharedSolutionSchema,
  firstZodError,
} from "@/lib/validations";
import { logger } from "@/lib/logger";
import {
  deleteSolution,
  findSolutionById,
  findSolutionRowById,
  updateSolution,
} from "@/lib/solutions";

function flagged(): boolean {
  return process.env.SOLUTIONS_ENABLED === "true";
}

function notFound() {
  return Response.json({ error: "Not found" }, { status: 404 });
}

type RawClient = {
  $queryRawUnsafe: (sql: string, ...args: unknown[]) => Promise<unknown[]>;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!flagged()) return notFound();
  try {
    const { id } = await params;
    const solution = await findSolutionById(id);
    if (!solution) {
      return Response.json({ error: "Solution not found" }, { status: 404 });
    }

    // Surface the active user's vote so the UI can render the toggle state
    // without a second round-trip. Anonymous viewers get userVote = 0.
    const session = await getSession();
    let userVote = 0;
    if (session) {
      const rows = (await (prisma as unknown as RawClient).$queryRawUnsafe(
        `SELECT value FROM "SharedSolutionVote"
         WHERE "userId" = $1 AND "solutionId" = $2 LIMIT 1`,
        session.userId,
        id
      )) as Array<{ value: number }>;
      userVote = rows[0]?.value ?? 0;
    }

    return Response.json({ solution: { ...solution, userVote } });
  } catch (err) {
    logger.error("solutions/[id] GET failed", {
      scope: "api/solutions/[id]",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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
    const existing = await findSolutionRowById(id);
    if (!existing) {
      return Response.json({ error: "Solution not found" }, { status: 404 });
    }
    // PATCH is author-only; admins use DELETE for cleanup. This avoids
    // accidental admin-edits that rewrite history under the author's name.
    if (existing.userId !== session.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateSharedSolutionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const updated = await updateSolution(id, parsed.data);
    return Response.json({ solution: updated });
  } catch (err) {
    logger.error("solutions/[id] PATCH failed", {
      scope: "api/solutions/[id]",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!flagged()) return notFound();
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await findSolutionRowById(id);
    if (!existing) {
      return Response.json({ error: "Solution not found" }, { status: 404 });
    }
    if (existing.userId !== session.userId && session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteSolution(id);
    return Response.json({ success: true });
  } catch (err) {
    logger.error("solutions/[id] DELETE failed", {
      scope: "api/solutions/[id]",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
