import { prisma } from "@/lib/db";

const API_URL = process.env.API_INTERNAL_URL ?? "http://api:4000";
const AUTH_URL = process.env.AUTH_INTERNAL_URL ?? "http://auth:4001";
const JUDGE_URL = process.env.JUDGE_INTERNAL_URL ?? "http://judge:9090";

type ServiceHealth = "operational" | "degraded" | "down";

interface ServiceResult {
  id: string;
  name: string;
  status: ServiceHealth;
  latencyMs: number;
}

interface StatusResponse {
  status: ServiceHealth;
  services: ServiceResult[];
  checkedAt: string;
}

async function probeHttp(url: string): Promise<{ ok: boolean; latencyMs: number }> {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { ok: res.ok, latencyMs: Date.now() - t0 };
  } catch {
    return { ok: false, latencyMs: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

async function checkWeb(): Promise<ServiceResult> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { id: "web", name: "Next.js Web", status: "operational", latencyMs: Date.now() - t0 };
  } catch {
    return { id: "web", name: "Next.js Web", status: "down", latencyMs: Date.now() - t0 };
  }
}

async function checkApi(): Promise<ServiceResult> {
  const [liveness, readiness] = await Promise.all([
    probeHttp(`${API_URL}/healthz`),
    probeHttp(`${API_URL}/readyz`),
  ]);
  const latencyMs = Math.max(liveness.latencyMs, readiness.latencyMs);
  let status: ServiceHealth;
  if (!liveness.ok) {
    status = "down";
  } else if (!readiness.ok) {
    status = "degraded";
  } else {
    status = "operational";
  }
  return { id: "api", name: "API (Hono)", status, latencyMs };
}

async function checkAuth(): Promise<ServiceResult> {
  const { ok, latencyMs } = await probeHttp(`${AUTH_URL}/healthz`);
  return {
    id: "auth",
    name: "Auth Service",
    status: ok ? "operational" : "down",
    latencyMs,
  };
}

async function checkJudge(): Promise<ServiceResult> {
  const { ok, latencyMs } = await probeHttp(`${JUDGE_URL}/health`);
  return {
    id: "judge",
    name: "Judge Service",
    status: ok ? "operational" : "down",
    latencyMs,
  };
}

export async function GET() {
  const services = await Promise.all([checkWeb(), checkApi(), checkAuth(), checkJudge()]);

  const hasDown = services.some((s) => s.status === "down");
  const hasDegraded = services.some((s) => s.status === "degraded");
  const overall: ServiceHealth = hasDown ? "down" : hasDegraded ? "degraded" : "operational";

  const body: StatusResponse = {
    status: overall,
    services,
    checkedAt: new Date().toISOString(),
  };

  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
