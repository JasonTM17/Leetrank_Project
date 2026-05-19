# Load Testing & Chaos Engineering

This directory documents how the platform is exercised under load and how
we validate it survives common failure modes. Two tool families:

- **k6** — load generation, scenario-based, p95/error-rate SLO assertions.
- **Chaos shell drills** — kill / partition / flood scripts that target a
  running `docker compose` stack and assert graceful degradation.

The legacy `autocannon` harness (`scripts/load-test.mjs`) is still in tree
and still useful for smoke and stress runs from a Node-only environment.
The k6 scenarios documented here are the canonical perf suite going
forward — they capture realistic ramp profiles and are what the weekly
`perf.yml` workflow exercises.

---

## 1. Prerequisites

| Tool          | Why                                  | Install                                           |
| ------------- | ------------------------------------ | ------------------------------------------------- |
| `docker`      | Local stack + chaos drills           | https://docs.docker.com/get-docker/               |
| `k6`          | Load scenarios                       | `brew install k6` / https://k6.io/docs/get-started/installation/ |
| `curl`, `jq`  | Chaos scripts + ad-hoc probing       | OS package manager                                |
| `node` 20+    | `compare.mjs` baseline diff          | https://nodejs.org/                               |

A running stack is the prerequisite for every scenario:

```bash
cp .env.example .env       # if you haven't already
docker compose up -d
```

Wait for the `web` and `api` health checks to be `healthy` before
generating load:

```bash
docker compose ps
# Expect: web (healthy), api (healthy), postgres (healthy), redis (healthy)
```

---

## 2. k6 scenarios

All k6 scripts live under `scripts/k6/`. Each script:

- Asserts `http_req_duration p95 < 500ms`.
- Asserts `http_req_failed (5xx + transport) rate < 1%`.
- Emits scenario-specific custom metrics (e.g. `login_throttled`,
  `submission_5xx`).
- Honours `BASE_URL` so it can run against local, staging, or prod.

### 2.1 `login.js` — auth flood

| Property      | Value                                       |
| ------------- | ------------------------------------------- |
| VUs           | 0 → 100 ramp over 5 minutes, hold 1 min     |
| Endpoint      | `POST /api/auth/login`                      |
| Per-VU email  | `loadtest-vu-${VU}@leetrank.test`           |
| Headers       | `X-Forwarded-For` per VU (synthetic)        |

```bash
k6 run scripts/k6/login.js \
  -e BASE_URL=http://localhost:3000
```

**Expected baseline (8-core dev box, fresh stack, no other load):**

| Metric               | Target |
| -------------------- | ------ |
| p95 latency          | < 500 ms |
| Error rate (5xx)     | < 1%   |
| 429 rate             | varies — limiter may legitimately throttle a fraction of requests; that is healthy, not a failure |

429 responses are **not** counted as failures. The script asserts only on
5xx and transport errors. If you see >50% 429 you're probably hitting the
per-account bucket from a single email — re-check that `vuEmail()` is
varying per VU.

### 2.2 `submission-storm.js` — code submissions

| Property      | Value                                       |
| ------------- | ------------------------------------------- |
| VUs           | 50 constant for 2 minutes                   |
| Endpoint      | `POST /api/submissions`                     |
| Auth          | Per-VU login at start of run, cookie reused |
| Languages     | Python + JavaScript (random per request)    |

```bash
k6 run scripts/k6/submission-storm.js \
  -e BASE_URL=http://localhost:3000 \
  -e PROBLEM_ID=two-sum
```

**Expected baseline:**

| Metric            | Target |
| ----------------- | ------ |
| Dispatch p95      | < 500 ms |
| Error rate (5xx)  | < 1%   |
| Accepted (2xx)    | depends on whether `loadtest-vu-*` users are seeded; if not, expect mostly 401s — still a valid SLO check |

To get realistic accepted-rate numbers, seed test users first:

```bash
pnpm run seed:loadtest   # if defined; otherwise see docs/load-testing.md
```

### 2.3 `leaderboard-read.js` — heaviest read path

| Property      | Value                                       |
| ------------- | ------------------------------------------- |
| VUs           | 0 → 200 ramp 30s, hold 3min, ramp down 30s  |
| Endpoint      | `GET /api/leaderboard`                      |
| Variation     | Pagination + scope (global/weekly/monthly)  |

```bash
# Hit the Next.js route:
k6 run scripts/k6/leaderboard-read.js \
  -e BASE_URL=http://localhost:3000

# Hit the Rust service directly (skip Next.js layer):
k6 run scripts/k6/leaderboard-read.js \
  -e BASE_URL=http://localhost:4014 \
  -e LEADERBOARD_PATH=/leaderboard/top
```

**Expected baseline:**

| Metric            | Target |
| ----------------- | ------ |
| p95 latency       | < 500 ms (Next.js); < 100 ms (Rust direct) |
| Error rate (5xx)  | < 1%   |
| 2xx rate          | > 99%  |

---

## 3. Interpreting k6 output

Run output ends with a summary block. The fields that matter:

```
http_req_duration............: avg=X  min=Y  med=Z  max=… p(90)=… p(95)=… p(99)=…
http_req_failed..............: 0.42% ✓ X    ✗ Y
checks.......................: 99.50% ✓ X    ✗ Y
```

- `http_req_duration p(95)` is the SLO line. If `>500` → fail.
- `http_req_failed rate` is the 5xx + transport budget. If `>0.01` → fail.
- `checks` includes scenario-specific assertions; <100% means at least one
  request returned an unexpected status.

The custom counters (`login_throttled`, `submission_accepted`, etc.) are
diagnostic — they show **why** an SLO was met or missed, not whether it
was met. Always read both layers together.

For CI runs, the workflow attaches a JSON summary as
`perf-${scenario}-${run_id}.json`. The compare step diffs p95 and error
rate against the previous baseline; >20% regression fails the job.

---

## 4. Chaos drills

All chaos scripts live under `scripts/chaos/` and target a running
`docker compose` stack. They are intentionally short (20–30s outages) so
they're safe to run on a dev laptop, but the same scripts can run against
staging by pointing `WEB_URL` at a non-local host.

> **Do not run these against production.** They `docker compose stop` and
> `docker network disconnect` real containers. Production drills belong
> in a dedicated game-day environment.

### 4.1 `kill-judge.sh`

Stops the judge container for 30 s, hammers the homepage, restarts the
judge, asserts the public read path stayed below 10% 5xx.

```bash
bash scripts/chaos/kill-judge.sh
```

### 4.2 `kill-redis.sh`

Stops Redis for 30 s and probes `/`, `/problems`, `/leaderboard`,
`/api/health`. Asserts the rate-limiter's in-memory bucket continues to
serve the public homepage with <10% 5xx.

```bash
bash scripts/chaos/kill-redis.sh
```

### 4.3 `flood-rate-limit.sh`

Sends 100 login attempts in succession from a synthetic IP and asserts
the 429 rate exceeds 90% (production limit is 5 per 15 min, so the
limiter should engage within the first ~5 attempts).

```bash
bash scripts/chaos/flood-rate-limit.sh
```

### 4.4 `network-partition.sh`

Detaches the postgres container from its docker network for 20 s,
probes the homepage, reattaches, and asserts the homepage recovered to
200 OK. Auto-resolves the network name if the default guess is wrong.

```bash
bash scripts/chaos/network-partition.sh
```

A `trap` ensures the network is reattached even if the script aborts.

---

## 5. Recommended schedule

| Cadence       | What                                       | Where        |
| ------------- | ------------------------------------------ | ------------ |
| **Per PR**    | Smoke (autocannon, existing `load-test.yml`) | CI           |
| **Weekly**    | k6 perf suite vs baseline (`perf.yml`)     | CI, staging  |
| **Monthly**   | Run all four chaos drills end-to-end       | Game day     |
| **Quarterly** | Tabletop: review SLOs, raise/lower targets | Team meeting |

The weekly `perf.yml` workflow uploads the run output as
`perf-baseline-${scenario}` and compares the next run against it. Reset
the baseline manually via `workflow_dispatch` with `reset_baseline=true`
after a deliberate perf change (cache layer added, query rewritten, etc.).

---

## 6. Adding a new scenario

1. Create `scripts/k6/<name>.js`, modeled on the existing scripts.
   Reuse the metrics + thresholds shape.
2. Add `<name>` to the matrix in `.github/workflows/perf.yml`.
3. Document the new scenario in this README under section 2.
4. Run it twice locally to confirm it's stable, then promote the second
   run as the initial baseline.

If a scenario needs custom seed data, prefer a separate seed script over
embedding fixture-creation in the k6 file — k6 isn't a great
ETL tool, and reusing the `pnpm run seed:*` family keeps the fixtures
shared with integration tests.
