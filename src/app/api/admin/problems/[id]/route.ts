import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, slug, description, difficulty, hints, editorial, constraints, starterCode, order } = body;

    const problem = await prisma.problem.update({
      where: { id },
      data: { title, slug, description, difficulty, hints, editorial, constraints, starterCode, order },
    });

    return Response.json({ problem });
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
    if (!session || session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.problem.delete({ where: { id } });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
