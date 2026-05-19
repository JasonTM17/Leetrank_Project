import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// GET /api/users/[username]/discussions — paginated list of a user's
// discussions. Public — anyone can browse what someone has posted, but the
// endpoint only includes the metadata needed for the profile listing.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const [discussions, total] = await Promise.all([
      prisma.discussion.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          problem: { select: { id: true, title: true, slug: true, difficulty: true } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.discussion.count({ where: { userId: user.id } }),
    ]);

    return Response.json({ discussions, total, page, limit });
  } catch (err) {
    logger.error("users/[username]/discussions failed", { scope: "api/users/[username]/discussions", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
