import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// GET /api/users/[username]/bookmarks — public bookmark list. Privacy posture:
// users curate bookmarks publicly so others can see what they're working on,
// matching the "see-what-they're-solving" feel of the rest of the profile.
// We ship metadata only — no notes/timestamps that could leak intent.
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
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        problem: { select: { id: true, title: true, slug: true, difficulty: true } },
      },
    });

    return Response.json({ bookmarks: bookmarks.map((b) => b.problem) });
  } catch (err) {
    logger.error("users/[username]/bookmarks failed", { scope: "api/users/[username]/bookmarks", err: err instanceof Error ? err.message : String(err) });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
