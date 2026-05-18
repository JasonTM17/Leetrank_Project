import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// DELETE /api/discussions/[id]/comments/[commentId] — remove a comment.
// Author or admin only. Validates that the commentId actually belongs to
// the discussionId in the URL — prevents a malicious caller from deleting
// a comment from another thread by guessing the id.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, commentId } = await params;
    const comment = await prisma.discussionComment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true, discussionId: true },
    });
    if (!comment) {
      return Response.json({ error: "Comment not found" }, { status: 404 });
    }
    if (comment.discussionId !== id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (comment.userId !== session.userId && session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.discussionComment.delete({ where: { id: comment.id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
