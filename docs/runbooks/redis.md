# Redis Runbook

Quick reference for operating the LeetRank Redis 7 instance in production.

---

## What it does

Redis serves as the cache and future queue/stream backend for LeetRank. It is configured with AOF persistence (`--appendonly yes`) and password authentication. The `apps/web` service connects via `REDIS_URL`. As of today, Redis is provisioned but the application cache layer (F-056 in the prod-readiness audit) is not yet wired — `apps/api` and `services/auth-go` (identity) do not use Redis directly.

---

## Configuration

Current compose configuration:

```yaml
command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-leetrank-dev}
```

> **Gap (F-031, F-024):** `--maxmemory` is not set. Without a memory cap, Redis will consume all available host memory and the `RedisMemoryPressure` alert will divide by zero (maxmemory = 0). Set this before production:

```bash
# Add to .env
REDIS_EXTRA_ARGS=--maxmemory 512mb --maxmemory-policy allkeys-lru
```

And update the compose command to include `${REDIS_EXTRA_ARGS}`. Until then, monitor `redis_memory_used_bytes` manually.

---

## Keyspace conventions

All keys must use a prefix to separate concerns:

| Prefix | Purpose | Example |
|---|---|---|
| `cache:` | Application cache (read-through, TTL-based) | `cache:problems:list:page1` |
| `queue:` | Future job queue (reserved) | `queue:submissions` |
| `stream:` | Future event streams (reserved) | `stream:judge-results` |

Never write bare keys without a prefix. This makes keyspace inspection and selective flushing safe.

---

## Health check

```bash
# Container health
docker compose ps redis

# Manual ping (requires password)
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" ping
# Expected: PONG

# Memory usage
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" INFO memory \
  | grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"

# Eviction stats
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" INFO stats \
  | grep evicted_keys
```

---

## Memory cap and eviction policy

Once `--maxmemory 512mb --maxmemory-policy allkeys-lru` is set (F-031):

- Redis will evict the least-recently-used keys across all keyspaces when memory reaches 512 MB.
- `allkeys-lru` is appropriate because all current keys are cache entries with no strict durability requirement.
- If queue or stream keys are added in the future, switch to `volatile-lru` and set TTLs only on cache keys.

### Monitoring evictions

```bash
# Check evicted key count (non-zero means memory pressure)
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" INFO stats \
  | grep evicted_keys

# Watch evictions in real time
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" \
  --stat | grep evicted
```

If `evicted_keys` is growing rapidly, either increase `--maxmemory` or reduce cache TTLs.

---

## AOF persistence

Redis is started with `--appendonly yes`. The AOF file is stored in the `redis_data` Docker volume at `/data/appendonly.aof`.

### Verify AOF is active

```bash
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" \
  CONFIG GET appendonly
# Expected: appendonly yes
```

### AOF restore steps

If the Redis volume is lost or corrupted:

```bash
# 1. Stop Redis
docker compose stop redis

# 2. If you have an AOF backup, copy it into the volume
# (replace <backup-path> with the path to your appendonly.aof backup)
docker run --rm -v leetrank_project_redis_data:/data \
  -v <backup-path>:/backup alpine \
  cp /backup/appendonly.aof /data/appendonly.aof

# 3. Start Redis — it will replay the AOF on startup
docker compose start redis

# 4. Verify
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" ping
```

> **Gap (F-010):** Off-site Redis backup is not configured. AOF is local to the Docker volume. If the host is lost, Redis data is lost. For the current use case (cache only), this is acceptable — the cache will warm up from Postgres. If Redis is used for queues or sessions in the future, add off-site AOF backup.

---

## Common alerts

Defined in [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml):

| Alert | Condition | Severity |
|---|---|---|
| `RedisDown` | `redis_up == 0` for 1m | critical |
| `RedisMemoryPressure` | `used / maxmemory > 85%` for 5m | warning |

> **Note:** `RedisMemoryPressure` will not fire correctly until `--maxmemory` is set (F-024). The expression divides by `redis_memory_max_bytes`, which is 0 when maxmemory is unset.

### `RedisDown` triage

```bash
docker compose ps redis
docker compose logs --tail=100 redis
docker compose up -d redis
```

### `RedisMemoryPressure` triage

```bash
# Check memory breakdown
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" INFO memory

# Find the largest keys
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" \
  --bigkeys

# Flush cache keyspace only (does NOT flush queue: or stream: keys)
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" \
  --scan --pattern 'cache:*' | xargs docker compose exec -T redis \
  redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" DEL
```

---

## Recent incidents

_No incidents recorded yet. File post-mortems under `docs/post-mortems/YYYY-MM-DD-slug.md`._

---

## Useful commands

```bash
# Stream logs
docker compose logs -f redis

# Open redis-cli shell
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}"

# Key count
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" DBSIZE

# Flush entire database (DESTRUCTIVE — cache only, confirm first)
docker compose exec redis redis-cli -a "${REDIS_PASSWORD:-leetrank-dev}" FLUSHDB

# Restart
docker compose restart redis
```

---

## See also

- [`docker.md`](docker.md) — general Docker Compose operations
- [`disaster-recovery.md`](disaster-recovery.md) — full restore procedures
- [`docs/adr/0007-redis-for-cache-and-queue.md`](../adr/0007-redis-for-cache-and-queue.md)
- [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml)

---

_Author: Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)_
