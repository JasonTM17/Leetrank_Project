# Services

Every long-running service in the LeetRank stack, with port, dependencies, image, and owner. The runbooks linked in the last column are the operational entry point for each service.

## Edge

| Service | Image | Internal port | Depends on | Runbook | Owner |
|---|---|---|---|---|---|
| `caddy` | `caddy:2.8-alpine` | 80, 443 | `app`, `api`, `identity`, `submissions`, `problems`, `realtime`, `n8n` | [caddy.md](../runbooks/caddy.md) | platform |

Caddy terminates TLS, applies rate limits, and routes by path prefix. Routing table is in `infra/caddy/Caddyfile`.

## Application services

| Service | Image | Internal port | Depends on | Runbook | Owner |
|---|---|---|---|---|---|
| `app` (web) | `nguyenson1710/leetrank-app` | 3000 | `postgres`, `redis`, `identity`, `api` | service [README](../../README.md) | web |
| `api` | `nguyenson1710/leetrank-api` | 4000 | `postgres`, `redis` | [api.md](../runbooks/api.md) | platform |
| `identity` (`services/auth-go`) | `nguyenson1710/leetrank-identity` | 4011 | `postgres` | [auth.md](../runbooks/auth.md) | platform |
| `submissions` (`services/submissions-go`) | `nguyenson1710/leetrank-submissions-go` | 4012 | `postgres`, `redis`, `judge` | [api.md](../runbooks/api.md) | platform |
| `problems` (`services/problems-go`) | `nguyenson1710/leetrank-problems-go` | 4013 | `postgres` | [api.md](../runbooks/api.md) | platform |
| `realtime` (`services/realtime-go`) | `nguyenson1710/leetrank-realtime-go` | 4014 | `redis`, `identity` | [redis.md](../runbooks/redis.md) | platform |
| `leaderboard` (`services/leaderboard-rust`) | `nguyenson1710/leetrank-leaderboard-rust` | 4015 | `postgres`, `redis` | [redis.md](../runbooks/redis.md) | platform |
| `notifications` (`services/notifications-ruby`) | `nguyenson1710/leetrank-notifications-ruby` | 4016 | `redis` (`notifications:outbound` queue), SMTP | service [README](../../services/notifications-ruby/README.md) | platform |
| `analytics` (`services/analytics-python`) | `nguyenson1710/leetrank-analytics-python` | 4017 | `postgres` | service [README](../../services/analytics-python/README.md) | platform |
| `judge` (`judge-service`) | `nguyenson1710/leetrank-judge` | 9090 | `redis` (job queue) | [judge.md](../runbooks/judge.md) | platform |

`app` is the Next.js 16 frontend. Every other service is an independently deployable backend.

## Data plane

| Service | Image | Internal port | Used by | Runbook | Owner |
|---|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | `app`, `api`, `identity`, `problems`, `submissions`, `analytics`, `leaderboard` | [postgres.md](../runbooks/postgres.md) | platform |
| `redis` | `redis:7-alpine` | 6379 | `app`, `api`, `submissions`, `realtime`, `leaderboard`, `notifications`, `judge` | [redis.md](../runbooks/redis.md) | platform |

Postgres is the source of truth. Redis is the hot-path cache, the job queue for the judge, the pubsub bus for `realtime`, and the outbound queue for `notifications`.

## Workflow / integrations

| Service | Image | Internal port | Used by | Runbook | Owner |
|---|---|---|---|---|---|
| `n8n` | `n8nio/n8n` | 5678 | `app` (chatbot webhook) | [n8n.md](../runbooks/n8n.md) | platform |

## Observability overlay

Opt-in via `docker compose -f docker-compose.yml -f docker-compose.observability.yml up`.

| Component | Image | Host port | Purpose |
|---|---|---|---|
| Prometheus | `prom/prometheus:v2.55.0` | 9091 | Metrics scrape + alert rules |
| Grafana | `grafana/grafana:11.3.0` | 3001 | Dashboards |
| Loki | `grafana/loki:3.2.0` | 3100 | Log aggregation |
| Promtail | `grafana/promtail:3.2.0` | — | Log shipper |
| postgres-exporter | `prometheuscommunity/postgres-exporter:v0.16.0` | — | Postgres metrics |
| redis-exporter | `oliver006/redis_exporter:v1.66.0` | — | Redis metrics |

See [observability.md](../runbooks/observability.md) for dashboard tour and alert silencing.

## Port matrix (host)

When running locally with `docker-compose.local.yml`, ports are remapped to avoid host conflicts. The map below is the default `docker-compose.yml` exposure. Adjust to your local file if it differs.

| Host | Service |
|---|---|
| 80 / 443 | `caddy` |
| 3000 | `app` |
| 4000 | `api` |
| 4011 | `identity` |
| 4012 | `submissions` |
| 4013 | `problems` |
| 4014 | `realtime` |
| 4015 | `leaderboard` |
| 4016 | `notifications` |
| 4017 | `analytics` |
| 5432 | `postgres` |
| 5678 | `n8n` |
| 6379 | `redis` |
| 9090 | `judge` |
| 9091 | `prometheus` (overlay) |
| 3001 | `grafana` (overlay) |

## Ownership

Single-owner project. Author of record is **Nguyễn Tiến Sơn** (`jasonbmt06@gmail.com`, [@JasonTM17](https://github.com/JasonTM17)). The "Owner" column above tags the logical area for future contributors; for now every service routes to the same person.

## In-process components (web service)

The following capabilities run inside the `app` (Next.js) container as
route handlers + libs rather than standalone services. They are listed
here so the architecture surface is complete and discoverable.

| Component | Path | Backed by | Notes |
|---|---|---|---|
| Admin analytics | `/admin/analytics` + `GET /api/admin/analytics` | `src/lib/admin-analytics.ts` aggregator over Prisma | SVG chart primitives `<SvgBarChart>`, `<SvgSparkline>`, `<SvgPieChart>`. Admin-gated. |
| Recommendations | `GET /api/recommendations` + home component | `src/lib/recommendations.ts` pure scorer (tag overlap + difficulty progression + freshness) | No new infra; reads `Submission` + `Problem` + `ProblemTag`. |
| Daily challenge | `GET /api/daily-challenge` + history routes | `src/lib/streak.ts` pure streak math + `DailyChallenge` table | Picker workflow `.github/workflows/daily-challenge.yml` rotates the row at 00:05 UTC. |
| Achievements | `/achievements` + `GET /api/achievements` + `GET /api/user-achievements` | `src/lib/achievements.ts` pure `evaluateAchievements` engine | Fired on AC via submissions post-commit hook. |
| Editorial + hints | `GET /api/editorial/[slug]` | `Editorial` model | Gated until first AC or contest end. |
| Solutions + votes | `GET/POST /api/solutions` + `POST /api/solutions/[id]/vote` | `SharedSolution` + `SolutionVote` models | Optimistic UI; sort by votes / recent. |
| Code playback | `POST /api/submission-events` + `GET /api/playback/[id]` | `SubmissionEvent` model | Feature-flagged via `PLAYBACK_ENABLED` env. |
| Study plans | `GET /api/plans*` + `/plans` UI | `Plan` + `PlanStep` + `UserPlanProgress` models | Submission post-commit hook unlocks next step on AC. |
| Submission analytics | `GET /api/submissions/[id]/percentile` | `src/lib/analytics-helpers.ts` (percentile + distribution) | Submission percentile card UI. |
| DevOps console | `/admin/devops` + snapshot API | `src/lib/devops-aggregator.ts` | CI runs, queue depth, error budget tiles. |

These will graduate to dedicated services if + when the surface justifies
the operational overhead. The current shape is deliberate: the web tier
keeps Postgres-bound aggregations co-located with SSR rendering, and the
Go / Rust / Ruby / Python services own the latency-critical paths.

## See also

- [Runbooks INDEX](../runbooks/INDEX.md) — alert-to-runbook map and quick health-check commands
- [Data flow](data-flow.md) — submission lifecycle (web → submissions → judge → notifications)
- [Auth flow](auth-flow.md) — Ed25519 + JWKS + refresh-token rotation
- [ADR 0011](../adr/0011-split-backend-frontend.md) — rationale for the FE/BE split
- [ADR 0018](../adr/0018-go-services-buildout.md) — Go services buildout
