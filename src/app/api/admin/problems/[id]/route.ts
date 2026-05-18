import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { updateProblemSchema, firstZodError } from "@/lib/validations";
import { invalidateProblemsCache } from "@/lib/cache-invalidate";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;

    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = updateProblemSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: firstZodError(parsed.error) }, { status: 400 });
    }

    const problem = await prisma.problem.update({
      where: { id },
      data: parsed.data,
    });

    invalidateProblemsCache();

    return Response.json({ problem });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;

    const { id } = await params;

    await prisma.problem.delete({ where: { id } });

    invalidateProblemsCache();

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
