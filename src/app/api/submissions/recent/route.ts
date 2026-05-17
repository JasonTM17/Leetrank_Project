import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Public-ish view of recent submissions across all users — used for the
// "live activity" sidebar. We expose only metadata: who solved what, when,
// and the language. Code is intentionally NOT included.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const submissions = await prisma.submission.findMany({
      where: { status: "accepted" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        language: true,
        runtime: true,
        createdAt: true,
        problem: { select: { id: true, title: true, slug: true, difficulty: true } },
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    return Response.json({ submissions });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
