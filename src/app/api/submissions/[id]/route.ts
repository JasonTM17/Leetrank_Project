import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        problem: {
          select: { id: true, title: true, slug: true, difficulty: true },
        },
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    if (!submission) {
      return Response.json({ error: "Submission not found" }, { status: 404 });
    }

    // Submissions are private to their author and admins. The full code is
    // intentionally NOT exposed to other users — that would let them copy
    // accepted solutions before solving the problem themselves.
    if (submission.userId !== session.userId && session.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    return Response.json(
      { submission },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    logger.error("submissions/[id] GET failed", { scope: "api/submissions/[id]", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
