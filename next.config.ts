import type { NextConfig } from "next";

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
    ];
  },
};

export default nextConfig;
