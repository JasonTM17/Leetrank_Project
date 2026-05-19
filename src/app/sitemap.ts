import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { envOr } from "@/lib/env";

const BASE_URL = envOr("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

// Cache the database query in production for 1 hour. Sitemaps don't need to
// be perfectly fresh, and skipping it on every crawl keeps Postgres quiet.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/problems",
    "/contests",
    "/leaderboard",
    "/login",
    "/register",
  ].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "daily",
    priority: path === "" ? 1.0 : 0.7,
  }));

  let problemRoutes: MetadataRoute.Sitemap = [];
  let contestRoutes: MetadataRoute.Sitemap = [];
  let tagRoutes: MetadataRoute.Sitemap = [];

  try {
    const [problems, contests, tags] = await Promise.all([
      prisma.problem.findMany({
        select: { slug: true, updatedAt: true },
        orderBy: { order: "asc" },
        take: 5000,
      }),
      prisma.contest.findMany({
        select: { slug: true, startTime: true },
        orderBy: { startTime: "desc" },
        take: 1000,
      }),
      prisma.tag.findMany({
        select: { slug: true },
      }),
    ]);

    problemRoutes = problems.map((p) => ({
      url: `${BASE_URL}/problems/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    contestRoutes = contests.map((c) => ({
      url: `${BASE_URL}/contests/${c.slug}`,
      lastModified: c.startTime,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

    tagRoutes = tags.map((t) => ({
      url: `${BASE_URL}/tags/${t.slug}`,
      changeFrequency: "weekly",
      priority: 0.4,
    }));
  } catch {
    // If the DB is down at sitemap time, fall back to static routes only.
    // Crawlers will retry; we don't want to 500 the entire sitemap.
  }

  return [...staticRoutes, ...problemRoutes, ...contestRoutes, ...tagRoutes];
}
