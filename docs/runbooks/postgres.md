# Postgres Runbook

Quick reference for operating the LeetRank Postgres 16 database in production.

---

## What it does

Postgres is the primary data store for all LeetRank services. It holds users, problems, test cases, submissions, contests, discussions, bookmarks, and chat messages. The schema is managed by Prisma (`prisma/schema.prisma`). All services connect via `DATABASE_URL`.

---

## Connection pool budget

Each service uses Prisma's built-in connection pool. Postgres `max_connections` defaults to 100 in the `postgres:16-alpine` image.

| Service | Pool size | Notes |
|---|---|---|
| `apps/auth` | 5 | Low traffic; mostly health probes today |
| `apps/api` | 10 | Read-heavy; problems, contests, leaderboard |
| `apps/web` (`app`) | 10 | Next.js server actions + API routes |
| **Total target** | **≤ 25 active** | Leave headroom; target ≤ 80 of 100 max |

> **Gap (F-011):** pgBouncer is not deployed. Under connection storms, services compete directly for Postgres connections. Add pgBouncer in transaction mode before scaling beyond a single host.

To set an explicit pool size, append `?connection_limit=10` to `DATABASE_URL` in `.env`.

---

## Health check

```bash
# Postgres container health (uses pg_isready)
docker compose ps postgres

# Manual connectivity check
docker compose exec postgres pg_isready -U leetrank -d leetrank

# Count active connections by application
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "SELECT application_name, count(*), state \
   FROM pg_stat_activity \
   GROUP BY application_name, state \
   ORDER BY count DESC;"
```

---

## Slow query investigation

### Using `pg_stat_activity`

```bash
# Show queries running longer than 5 seconds
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "SELECT pid, now() - query_start AS duration, state, query \
   FROM pg_stat_activity \
   WHERE state != 'idle' \
     AND query_start < now() - interval '5 seconds' \
   ORDER BY duration DESC;"

# Kill a specific query by pid
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "SELECT pg_cancel_backend(<pid>);"

# Kill a stuck transaction (use pg_terminate_backend only if cancel fails)
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "SELECT pg_terminate_backend(<pid>);"
```

### Using `pg_stat_statements`

`pg_stat_statements` is not enabled by default in the `postgres:16-alpine` image. To enable it:

1. Add `shared_preload_libraries = 'pg_stat_statements'` to `postgresql.conf` (or pass as a command arg in compose).
2. Run `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` in the database.
3. Query the top slow statements:

```sql
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

> **Gap (F-012):** Slow query logging is not configured. Until `pg_stat_statements` is enabled, use `pg_stat_activity` for live diagnosis.

---

## Backup

> **Gap (F-008):** Automated Postgres backup is not yet implemented. This is a Blocker in the prod-readiness audit. Until a cron job is in place, run backups manually before any risky operation.

### Manual backup

```bash
# Dump to a gzip file (run from the host)
docker compose exec postgres pg_dump -U leetrank leetrank \
  | gzip > "leetrank-$(date +%Y%m%d-%H%M%S).sql.gz"

# Verify the dump is non-empty
ls -lh leetrank-*.sql.gz
```

### Planned automated backup (F-008)

Once implemented, the backup cron should:
1. Run `pg_dump | gzip` on a schedule (daily minimum).
2. Upload to off-site storage (S3 or equivalent).
3. Retain at least 7 daily dumps.
4. Alert on failure.

---

## Restore drill

Run this procedure quarterly to verify backups are usable.

```bash
# 1. Stop all services that write to Postgres
docker compose stop app api auth

# 2. Drop and recreate the database
docker compose exec postgres psql -U leetrank -c "DROP DATABASE IF EXISTS leetrank;"
docker compose exec postgres psql -U leetrank -c "CREATE DATABASE leetrank;"

# 3. Restore from the latest dump
gunzip -c leetrank-<timestamp>.sql.gz \
  | docker compose exec -T postgres psql -U leetrank -d leetrank

# 4. Run Prisma migrations to ensure schema is current
docker compose run --rm api npx prisma migrate deploy

# 5. Restart services
docker compose start app api auth

# 6. Verify health
curl http://localhost:4000/readyz | jq
curl http://localhost:4001/readyz | jq
```

---

## Connection storm

Signs: `PostgresConnectionsNearMax` alert fires, services log `P2024` (pool timeout), or `pg_stat_activity` shows many connections in `idle in transaction` state.

```bash
# 1. Count connections by state and application
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "SELECT application_name, state, count(*) \
   FROM pg_stat_activity \
   GROUP BY application_name, state \
   ORDER BY count DESC;"

# 2. Identify idle-in-transaction connections (these hold locks)
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "SELECT pid, application_name, now() - state_change AS idle_duration, query \
   FROM pg_stat_activity \
   WHERE state = 'idle in transaction' \
   ORDER BY idle_duration DESC;"

# 3. Terminate idle-in-transaction connections older than 30 seconds
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "SELECT pg_terminate_backend(pid) \
   FROM pg_stat_activity \
   WHERE state = 'idle in transaction' \
     AND state_change < now() - interval '30 seconds';"

# 4. Restart the offending service to reset its pool
docker compose restart api
```

---

## VACUUM / ANALYZE schedule

Postgres autovacuum is enabled by default in the `postgres:16-alpine` image. No manual schedule is required under normal load.

Run manual `VACUUM ANALYZE` after:
- A large bulk import or delete.
- A restore from dump.
- Noticeably degraded query performance.

```bash
# Full vacuum analyze (takes a table lock — run during low traffic)
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "VACUUM ANALYZE;"

# Check table bloat (tables with high dead tuple ratio)
docker compose exec postgres psql -U leetrank -d leetrank -c \
  "SELECT relname, n_dead_tup, n_live_tup, \
          round(n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0) * 100, 1) AS dead_pct \
   FROM pg_stat_user_tables \
   ORDER BY n_dead_tup DESC \
   LIMIT 10;"
```

---

## Common alerts

Defined in [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml):

| Alert | Condition | Severity |
|---|---|---|
| `PostgresDown` | `pg_up == 0` for 1m | critical |
| `PostgresConnectionsNearMax` | connections > 85% of `max_connections` for 5m | warning |

### `PostgresDown` triage

```bash
docker compose ps postgres
docker compose logs --tail=100 postgres
docker compose up -d postgres
```

### `PostgresConnectionsNearMax` triage

Follow the connection storm procedure above.

---

## Recent incidents

_No incidents recorded yet. File post-mortems under `docs/post-mortems/YYYY-MM-DD-slug.md`._

---

## Useful commands

```bash
# Stream Postgres logs
docker compose logs -f postgres

# Open a psql shell
docker compose exec postgres psql -U leetrank -d leetrank

# Run Prisma migrations
docker compose run --rm api npx prisma migrate deploy

# Check migration status
docker compose run --rm api npx prisma migrate status

# Manual backup
docker compose exec postgres pg_dump -U leetrank leetrank \
  | gzip > "leetrank-$(date +%Y%m%d-%H%M%S).sql.gz"
```

---

## See also

- [`docker.md`](docker.md) — general Docker Compose operations
- [`disaster-recovery.md`](disaster-recovery.md) — full restore procedures
- [`docs/adr/0002-use-postgresql-over-sqlite.md`](../adr/0002-use-postgresql-over-sqlite.md)
- [`docs/adr/0005-prisma-orm.md`](../adr/0005-prisma-orm.md)
- [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml)

---

_Author: Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)_
