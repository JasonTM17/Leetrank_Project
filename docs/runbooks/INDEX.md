# Runbooks Index

All operational runbooks for the LeetRank stack.

---

## Service runbooks

| Runbook                                | Service                       | Port      | Description                                                                   |
| -------------------------------------- | ----------------------------- | --------- | ----------------------------------------------------------------------------- |
| [`api.md`](api.md)                     | `apps/api`                    | 4000      | Hono REST API — alerts, triage, failure modes, useful commands                |
| [`auth.md`](auth.md)                   | `services/auth-go` (identity) | 4011      | Identity service — JWKS, login/register/me, alerts, rotation                  |
| [`judge.md`](judge.md)                 | `judge-service`               | 9090      | Go code-execution judge — timeouts, concurrency, sandbox, toolchain failures  |
| [`postgres.md`](postgres.md)           | `postgres`                    | 5432      | Postgres 16 — connection pool budget, slow queries, backup, restore, VACUUM   |
| [`redis.md`](redis.md)                 | `redis`                       | 6379      | Redis 7 — memory cap, AOF persistence, keyspace conventions, eviction         |
| [`caddy.md`](caddy.md)                 | `caddy`                       | 80/443    | Caddy reverse proxy — TLS renewal, routing table, rate limits, 502/503        |
| [`docker.md`](docker.md)               | all                           | —         | Docker Compose operations — start, stop, rebuild, logs, observability overlay |
| [`n8n.md`](n8n.md)                     | `n8n`                         | 5678      | n8n chatbot webhook — HMAC verification, queue depth, workflow rollback       |
| [`observability.md`](observability.md) | Prometheus/Grafana/Loki       | 9091/3001 | Observability overlay — dashboards, alert silencing, log queries, escalation  |

---

## Operational runbooks

| Runbook                                        | Description                                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`disaster-recovery.md`](disaster-recovery.md) | RTO/RPO targets, backup inventory, 4 restore scenarios, communication plan, drill cadence |
| [`incident-response.md`](incident-response.md) | Severity levels (SEV1–4), roles, IR template, post-mortem format (blameless)              |

---

## Quick reference

### Stack health check

```bash
docker compose ps
curl http://localhost/healthz
curl http://localhost:4000/readyz | jq
curl http://localhost:4011/readyz | jq
curl http://localhost:9090/health | jq
```

### Tail all logs

```bash
docker compose logs -f --tail=50 app api identity judge postgres redis caddy
```

### Restart a service

```bash
docker compose restart <service>
```

### Full stack with observability

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up
```

---

## Alert → runbook mapping

| Alert                        | Runbook section                                 |
| ---------------------------- | ----------------------------------------------- |
| `ServiceDown` (job=api)      | [`api.md` — ServiceDown](api.md)                |
| `ServiceDown` (job=identity) | [`auth.md` — ServiceDown](auth.md)              |
| `ServiceDown` (job=judge)    | [`judge.md` — ServiceDown](judge.md)            |
| `ApiHighErrorRate`           | [`api.md` — ApiHighErrorRate](api.md)           |
| `ApiSlowP99`                 | [`api.md` — ApiSlowP99](api.md)                 |
| `ApiInFlightSurge`           | [`api.md` — ApiInFlightSurge](api.md)           |
| `JudgeRejectionRate`         | [`judge.md` — JudgeRejectionRate](judge.md)     |
| `PostgresDown`               | [`postgres.md` — PostgresDown](postgres.md)     |
| `PostgresConnectionsNearMax` | [`postgres.md` — connection storm](postgres.md) |
| `RedisDown`                  | [`redis.md` — RedisDown](redis.md)              |
| `RedisMemoryPressure`        | [`redis.md` — RedisMemoryPressure](redis.md)    |

---

_Author: Nguyễn Tiến Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)_
