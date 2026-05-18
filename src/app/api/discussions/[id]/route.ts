import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createCommentSchema, firstZodError } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

// RULES §4: rate-limit comment writes. Comment-spam is the canonical
// forum-abuse pattern; 10/min per user is generous for normal use.
const COMMENT_LIMIT_MAX = 10;
const COMMENT_LIMIT_WINDOW_MS = 60_000;

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
          include: { user: { select: { id: true, username: true, avatar: true } } },
        },
      },
    });

    if (!discussion) {
      return Response.json({ error: "Discussion not found" }, { status: 404 });
    }

    return Response.json({ discussion });
  } catch {
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

    const comment = await prisma.discussionComment.create({
      data: {
        discussionId: id,
        userId: session.userId,
        body: parsed.data.body,
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    return Response.json({ comment }, { status: 201 });
  } catch {
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
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
