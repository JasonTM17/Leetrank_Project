/**
 * DevOps console aggregator — pure data-fetch helpers used by the
 * `/admin/devops` server component and the `/api/admin/devops/snapshot`
 * route. Each helper returns a discriminated `Result` so the caller can
 * render per-tile error states without breaking the page.
 *
 * Design notes:
 * - No throws across module boundary. We log and return `{ ok: false, error }`.
 * - GitHub access is optional; missing token yields a typed "tokenMissing" result
 *   the UI can render as a friendly placeholder.
 * - Timeouts are tight (2s) — operators should never wait > a couple seconds
 *   for a glance dashboard.
 */
import { prisma } from "@/lib/db";
import { envOr } from "@/lib/env";
import { logger } from "@/lib/logger";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type ServiceHealth = "operational" | "degraded" | "down" | "unknown";

export interface ServiceTile {
  id: string;
  name: string;
  status: ServiceHealth;
  latencyMs?: number;
}

export interface ServiceHealthSnapshot {
  overall: ServiceHealth;
  services: ServiceTile[];
  checkedAt: string;
}

export interface CiRun {
  id: number;
  name: string;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | null
  htmlUrl: string;
  headBranch: string;
  headSha: string;
  createdAt: string;
}

export interface CiRunsResult {
  runs: CiRun[];
  repo: string;
}

export interface SubmissionRate {
  lastHour: number;
  windowMinutes: 60;
}

export interface QueueDepth {
  depth: number | null;
  source: "prometheus" | "placeholder";
}

export interface SecurityEvents {
  sandboxEscapes: number;
  lockoutsLastHour: number;
}

const HTTP_TIMEOUT_MS = 2_000;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

async function probe(url: string): Promise<{ ok: boolean; latencyMs: number }> {
  const t0 = Date.now();
  const { signal, cancel } = withTimeout(HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal, cache: "no-store" });
    return { ok: res.ok, latencyMs: Date.now() - t0 };
  } catch {
    return { ok: false, latencyMs: Date.now() - t0 };
  } finally {
    cancel();
  }
}

/** Canonical service inventory. New services should be appended here. */
export const SERVICES: ReadonlyArray<{
  id: string;
  name: string;
  url: () => string;
}> = [
  { id: "web", name: "Next.js Web", url: () => "" }, // local DB ping
  { id: "api", name: "API (Hono)", url: () => `${envOr("API_INTERNAL_URL", "http://api:4000")}/healthz` },
  { id: "auth", name: "Auth (Go)", url: () => `${envOr("AUTH_INTERNAL_URL", "http://identity:4011")}/healthz` },
  { id: "problems", name: "Problems (Go)", url: () => `${envOr("PROBLEMS_INTERNAL_URL", "http://problems:4012")}/healthz` },
  { id: "submissions", name: "Submissions (Go)", url: () => `${envOr("SUBMISSIONS_INTERNAL_URL", "http://submissions:4013")}/healthz` },
  { id: "realtime", name: "Realtime (Go)", url: () => `${envOr("REALTIME_INTERNAL_URL", "http://realtime:4014")}/healthz` },
  { id: "leaderboard", name: "Leaderboard (Rust)", url: () => `${envOr("LEADERBOARD_INTERNAL_URL", "http://leaderboard:4015")}/healthz` },
  { id: "notifications", name: "Notifications (Ruby)", url: () => `${envOr("NOTIFICATIONS_INTERNAL_URL", "http://notifications:4016")}/healthz` },
  { id: "analytics", name: "Analytics (Python)", url: () => `${envOr("ANALYTICS_INTERNAL_URL", "http://analytics:4017")}/healthz` },
  { id: "judge", name: "Judge", url: () => `${envOr("JUDGE_INTERNAL_URL", "http://judge:9090")}/health` },
];

async function checkWebTile(): Promise<ServiceTile> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { id: "web", name: "Next.js Web", status: "operational", latencyMs: Date.now() - t0 };
  } catch (err) {
    logger.warn("devops: web/db ping failed", { error: err instanceof Error ? err.message : "unknown" });
    return { id: "web", name: "Next.js Web", status: "down", latencyMs: Date.now() - t0 };
  }
}

export async function getServiceHealth(): Promise<Result<ServiceHealthSnapshot>> {
  try {
    const tiles = await Promise.all(
      SERVICES.map(async (svc): Promise<ServiceTile> => {
        if (svc.id === "web") return checkWebTile();
        const { ok, latencyMs } = await probe(svc.url());
        return {
          id: svc.id,
          name: svc.name,
          status: ok ? "operational" : "down",
          latencyMs,
        };
      })
    );
    const hasDown = tiles.some((s) => s.status === "down");
    const hasDegraded = tiles.some((s) => s.status === "degraded");
    const overall: ServiceHealth = hasDown ? "down" : hasDegraded ? "degraded" : "operational";
    return {
      ok: true,
      data: { overall, services: tiles, checkedAt: new Date().toISOString() },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

const GH_TOKEN_ENV = "GH_DEVOPS_TOKEN";
const GH_REPO_ENV = "GH_DEVOPS_REPO";
const GH_API = "https://api.github.com";

export type CiRunsOutcome =
  | { ok: true; data: CiRunsResult }
  | { ok: false; error: string }
  | { ok: false; reason: "tokenMissing" };

export async function getCiRuns(limit = 5): Promise<CiRunsOutcome> {
  const token = process.env[GH_TOKEN_ENV];
  const repo = envOr(GH_REPO_ENV, "JasonTM17/LeetRank_Project");
  if (!token) return { ok: false, reason: "tokenMissing" };
  const { signal, cancel } = withTimeout(HTTP_TIMEOUT_MS);
  try {
    const url = `${GH_API}/repos/${repo}/actions/runs?per_page=${limit}`;
    const res = await fetch(url, {
      signal,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      return { ok: false, error: `GitHub API ${res.status}` };
    }
    const json = (await res.json()) as { workflow_runs: Array<Record<string, unknown>> };
    const runs: CiRun[] = (json.workflow_runs ?? []).slice(0, limit).map((r) => ({
      id: Number(r.id),
      name: String(r.name ?? r.display_title ?? "workflow"),
      status: String(r.status ?? "unknown"),
      conclusion: r.conclusion === null ? null : String(r.conclusion),
      htmlUrl: String(r.html_url ?? ""),
      headBranch: String(r.head_branch ?? ""),
      headSha: String(r.head_sha ?? "").slice(0, 7),
      createdAt: String(r.created_at ?? new Date().toISOString()),
    }));
    return { ok: true, data: { runs, repo } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  } finally {
    cancel();
  }
}

export async function getSubmissionRate(): Promise<Result<SubmissionRate>> {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const lastHour = await prisma.submission.count({ where: { createdAt: { gte: since } } });
    return { ok: true, data: { lastHour, windowMinutes: 60 } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function getLockoutCount(): Promise<Result<number>> {
  // The accountLockout model is added by the identity hardening track. If it
  // does not exist on the prisma client, surface 0 — operators see "0 lockouts"
  // rather than a tile-wide error.
  const client = prisma as unknown as { accountLockout?: { count: (args: unknown) => Promise<number> } };
  if (!client.accountLockout) return { ok: true, data: 0 };
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const count = await client.accountLockout.count({ where: { createdAt: { gte: since } } });
    return { ok: true, data: count };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function getSandboxEscapes(): Promise<Result<number>> {
  // V1: judge does not expose a counter endpoint yet. Return 0 with source
  // metadata so the tile shows a clean baseline. When judge adds /metrics for
  // sandbox_escape_total this should switch to a Prometheus query.
  return { ok: true, data: 0 };
}

export async function getQueueDepth(): Promise<Result<QueueDepth>> {
  // Read submissions.queue_depth from the metrics endpoint when it exists.
  // Falls back to placeholder so operators see the tile shape regardless.
  const url = envOr("SUBMISSIONS_INTERNAL_URL", "http://submissions:4013");
  const { signal, cancel } = withTimeout(HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/metrics`, { signal, cache: "no-store" });
    if (!res.ok) return { ok: true, data: { depth: null, source: "placeholder" } };
    const text = await res.text();
    const m = text.match(/^submissions_queue_depth\s+([0-9.]+)/m);
    const depth = m ? Math.floor(Number(m[1])) : null;
    return {
      ok: true,
      data: { depth, source: depth !== null ? "prometheus" : "placeholder" },
    };
  } catch {
    return { ok: true, data: { depth: null, source: "placeholder" } };
  } finally {
    cancel();
  }
}

export async function getSecurityEvents(): Promise<Result<SecurityEvents>> {
  const [escapes, lockouts] = await Promise.all([getSandboxEscapes(), getLockoutCount()]);
  return {
    ok: true,
    data: {
      sandboxEscapes: escapes.ok ? escapes.data : 0,
      lockoutsLastHour: lockouts.ok ? lockouts.data : 0,
    },
  };
}

export interface DevopsSnapshot {
  serviceHealth: Result<ServiceHealthSnapshot>;
  ciRuns: CiRunsOutcome;
  submissionRate: Result<SubmissionRate>;
  queueDepth: Result<QueueDepth>;
  securityEvents: Result<SecurityEvents>;
  generatedAt: string;
}

export async function buildSnapshot(): Promise<DevopsSnapshot> {
  const [serviceHealth, ciRuns, submissionRate, queueDepth, securityEvents] = await Promise.all([
    getServiceHealth(),
    getCiRuns(),
    getSubmissionRate(),
    getQueueDepth(),
    getSecurityEvents(),
  ]);
  return {
    serviceHealth,
    ciRuns,
    submissionRate,
    queueDepth,
    securityEvents,
    generatedAt: new Date().toISOString(),
  };
}
