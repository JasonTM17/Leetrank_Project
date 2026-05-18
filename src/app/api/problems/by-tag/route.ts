import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/problems/by-tag — alternate listing path that takes a tag slug
// and returns matched problems. Different from /api/tags/[slug] in that
// it doesn't include the tag metadata — just the problem set, which is
// all the homepage tag carousel needs.
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const tagSlug = searchParams.get("tag");
    if (!tagSlug) {
      return Response.json({ error: "tag query param is required" }, { status: 400 });
    }

    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const problems = await prisma.problem.findMany({
      where: { tags: { some: { tag: { slug: tagSlug } } } },
      select: { id: true, title: true, slug: true, difficulty: true },
      orderBy: { order: "asc" },
      take: limit,
    });

    return Response.json({ problems });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
