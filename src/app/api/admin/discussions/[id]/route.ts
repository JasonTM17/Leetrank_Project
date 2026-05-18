import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

// DELETE /api/admin/discussions/[id] — admin-only force delete that doesn't
// require the discussion to be authored by the caller. Distinct from the
// regular DELETE on /api/discussions/[id] which is author-or-admin — this
// one is purely the admin moderation path so we can audit it separately.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;

    const { id } = await params;
    try {
      await prisma.discussion.delete({ where: { id } });
    } catch (err) {
      if (err instanceof Error && err.message.includes("Record to delete does not exist")) {
        return Response.json({ error: "Discussion not found" }, { status: 404 });
      }
      throw err;
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
