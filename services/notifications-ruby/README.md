# leetrank-notifications-ruby

Sinatra-based outbound notification service. Accepts notification payloads on a Redis queue (`notifications:outbound`) and dispatches them via SMTP or HTTP webhook.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/notifications/health` | — | Liveness |
| GET | `/v1/notifications/readyz` | — | Redis PING + queue depth |
| GET | `/v1/notifications/metrics` | — | Prometheus metrics |
| POST | `/v1/notifications/send` | — | Enqueue payload `{kind, to, subject, text}` |

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | yes | `redis://localhost:6379/0` | Redis backing store |
| `PORT` | no | `4015` | Puma listen port |
| `WEB_CONCURRENCY` | no | `0` | Puma cluster workers (0 = single mode) |
| `MAX_THREADS` | no | `5` | Puma threads per worker |
| `SMTP_HOST` | no | — | SMTP server. If unset and no webhook, mail is delivered to the Mail `:test` adapter |
| `SMTP_PORT` | no | `587` | |
| `SMTP_USER` / `SMTP_PASS` | no | — | SMTP creds |
| `SMTP_FROM` | no | `noreply@leetrank.local` | From: header |
| `NOTIFICATION_WEBHOOK_URL` | no | — | If set, the worker POSTs the payload here instead of sending mail |

## Local dev

```bash
docker compose up notifications-ruby

# native (Ruby 3.3+):
bundle install
foreman start  # via Procfile (web + worker)
# or run them separately:
bundle exec puma -C config/puma.rb
bundle exec ruby worker.rb
```

Smoke:

```bash
curl -s http://localhost:4015/v1/notifications/health
curl -s -X POST http://localhost:4015/v1/notifications/send \
  -H 'content-type: application/json' \
  -d '{"kind":"problem-of-the-day","to":"user@example.com","subject":"Daily","text":"Hello"}'
```

## Production runbook

The HTTP API and the worker are two processes (Procfile). Containerize both — compose runs the HTTP service and a sidecar worker reuses the same image with `command: bundle exec ruby worker.rb`.

Image: `nguyenson1710/leetrank-notifications-ruby`. Alpine-based, non-root user, tini PID1.

### Failed deliveries

The worker pushes failed payloads to `notifications:dlq`. Inspect via `redis-cli LLEN notifications:dlq` and `LRANGE notifications:dlq 0 9`. There is no auto-retry — drain manually after fixing root cause.
