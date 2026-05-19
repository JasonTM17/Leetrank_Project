import { prisma } from "@/lib/db";
import { envOr } from "@/lib/env";

const JUDGE_URL = envOr("JUDGE_SERVICE_URL", "http://localhost:9090");
const startedAt = Date.now();

interface ServiceStatus {
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
}

async function checkDb(): Promise<ServiceStatus> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (err) {
    return { status: "down", error: err instanceof Error ? err.message : "unknown" };
  }
}

async function checkJudge(): Promise<ServiceStatus> {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    const res = await fetch(`${JUDGE_URL}/health`, { signal: controller.signal });
    if (!res.ok) {
      return { status: "degraded", latencyMs: Date.now() - t0, error: `HTTP ${res.status}` };
    }
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (err) {
    return { status: "down", error: err instanceof Error ? err.message : "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const [db, judge] = await Promise.all([checkDb(), checkJudge()]);
  const overall = db.status === "ok" && judge.status === "ok" ? "ok" : "degraded";
  const httpStatus = db.status === "down" ? 503 : 200;

  return Response.json(
    {
      status: overall,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      services: { database: db, judge },
    },
    { status: httpStatus }
  );
}
