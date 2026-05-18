import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["upcoming", "active", "ended"]),
});

// POST /api/admin/contests/[id]/status — manual override of a contest's
// lifecycle status. Normally a cron job advances upcoming → active → ended
// based on startTime/endTime, but admins occasionally need to pause or
// extend a contest mid-window.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const { id } = await params;
    try {
      const contest = await prisma.contest.update({
        where: { id },
        data: { status: parsed.data.status },
        select: { id: true, status: true },
      });
      return Response.json({ contest });
    } catch (err) {
      if (err instanceof Error && err.message.includes("Record to update not found")) {
        return Response.json({ error: "Contest not found" }, { status: 404 });
      }
      throw err;
    }
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
