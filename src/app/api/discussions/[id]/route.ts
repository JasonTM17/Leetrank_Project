import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createCommentSchema, firstZodError } from "@/lib/validations";

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
