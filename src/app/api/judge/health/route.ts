import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/judge/health — proxy to the Go judge's /health endpoint, surfaced
// at our own /api so the frontend doesn't need to know the judge URL. We
// strip the response body and return only the high-level status + scheduler
// snapshot — that's what dashboards care about.
const JUDGE_URL = process.env.JUDGE_SERVICE_URL || "http://localhost:9090";

export async function GET(_request: NextRequest) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    const res = await fetch(`${JUDGE_URL}/health`, { signal: controller.signal });
    if (!res.ok) {
      return Response.json({ status: "degraded", httpStatus: res.status }, { status: 502 });
    }
    const body = await res.json();
    return Response.json({ status: body.status ?? "ok", scheduler: body.scheduler ?? null });
  } catch (err) {
    return Response.json(
      { status: "down", error: err instanceof Error ? err.message : "unknown" },
      { status: 503 }
    );
  } finally {
    clearTimeout(timer);
  }
}

void prisma;
