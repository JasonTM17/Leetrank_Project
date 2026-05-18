import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// DELETE /api/admin/users/[id] — wipe a user. Cascading deletes (Prisma
// schema marks every user-owned table with onDelete: Cascade) handle the
// rest: submissions, contest entries, discussions, comments, bookmarks all
// vanish in one transaction. Self-deletion is blocked so an admin can't
// orphan the system.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (id === session.userId) {
      return Response.json({ error: "Cannot delete your own account from the admin panel" }, { status: 409 });
    }

    try {
      await prisma.user.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Error && err.message.includes("Record to delete does not exist")) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      throw err;
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
