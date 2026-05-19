import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { z } from "zod";

const toggleSchema = z.object({
  problemId: z.string().min(1, "Problem ID is required."),
});

// RULES §4: rate-limit toggle writes. 30/min per user is generous; the
// FE only fires this on a button click, not in tight loops.
const TOGGLE_LIMIT_MAX = 30;
const TOGGLE_LIMIT_WINDOW_MS = 60_000;

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const problemId = searchParams.get("problemId");

    if (problemId) {
      // Single-problem check used by the bookmark button on /problems/[slug].
      const bm = await prisma.bookmark.findUnique({
        where: { userId_problemId: { userId: session.userId, problemId } },
        select: { id: true },
      });
      return Response.json(
        { bookmarked: !!bm },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    // Otherwise: full list for /dashboard.
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      include: {
        problem: {
          select: { id: true, title: true, slug: true, difficulty: true },
        },
      },
    });

    return Response.json(
      { bookmarks },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    logger.error("bookmarks GET failed", { scope: "api/bookmarks", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST toggles: creates if missing, deletes if present, returns the new state.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`bookmark:${session.userId}`, TOGGLE_LIMIT_MAX, TOGGLE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many bookmark toggles. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { problemId } = parsed.data;
    const existing = await prisma.bookmark.findUnique({
      where: { userId_problemId: { userId: session.userId, problemId } },
      select: { id: true },
    });

    if (existing) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
      return Response.json({ bookmarked: false });
    }

    // Verify the problem actually exists before creating the join row —
    // bookmarks pointing at deleted problems are noise.
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { id: true },
    });
    if (!problem) {
      return Response.json({ error: "Problem not found" }, { status: 404 });
    }

    await prisma.bookmark.create({
      data: { userId: session.userId, problemId },
    });
    return Response.json({ bookmarked: true });
  } catch (err) {
    logger.error("bookmarks POST failed", { scope: "api/bookmarks", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE removes a bookmark by ?problemId=… — the RESTful counterpart to
// POST. POST stays as a back-compat toggle for the existing UI button; new
// clients should prefer DELETE for explicit removal. Idempotent: deleting a
// bookmark that doesn't exist is treated as success.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`bookmark:${session.userId}`, TOGGLE_LIMIT_MAX, TOGGLE_LIMIT_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many bookmark toggles. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { searchParams } = request.nextUrl;
    const problemId = searchParams.get("problemId");
    if (!problemId) {
      return Response.json({ error: "Problem ID is required." }, { status: 400 });
    }

    const existing = await prisma.bookmark.findUnique({
      where: { userId_problemId: { userId: session.userId, problemId } },
      select: { id: true },
    });
    if (!existing) {
      // Idempotent: nothing to delete is still a successful end-state.
      return Response.json({ bookmarked: false });
    }

    await prisma.bookmark.delete({ where: { id: existing.id } });
    return Response.json({ bookmarked: false });
  } catch (err) {
    logger.error("bookmarks DELETE failed", { scope: "api/bookmarks", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
