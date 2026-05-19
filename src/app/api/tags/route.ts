import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";

const TTL_MS = 5 * 60_000;
// Whitelist guards against arbitrary string queries hammering Prisma with
// unindexed values. Keep in sync with Tag.category in schema.prisma.
const ALLOWED_CATEGORIES = new Set(["topic", "company", "skill"]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rawCategory = searchParams.get("category");
    const category = rawCategory && ALLOWED_CATEGORIES.has(rawCategory) ? rawCategory : null;
    const cacheKey = `tags:all:${category ?? "*"}`;

    const tags = await cache.remember(cacheKey, TTL_MS, () =>
      prisma.tag.findMany({
        where: category ? { category } : undefined,
        orderBy: { name: "asc" },
        take: 200,
      })
    );
    return NextResponse.json(
      { tags },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  } catch {
    return NextResponse.json({ tags: [] });
  }
}
