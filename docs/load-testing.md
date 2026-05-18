# Load Testing

Operator guide for the LeetRank API load-test harness.

---

## Prerequisites

- Node 20+
- `autocannon` installed as a dev dependency (`npm install` from repo root)
- A running instance of `apps/api` (see [Running locally](#running-locally))

---

## Running locally

### 1. Start the API

```bash
# Full stack (postgres + api):
docker compose up -d postgres api

# Or run the API directly against a local Postgres:
cd apps/api && npm run dev
```

### 2. Seed the database

```bash
# 1 000 problems + users (recommended for meaningful results):
npm run seed:1k
```

### 3. Run a scenario

```bash
# Smoke — 10 RPS for 30 s on the four core endpoints:
npm run load:smoke

# Stress — ramp 50 → 500 connections for 60 s on /problems and /contests:
npm run load:stress

# Contest-storm — 50 concurrent users on /problems/random for 30 s:
npm run load:contest
```

### Custom target / duration

```bash
node scripts/load-test.mjs \
  --target http://staging.example.com:4000 \
  --scenario stress \
  --duration 120
```

---

## Scenarios

| Scenario | Connections | Duration | Endpoints |
|---|---|---|---|
| `smoke` | 1 (10 RPS) | 30 s each | `/health`, `/stats`, `/problems`, `/leaderboard/top` |
| `stress` | 50 → 150 → 300 → 500 | 60 s total (ramp) | `/problems`, `/contests` |
| `contest-storm` | 50 concurrent | 30 s | `/problems/random` |

The smoke scenario runs endpoints **sequentially** so each gets a clean baseline.
The stress scenario runs all URLs **in parallel** within each connection phase.

---

## Where results land

Every run writes a timestamped JSON file to:

```
load-test-results/<scenario>-<ISO-timestamp>.json
```

Example: `load-test-results/smoke-2025-06-01T12-00-00-000Z.json`

The file contains the full autocannon result object for each sub-run, plus the
SLO definition that was in effect. This directory is `.gitignore`-able — results
are ephemeral and should not be committed.

In CI (GitHub Actions), results are uploaded as a workflow artifact named
`load-test-results-<scenario>-<run-id>` and retained for 30 days.

---

## SLO contract

| Scenario | p95 latency | Error rate |
|---|---|---|
| `smoke` | < 200 ms | < 0.1 % |
| `stress` | < 500 ms | < 1 % |
| `contest-storm` | < 800 ms | < 5 % |

The script exits with code `1` if any SLO is breached. In CI this fails the
workflow step and surfaces the breach in the job summary.

"Error rate" counts HTTP non-2xx responses plus connection errors divided by
total requests.

---

## CI / GitHub Actions

The workflow is **manual-trigger only** (`workflow_dispatch`). It does not run
on every push or PR — load tests are expensive and should be run deliberately.

To trigger from the GitHub UI:

1. Go to **Actions → Load Test (manual)**.
2. Click **Run workflow**.
3. Choose a scenario and optional duration override.
4. Download the results artifact from the completed run.

To trigger from the CLI:

```bash
gh workflow run load-test.yml \
  --field scenario=smoke \
  --field duration=0
```

---

## Fixture generation

`scripts/load-test-fixtures.mjs` generates randomised but realistic query
parameters for each endpoint:

- `/problems` — random `page` (1–50), `limit` (10/20/25/50), optional
  `difficulty` (30 % of requests), optional `tag` (20 % of requests).
- `/problems/random` — optional `difficulty` (60 % of requests).
- `/contests` — random `page` (1–10), `limit` (10/20).
- `/leaderboard/top` — random `limit` (10/20/50).

This prevents the server's query cache from masking real latency.
