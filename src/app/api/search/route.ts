import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Simple search endpoint that fans out across problems, contests, and tags.
// Returns three result sets in one round trip so the search UI can render
// grouped suggestions without three independent fetches.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    if (query.length < 2) {
      return Response.json({ query, problems: [], contests: [], tags: [] });
    }

    const [problems, contests, tags] = await Promise.all([
      prisma.problem.findMany({
        where: { title: { contains: query } },
        select: { id: true, title: true, slug: true, difficulty: true },
        orderBy: { order: "asc" },
        take: limit,
      }),
      prisma.contest.findMany({
        where: { title: { contains: query } },
        select: { id: true, title: true, slug: true, status: true, startTime: true },
        orderBy: { startTime: "desc" },
        take: limit,
      }),
      prisma.tag.findMany({
        where: { name: { contains: query } },
        select: { id: true, name: true, slug: true },
        take: limit,
      }),
    ]);

    return Response.json({ query, problems, contests, tags });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
