import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/users — public directory of users with the basics for a "Browse
// users" view. Avatar + bio are surfaced; emails and roles are not.
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = (searchParams.get("search") ?? "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const where: Record<string, unknown> = {};
    if (search) {
      where.username = { contains: search };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          username: true,
          avatar: true,
          bio: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return Response.json({ users, total, page, limit });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
