import type { MetadataRoute } from "next";
import { envOr } from "@/lib/env";

const BASE_URL = envOr("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated areas don't expose useful content to crawlers.
        // /api routes are JSON; keeping them out of the index avoids
        // confusing search results.
        disallow: ["/admin", "/dashboard", "/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
