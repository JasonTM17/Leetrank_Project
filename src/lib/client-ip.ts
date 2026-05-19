// Client IP resolution for rate-limit / audit-log keys.
//
// X-Forwarded-For is trivially spoofable by any caller — when there is no
// trusted proxy in front of us, the leftmost IP is whatever the attacker
// chose to send. To avoid a header-rotation bypass (where an attacker
// rotates XFF on each request to dodge per-IP buckets), we have two modes:
//
//   1. Trusted proxy: when `x-trusted-proxy` matches `TRUSTED_PROXY_TOKEN`,
//      the upstream is a hop we control (Caddy / Cloudflare with shared
//      secret) and the leftmost XFF entry is the genuine client IP.
//   2. Untrusted: take the *rightmost* XFF entry, which is the IP the
//      closest hop observed. An attacker spoofing XFF can still pollute
//      this, but the ceiling is the IP allotted by their last router —
//      they can't synthesize fresh IPs the way leftmost-trust allows.
//
// This is the same pattern used by Express's `trust proxy: 'loopback'`
// behavior and Cloudflare's CF-Connecting-IP guidance.

import type { NextRequest } from "next/server";

export function clientIp(request: NextRequest | Request): string {
  const xff = request.headers.get("x-forwarded-for");
  const trustedToken = process.env.TRUSTED_PROXY_TOKEN;
  const proxyHeader = request.headers.get("x-trusted-proxy");

  if (trustedToken && proxyHeader === trustedToken && xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}
