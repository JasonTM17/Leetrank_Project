import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const editSchema = z.object({
  body: z.string().min(1, "Body is required").max(10_000),
});

// PATCH /api/discussions/[id] — edit the title and/or body of a discussion.
// Author only — admins can delete but not edit (impersonating someone else's
// authored content is a different blast radius). Title isn't editable to
// keep the URL stable.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.discussion.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing) {
      return Response.json({ error: "Discussion not found" }, { status: 404 });
    }
    if (existing.userId !== session.userId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const updated = await prisma.discussion.update({
      where: { id: existing.id },
      data: { body: parsed.data.body },
      select: { id: true, body: true, updatedAt: true },
    });

    return Response.json({ discussion: updated });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
