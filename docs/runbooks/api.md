# API Service Runbook (`apps/api`)

Quick reference for operating the LeetRank API service in production.

---

## What it does

`apps/api` is a standalone Hono HTTP server (Node.js) that exposes the LeetRank REST API on port 4000. It serves problem listings, contest data, leaderboards, tags, stats, and trending/random problem endpoints. It reads from Postgres via Prisma and is the primary backend consumed by `apps/web` (via Caddy at `/api/v1/*`) and by external clients. It does not handle authentication — that is `services/auth-go` (identity).

---

## Health endpoints

| Endpoint | Purpose | Expected response |
|---|---|---|
| `GET /healthz` | Cheap liveness — no DB call | `200 {"status":"ok"}` |
| `GET /readyz` | Readiness — includes DB probe | `200` if DB reachable; `503` if not |
| `GET /health` | Alias for `/readyz` | Same as above |
| `GET /metrics` | Prometheus metrics | `200` text/plain exposition format |

```bash
# Liveness
curl http://localhost:4000/healthz

# Readiness (DB probe)
curl http://localhost:4000/readyz | jq

# Spot-check Prometheus metrics
curl http://localhost:4000/metrics | grep leetrank_api
```

---

## Common alerts

All alert definitions live in [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml).

### `ServiceDown` (severity: critical)

**Condition:** `up == 0` for `job=api` for 2 minutes.

**Meaning:** Prometheus cannot scrape `/metrics` on `api:4000`. The container is down, crashed, or the network is broken.

**Triage:**

```bash
# 1. Check container state
docker compose ps api

# 2. Tail recent logs
docker compose logs --tail=100 api

# 3. Attempt manual health check
curl http://localhost:4000/healthz

# 4. Restart if container is stopped/exited
docker compose up -d api

# 5. If restart loop, check for startup crash
docker compose logs api | grep -i "error\|fatal\|ECONNREFUSED"
```

Escalate to Nguyễn Sơn (jasonbmt06@gmail.com) if the service does not recover within 10 minutes.

---

### `ApiHighErrorRate` (severity: warning)

**Condition:** 5xx responses exceed 2% of total requests for 5 minutes.

**Meaning:** A significant fraction of requests are failing server-side. Common causes: DB pool exhausted, Postgres down, unhandled exception in a route handler.

**Triage:**

```bash
# 1. Check error logs
docker compose logs -f api | grep -i "error\|5[0-9][0-9]"

# 2. Check DB connectivity
curl http://localhost:4000/readyz | jq

# 3. Check Postgres health
docker compose ps postgres
docker compose logs --tail=50 postgres

# 4. Check in-flight count (see ApiInFlightSurge below)
curl http://localhost:4000/metrics | grep leetrank_api_http_requests_in_flight

# 5. Restart api if DB is healthy but api is stuck
docker compose restart api
```

If the error rate is tied to a specific path, check the Grafana dashboard for per-path breakdown (`leetrank_api_http_requests_total{path=...}`).

---

### `ApiSlowP99` (severity: warning)

**Condition:** p99 request duration exceeds 1 second for 10 minutes on any path.

**Meaning:** Tail latency is degraded. Common causes: slow Postgres query, missing index, N+1 query, DB pool wait.

**Triage:**

```bash
# 1. Identify the slow path from Prometheus
curl http://localhost:4000/metrics | grep leetrank_api_http_request_duration_seconds

# 2. Check for long-running queries in Postgres
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state \
   FROM pg_stat_activity \
   WHERE state != 'idle' AND query_start < now() - interval '5 seconds' \
   ORDER BY duration DESC;"

# 3. Check connection pool wait
docker compose exec api node -e \
  "const {prisma} = await import('./dist/db.js'); \
   const r = await prisma.\$queryRaw\`SELECT count(*) FROM pg_stat_activity WHERE application_name='prisma'\`; \
   console.log(r); process.exit(0);"
```

If a specific query is slow, check for missing indexes in `prisma/schema.prisma` and run `EXPLAIN ANALYZE` in Postgres.

---

### `ApiInFlightSurge` (severity: warning)

**Condition:** `leetrank_api_http_requests_in_flight > 100` for 3 minutes.

**Meaning:** Requests are queuing up. Either a traffic spike or a downstream stall (Postgres slow/down, judge unreachable).

**Triage:**

```bash
# 1. Check current in-flight count
curl http://localhost:4000/metrics | grep leetrank_api_http_requests_in_flight

# 2. Check if Postgres is the bottleneck
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# 3. Check for connection pool exhaustion
docker compose logs --tail=50 api | grep -i "pool\|timeout\|connection"

# 4. If traffic spike: check Caddy rate limits are holding
docker compose logs --tail=50 caddy | grep -i "rate\|429"
```

---

## Common failure modes

### DB pool exhausted

Prisma's default connection pool is sized to `min(cpuCount * 2 + 1, 10)`. Under load, all connections may be in use.

Signs: `P2024` errors in logs (`Timed out fetching a new connection from the pool`).

Fix: Add `connection_limit=10` to `DATABASE_URL` and verify the Postgres `max_connections` budget (see [`postgres.md`](postgres.md)).

### Postgres down

Signs: `/readyz` returns 503, logs show `ECONNREFUSED` or Prisma `P1001`.

Fix: See [`postgres.md`](postgres.md) for recovery steps.

### Slow query

Signs: `ApiSlowP99` fires, specific path shows high p99 in metrics.

Fix: Run `EXPLAIN ANALYZE` on the offending query. Add index in `prisma/schema.prisma` and run `prisma migrate dev`.

### OOM / process crash

Signs: Container exits with code 137 (OOM kill) or `SIGKILL`.

Fix: Check `docker stats api`. Increase memory limit in compose or reduce query result set sizes. Ensure pagination is applied on all list endpoints.

---

## Recent incidents

_No incidents recorded yet. File post-mortems under `docs/post-mortems/YYYY-MM-DD-slug.md`._

---

## Useful commands

```bash
# Stream logs
docker compose logs -f api

# Last 100 lines
docker compose logs --tail=100 api

# Readiness probe
curl http://localhost:4000/readyz | jq

# Prometheus metrics (filter to api-specific)
curl http://localhost:4000/metrics | grep leetrank_api

# One-off Node diagnostic inside the container
docker compose exec api node -e "console.log(process.memoryUsage())"

# Restart the service
docker compose restart api

# Rebuild and restart after code change
docker compose build api && docker compose up -d api

# Run Prisma migrations (if schema changed)
docker compose run --rm api npx prisma migrate deploy
```

---

## See also

- [`docker.md`](docker.md) — general Docker Compose operations
- [`postgres.md`](postgres.md) — database runbook
- [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml) — alert definitions
- [`docs/adr/0011-split-backend-frontend.md`](../adr/0011-split-backend-frontend.md) — architecture decision

---

_Author: Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)_
