import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { z } from "zod";

const roleSchema = z.object({
  role: z.enum(["user", "admin"]),
});

// PATCH /api/admin/users/[id]/role — promote/demote a user. Self-demotion
// is blocked so an admin can't accidentally lock everyone out by removing
// their own privileges last.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;
    const session = gate.session;

    const { id } = await params;
    if (id === session.userId) {
      return Response.json(
        { error: "Cannot change your own role" },
        { status: 409 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = roleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role: parsed.data.role },
      select: { id: true, username: true, role: true },
    });

    return Response.json({ user });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Record to update not found")) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
