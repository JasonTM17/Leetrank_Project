import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cache } from "@/lib/cache";

const CACHE_KEY = "tags:all";
const TTL_MS = 5 * 60_000;

export async function GET() {
  try {
    const tags = await cache.remember(CACHE_KEY, TTL_MS, () =>
      prisma.tag.findMany({ orderBy: { name: "asc" }, take: 200 })
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
