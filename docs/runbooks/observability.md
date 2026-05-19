# Observability Runbook

LeetRank ships an opt-in observability overlay built on Prometheus, Grafana, Loki, and Promtail. This runbook covers day-to-day use: bringing the stack up, finding dashboards, silencing noisy alerts, and the on-call escalation matrix.

The overlay is **off by default** in `docker-compose.yml`. Operators opt in by passing `docker-compose.observability.yml` as a second `-f` argument.

---

## Stack components

| Component | Image | Internal port | Host port | Purpose |
|---|---|---|---|---|
| Prometheus | `prom/prometheus:v2.55.0` | 9090 | 9091 | Metrics scrape + alert rules |
| Grafana | `grafana/grafana:11.3.0` | 3000 | 3001 | Dashboards & ad-hoc queries |
| postgres-exporter | `prometheuscommunity/postgres-exporter:v0.16.0` | 9187 | — | Postgres metrics |
| redis-exporter | `oliver006/redis_exporter:v1.62.0` | 9121 | — | Redis metrics |
| Loki | `grafana/loki:3.3.2` | 3100 | 3100 | Log aggregation |
| Promtail | `grafana/promtail:3.3.2` | — | — | Log shipper |

Config files:

- `infra/prometheus/prometheus.yml` — scrape jobs + `rule_files: ["alerts.yml"]`
- `infra/prometheus/alerts.yml` — alert rule groups
- `infra/grafana/provisioning/datasources/prometheus.yml` — Grafana datasource
- `infra/grafana/provisioning/dashboards/providers.yml` — dashboard provider
- `infra/grafana/provisioning/dashboards/*.json` — dashboard definitions
- `infra/loki/loki-config.yml` and `infra/promtail/promtail-config.yml` — log pipeline

---

## Bringing the stack up

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.observability.yml \
  up -d prometheus grafana postgres-exporter redis-exporter loki promtail
```

Verify Prometheus targets are healthy:

```bash
curl -s http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
```

Every job listed in `prometheus.yml` should report `health: "up"`. Any `down` target needs investigation in the matching service runbook (see `docs/runbooks/INDEX.md`).

To shut the overlay down without touching the rest of the stack:

```bash
docker compose -f docker-compose.observability.yml down
```

The base stack keeps running. `prometheus_data`, `grafana_data`, and `loki_data` named volumes persist scrape history and dashboards across restarts.

---

## Accessing Grafana

Default URL: `http://localhost:3001`

Default credentials on first boot:

- Username: `admin`
- Password: `admin` (override via `GRAFANA_ADMIN_PASSWORD` env var)

**Change the password immediately on first login.** Grafana will force a rotation prompt; do not skip it. After rotation, store the new password in the team password manager — never commit it to the repo.

User signup is disabled (`GF_USERS_ALLOW_SIGN_UP=false`); add new operators by creating accounts from the admin UI.

---

## Where to find each dashboard

All dashboards live under the **LeetRank** folder, provisioned automatically from `infra/grafana/provisioning/dashboards/`.

| Dashboard | UID | What it shows |
|---|---|---|
| Platform Overview — RED | `leetrank-platform-overview` | Request rate, 5xx error ratio, p50/p95/p99 latency per service, plus `up{}` health stat |
| Judge Throughput | `leetrank-judge-throughput` | Submissions queue depth, executions/sec by language and final status, sandbox kill reasons, escape attempts, DLQ growth |
| Auth & Security | `leetrank-auth-security` | Login attempts (success vs failure), account lockouts/min, refresh-token rotations & reuse blocks, JWKS verifies |
| Realtime Load | `leetrank-realtime-load` | Active WS connections, rejected connections by reason, broadcast fan-out by channel, ping/pong drops, drain status |
| Analytics & Cache | `leetrank-analytics-cache` | Cache hit rate, hits vs misses, redis fallback/error rate, p95 latency by route, redis memory pressure |

Direct links (replace host as needed):

- `http://localhost:3001/d/leetrank-platform-overview`
- `http://localhost:3001/d/leetrank-judge-throughput`
- `http://localhost:3001/d/leetrank-auth-security`
- `http://localhost:3001/d/leetrank-realtime-load`
- `http://localhost:3001/d/leetrank-analytics-cache`

Dashboards are **not editable** in the UI (`disableDeletion: false`, `editable: false` in JSON). To change a panel, edit the JSON file in `infra/grafana/provisioning/dashboards/`, redeploy the overlay, and Grafana will pick up the change within `updateIntervalSeconds: 30`.

---

## Alert rules

Rules live in `infra/prometheus/alerts.yml` and are loaded via `rule_files: ["alerts.yml"]` in `prometheus.yml`. Groups:

| Group | Critical alerts | Notes |
|---|---|---|
| `leetrank-availability` | `ServiceDown`, `ApiHighErrorRate`, `ApiSlowP99`, `ApiInFlightSurge` | API-specific RED rules |
| `leetrank-platform-red` | `HighErrorRate` (>5% 5xx, 5m), `HighLatency` (p95 >1s, 5m) | Platform-wide RED, all services |
| `leetrank-submissions` | `QueueBacklog` (>100, 10m), `SubmissionsDLQGrowth` | Backpressure on judge dispatch |
| `leetrank-auth-security` | `LockoutSpike` (>10/min), `LoginFailureSpike` | Brute-force / credential-stuffing signal |
| `leetrank-judge` | `JudgeRejectionRate`, `SandboxEscape`, `SandboxKillSpike` | `SandboxEscape` is an instant page |
| `leetrank-realtime` | `RealtimeRejectSpike`, `RealtimeMessageDrops` | Slow consumers / abuse signal |
| `leetrank-postgres` | `PostgresDown`, `PostgresConnectionsNearMax` | DB health |
| `leetrank-redis` | `RedisDown`, `RedisMemoryPressure` | Cache health |
| `leetrank-infra` | `DiskUsage` (>80%), `ServiceDownStrict` | Infra & blanket scrape failure |

To reload alert rules without restarting Prometheus (the container runs with `--web.enable-lifecycle`):

```bash
docker compose exec prometheus wget -qO- --post-data= http://localhost:9090/-/reload
```

Inspect active alerts:

```bash
curl -s http://localhost:9091/api/v1/alerts | jq '.data.alerts[] | {name: .labels.alertname, state: .state, job: .labels.job}'
```

Or visit `http://localhost:9091/alerts` directly in a browser.

---

## Silencing alerts

LeetRank does not yet ship Alertmanager in the default overlay. Silencing options:

### Option 1 — Comment out the rule (recommended for known-bad noise)

Edit `infra/prometheus/alerts.yml`, comment the offending `- alert:` block, then reload:

```bash
docker compose exec prometheus wget -qO- --post-data= http://localhost:9090/-/reload
```

Open a follow-up issue with the silence justification and a target re-enable date so the rule does not stay disabled forever.

### Option 2 — Tighten the threshold

If the rule fires legitimately but too often, raise the threshold or `for:` window in `alerts.yml`. Document the change in `CHANGELOG.md` so future on-call knows the new normal.

### Option 3 — Add Alertmanager (production)

For production deployments, add Alertmanager to the overlay and route alerts to email/Slack/PagerDuty. The standard pattern:

1. Add `alertmanager` service to `docker-compose.observability.yml` (image `prom/alertmanager:v0.27.0`).
2. Add `alerting:` block in `prometheus.yml` pointing to `alertmanager:9093`.
3. Drop a config at `infra/alertmanager/alertmanager.yml` defining receivers and silences.
4. Use the Alertmanager UI at `http://localhost:9093` to add time-bounded silences without code changes.

---

## On-call escalation matrix

LeetRank is currently maintained by a single contributor.

| Severity | Channel | Primary | Secondary |
|---|---|---|---|
| SEV1 (outage) | direct contact | `@JasonTM17` | — |
| SEV2 (degraded) | direct contact | `@JasonTM17` | — |
| SEV3 (warning) | issue tracker | `@JasonTM17` | — |
| SEV4 (info) | issue tracker | `@JasonTM17` | — |

> Single contributor placeholder. Replace this matrix the moment a second engineer is on the project: add a secondary on-call, define rotation cadence (weekly is standard), and wire Alertmanager to a real paging channel.

For severity definitions and the incident-response template, see [`incident-response.md`](incident-response.md).

---

## Quick reference

```bash
# Bring up the overlay
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d

# Tail Prometheus & Grafana logs
docker compose logs -f --tail=50 prometheus grafana

# Reload Prometheus config without restart
docker compose exec prometheus wget -qO- --post-data= http://localhost:9090/-/reload

# Validate config files locally
python -c "import yaml; yaml.safe_load(open('infra/prometheus/prometheus.yml'))"
python -c "import yaml; yaml.safe_load(open('infra/prometheus/alerts.yml'))"
```

See also: [`docker.md`](docker.md), [`incident-response.md`](incident-response.md), [`disaster-recovery.md`](disaster-recovery.md).
