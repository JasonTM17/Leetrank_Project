import type { Context } from "hono";
import { prisma } from "../db.js";

/**
 * GET /tags — full tag list, alphabetical. Mirrors
 * apps/web/src/app/api/tags/route.ts. Cache layer is deferred to
 * the shared Redis cutover (phase 2.5).
 */
export async function tagsHandler(c: Context) {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
    c.header("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    return c.json({ tags });
  } catch {
    return c.json({ tags: [] });
  }
}
