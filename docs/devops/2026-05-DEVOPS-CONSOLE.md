# DevOps Console (V1)

Owner: Nguyen Tien Son (sole contributor / oncall)
Status: Build target for May 2026
Route: `/admin/devops` (admin-only, server-rendered)

## Goals

A single ops-only at-a-glance dashboard that answers "is the system OK right now?" without bouncing between Grafana, GitHub, Docker Hub, and Postgres. Distinct from the public `/status` page (which is for end-users; minimal and reassurance-shaped) — this one is for the operator and surfaces internal-only signals.

## Scope (V1)

- Service health grid for all 10 services (web + 7 microservices + judge + DB).
- Recent CI runs (last 5 GitHub workflow runs) with status pills.
- Recent deploys (latest commit / image tag — read from CI tile metadata).
- Sandbox-escape counter (judge events, last 24h).
- Submission queue depth (Prometheus pull, fall back to placeholder).
- Submissions per hour (Prisma `submission` count, last 60 min).
- Account lockouts in last hour (Prisma `accountLockout` count if table exists, else 0).
- 5xx rate (last 60 min — best-effort from logs/metrics endpoint).

## Out of Scope (V2)

- Real-time log tailing in browser.
- Distributed tracing UI / span explorer.
- Runbook auto-launch / one-click remediation.
- Per-service dashboards (delegate to Grafana for deep dives).
- Alert configuration UI.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  /admin/devops (Server Component)               │
│  - requireAdmin() gate (redirect on fail)       │
│  - Promise.allSettled() over all aggregators    │
│  - Each tile renders its own success/error      │
└─────────┬───────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│  src/lib/devops/aggregator.ts (pure)            │
│  - getServiceHealth() → fetch /api/status       │
│  - getJudgeHealth()   → fetch /api/judge/health │
│  - getCiRuns()        → GitHub API (token gated)│
│  - getSubmissionRate()→ prisma.submission.count │
│  - getLockoutCount()  → prisma.accountLockout?  │
│  - getQueueDepth()    → metrics fallback        │
└─────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│  /api/admin/devops/snapshot (JSON)              │
│  - Same aggregator results, used by client      │
│    refresh button (no full reload)              │
└─────────────────────────────────────────────────┘
```

### Why no new persistence

V1 reads from existing endpoints and database tables only. We do not add a `devops_event` table because:

1. Logs already exist (Loki / file).
2. Metrics already exist (Prometheus).
3. CI history already exists (GitHub).
4. Adding storage = adding a thing to maintain — exactly what an oncall does not need.

### Failure isolation

Each aggregator returns a discriminated `{ ok: true, data } | { ok: false, error }` shape. Tiles render their own error state without breaking the page. A failed GitHub fetch shows "GH token unset" or the error message; the rest of the page still renders.

## Auth

- Page: `requireAdmin()` from `src/lib/admin-guard.ts`. Non-admin → 403 (server-redirect to `/admin` which already shows access-denied).
- Snapshot API: same `requireAdmin()` gate, identical 401/403/429 envelope.
- No middleware changes needed — page-level gating is sufficient and matches the existing `/admin/*` pattern.

## Refresh model

- Default: 30s `setInterval` on the client, calls `/api/admin/devops/snapshot`.
- Manual: a "Refresh now" button that triggers an immediate fetch.
- No SSE / WebSocket in V1 — polling is enough at this scale.
- Server-render the first paint so admins see data instantly without flash-of-loading.

## Files

- `docs/devops/2026-05-DEVOPS-CONSOLE.md` (this file)
- `src/app/admin/devops/page.tsx`
- `src/app/api/admin/devops/snapshot/route.ts`
- `src/lib/devops/aggregator.ts`
- `src/components/devops/service-health-grid.tsx`
- `src/components/devops/ci-runs-tile.tsx`
- `src/components/devops/queue-depth-tile.tsx`
- `src/components/devops/security-events-tile.tsx`
- `src/__tests__/devops/aggregator.test.ts`
- `src/__tests__/devops/service-health-grid.test.tsx`

## Env vars

- `GH_DEVOPS_TOKEN` — GitHub PAT for read-only Actions API. Optional. If unset, CI tile shows "GH token unset" placeholder.
- `GH_DEVOPS_REPO` — `owner/name` (defaults to `JasonTM17/Leetrank_Project`).
- Existing: `JUDGE_SERVICE_URL`, `API_INTERNAL_URL`, `AUTH_INTERNAL_URL`, `JUDGE_INTERNAL_URL`.

## Service inventory (10 tiles)

1. Next.js Web (this app)
2. API (Hono `services/api`)
3. Auth (`services/auth-go`)
4. Problems (`services/problems-go`)
5. Submissions (`services/submissions-go`)
6. Realtime (`services/realtime-go`)
7. Leaderboard (`services/leaderboard-rust`)
8. Notifications (`services/notifications-ruby`)
9. Analytics (`services/analytics-python`)
10. Judge (`judge-service/`)

Each tile shows: name, status dot (green/amber/red/gray-unknown), last-seen latency.

## Verification

- `pnpm test` includes new aggregator + grid tests.
- `pnpm typecheck` clean.
- `pnpm build` succeeds.
- `/admin/devops` returns 403 envelope for non-admin via the same redirect path used by other admin pages.
- All 10 service tiles render for an admin even when half the services are offline.
