import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Wires next-intl's request-time config into the Next build. The path points
// at the file that exports getRequestConfig() — see src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Enable standalone output so the Docker runtime image can ship
  // server.js + .next/standalone without dragging the whole node_modules
  // tree along. Keeps the runner image around 200 MB instead of 1 GB.
  output: "standalone",

  // Strict mode catches a few classes of bugs (double effects in dev, deprecated
  // APIs) that won't surface in CI without it.
  reactStrictMode: true,

  // Power off the X-Powered-By: Next.js header — it's noise that helps no one
  // except attackers fingerprinting the stack.
  poweredByHeader: false,

  // Pin the cache-busting headers we want everywhere. Per-route overrides
  // (the openapi route uses its own Cache-Control, for example) take
  // precedence; this is the floor.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Belt-and-braces: even with `export const dynamic = "force-dynamic"`
      // in the route layouts, force the CDN to never store these surfaces.
      // /dashboard and /admin render per-user privileged data — a leaked
      // cache hit between two users is a security incident, not a UX bug.
      {
        source: "/dashboard/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/dashboard",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/admin",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
