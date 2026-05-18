/**
 * Cache hit-rate observability endpoint.
 *
 * Exposes the in-process TTLCache stats so /admin can render a small
 * dashboard ("hit rate 87% over last 4321 reads, 142/2000 entries
 * resident") and so /api/metrics can scrape these counters into
 * Prometheus.
 *
 * Admin-only — the stats reveal traffic shape (active key namespaces,
 * eviction frequency) which is internal information.
 */
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { cache } from "@/lib/cache";

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const stats = cache.stats();
  return Response.json(
    {
      cache: stats,
      hitRatePercent: Math.round(stats.hitRate * 1000) / 10,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
