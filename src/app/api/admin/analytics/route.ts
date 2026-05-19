/**
 * GET /api/admin/analytics
 *
 * Admin-only dashboard aggregator. Returns the four rollups powering
 * /admin/analytics charts: 12-month user growth, 30-day submission
 * volume, problem-by-difficulty breakdown, and top-10 languages by
 * submission count.
 *
 * Aggregation is cached for 5 minutes inside `loadAnalytics` via
 * `cache.remember` (single-flight) so concurrent admin loads share
 * one DB pass.
 */
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { loadAnalytics } from "@/lib/admin-analytics";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    const data = await loadAnalytics();
    return Response.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    logger.error("admin/analytics GET failed", {
      scope: "api/admin/analytics",
      err: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
