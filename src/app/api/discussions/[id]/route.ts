import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createCommentSchema, firstZodError } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// RULES §4: rate-limit comment writes. Comment-spam is the canonical
// forum-abuse pattern; 10/min per user is generous for normal use.
const COMMENT_LIMIT_MAX = 10;
const COMMENT_LIMIT_WINDOW_MS = 60_000;

// LeetCode-parity nesting cap. Past 3 the indentation collapses to a
// single column on mobile and queries get expensive — root + 2 reply tiers.
const MAX_REPLY_DEPTH = 3;

type CommentRow = {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: Date;
  user: { id: string; username: string; avatar: string | null };
};
type CommentNode = CommentRow & { replies: CommentNode[] };

// Build a tree from a flat list. Single pass + a map; O(n).
function buildCommentTree(rows: CommentRow[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const r of rows) byId.set(r.id, { ...r, replies: [] });
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentId && byId.has(r.parentId)) {
      byId.get(r.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// LeetCode-parity nesting cap. Past 3 the indentation collapses to a
// single column on mobile and queries get expensive — root + 2 reply tiers.
const MAX_REPLY_DEPTH = 3;

type CommentRow = {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: Date;
  user: { id: string; username: string; avatar: string | null };
};
type CommentNode = CommentRow & { replies: CommentNode[] };

// Build a tree from a flat list. Single pass + a map; O(n).
function buildCommentTree(rows: CommentRow[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];
  for (const r of rows) byId.set(r.id, { ...r, replies: [] });
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentId && byId.has(r.parentId)) {
      byId.get(r.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const discussion = await prisma.discussion.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            parentId: true,
            createdAt: true,
            user: { select: { id: true, username: true, avatar: true } },
          },
        },
      },
    });

    if (!discussion) {
      return Response.json({ error: "Discussion not found" }, { status: 404 });
    }

    // Aggregate vote score = sum(value). Cheap one-row reduce in Postgres.
    const voteAgg = await prisma.discussionVote.aggregate({
      where: { discussionId: id },
      _sum: { value: true },
    });
    const score = voteAgg._sum.value ?? 0;

    const { comments, ...rest } = discussion;
    const tree = buildCommentTree(comments as CommentRow[]);

    return Response.json({
      discussion: { ...rest, score, comments: tree },
    });
  } catch (err) {
    logger.error("discussions/[id] GET failed", { scope: "api/discussions/[id]", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const limit = rateLimit(
      `comment:${session.userId}`,
      COMMENT_LIMIT_MAX,
      COMMENT_LIMIT_WINDOW_MS
    );
    if (!limit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return Response.json(
        { error: "Too many comments. Slow down." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const discussion = await prisma.discussion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!discussion) {
      return Response.json({ error: "Discussion not found" }, { status: 404 });
    }

    // Reply path: validate parent belongs to this thread and we're not
    // burying the comment past MAX_REPLY_DEPTH (LeetCode-parity cap).
    if (parsed.data.parentId) {
      const parent = await prisma.discussionComment.findUnique({
        where: { id: parsed.data.parentId },
        select: { id: true, discussionId: true, parentId: true },
      });
      if (!parent || parent.discussionId !== id) {
        return Response.json({ error: "Parent comment not found" }, { status: 404 });
      }
      // Walk up the chain. Bounded by MAX_REPLY_DEPTH so worst-case is
      // a constant number of queries.
      let depth = 1; // depth of the parent (root = 1)
      let cursorParentId = parent.parentId;
      while (cursorParentId && depth < MAX_REPLY_DEPTH) {
        depth += 1;
        const next = await prisma.discussionComment.findUnique({
          where: { id: cursorParentId },
          select: { parentId: true },
        });
        if (!next) break;
        cursorParentId = next.parentId;
      }
      if (depth >= MAX_REPLY_DEPTH) {
        return Response.json(
          { error: `Replies are limited to ${MAX_REPLY_DEPTH} levels deep.` },
          { status: 400 }
        );
      }
    }

    const comment = await prisma.discussionComment.create({
      data: {
        discussionId: id,
        userId: session.userId,
        body: parsed.data.body,
        parentId: parsed.data.parentId ?? null,
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    return Response.json({ comment }, { status: 201 });
  } catch (err) {
    logger.error("discussions/[id] POST failed", { scope: "api/discussions/[id]", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const discussion = await prisma.discussion.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!discussion) {
      return Response.json({ error: "Discussion not found" }, { status: 404 });
    }
    if (discussion.userId !== session.userId && session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.discussion.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err) {
    logger.error("discussions/[id] DELETE failed", { scope: "api/discussions/[id]", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
