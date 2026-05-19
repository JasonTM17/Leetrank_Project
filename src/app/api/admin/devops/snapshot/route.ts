import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { buildSnapshot } from "@/lib/devops/aggregator";

/**
 * JSON snapshot of the DevOps console state. Used by the in-page
 * "Refresh now" button as a low-overhead ping (server component still
 * does the full re-render). Auth-gated by the same `requireAdmin()` as
 * the page so 401/403/429 envelopes are consistent across the surface.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;
  const snapshot = await buildSnapshot();
  return Response.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
