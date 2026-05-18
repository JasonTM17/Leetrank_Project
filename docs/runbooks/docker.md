# Docker Operator Runbook

Quick reference for running the LeetRank stack with Docker Compose.

---

## Prerequisites

1. Copy `.env.example` to `.env` and fill in required secrets:
   ```bash
   cp .env.example .env
   # Edit .env — at minimum set JWT_SECRET and N8N_PASSWORD
   ```
2. Docker Engine 24+ and Docker Compose v2.20+ installed.

---

## Service URLs

| Service      | URL                        | Notes                        |
|--------------|----------------------------|------------------------------|
| app          | http://localhost:3000      | Next.js frontend             |
| api          | http://localhost:4000      | Hono REST API                |
| judge        | http://localhost:9090      | Go code-execution service    |
| n8n          | http://localhost:5678      | Workflow / chatbot engine    |
| prometheus   | http://localhost:9091      | Metrics (observability only) |
| grafana      | http://localhost:3001      | Dashboards (observability)   |
| loki         | http://localhost:3100      | Log aggregation (obs. only)  |

---

## Common commands

### One-line dev (core services only)

```bash
docker compose up postgres redis app api judge
```

### Full stack including reverse proxy and n8n

```bash
docker compose up
```

### Hot-reload dev (bind-mount source, watch mode)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up app api postgres redis
```

Source changes in `src/` (app) and `apps/api/src/` (api) are picked up
immediately without rebuilding the image.

### Full stack with observability (prometheus, grafana, loki, promtail, exporters)

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up
```

### Rebuild a single service after Dockerfile change

```bash
docker compose build <service>
# e.g.
docker compose build app
docker compose build api
docker compose build judge
```

### Tear down and remove all volumes (full reset)

```bash
docker compose down -v
```

> **Warning:** `-v` deletes all named volumes including the Postgres database,
> Redis data, and n8n workflows. Use only when a clean slate is needed.

### Tear down without removing volumes

```bash
docker compose down
```

### View logs for a service

```bash
docker compose logs -f app
docker compose logs -f api --tail=100
```

### Run a one-off command inside a service

```bash
docker compose run --rm app npx prisma migrate deploy
docker compose run --rm api node dist/server.js --version
```

---

## Observability overlay

The observability stack (prometheus, grafana, postgres-exporter, redis-exporter,
loki, promtail) is **not** started by default. Opt in:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up
```

Config files:
- `infra/prometheus/prometheus.yml` — scrape targets
- `infra/grafana/provisioning/` — datasource and dashboard provisioning
- `infra/loki/loki-config.yml` — Loki storage and retention (7 days)
- `infra/promtail/promtail-config.yml` — Docker log scraping via socket

Grafana default credentials: `admin` / value of `GRAFANA_ADMIN_PASSWORD` (default `admin`).
Change this in `.env` before exposing to a network.

---

## n8n chatbot

n8n is included in the default compose file. On first start:

1. Open http://localhost:5678 and log in with `N8N_USER` / `N8N_PASSWORD`.
2. Import the workflow from `infra/n8n/leetrank-chatbot-workflow.json`.
3. Configure the OpenAI credential inside n8n.

The app service reaches n8n at `http://n8n:5678/webhook/leetrank-chatbot` on
the internal Docker network (set via `N8N_CHATBOT_WEBHOOK_URL`).

---

## CI / Docker Hub publish

Images are built and pushed to Docker Hub on every push to `main`:

| Image                      | Source context    |
|----------------------------|-------------------|
| `jasontm17/leetrank-app`   | `.`               |
| `jasontm17/leetrank-api`   | `./apps/api`      |
| `jasontm17/leetrank-judge` | `./judge-service` |

Tags pushed: `latest`, short SHA, branch name. Verify a push landed:

```bash
docker manifest inspect jasontm17/leetrank-app:latest
```
