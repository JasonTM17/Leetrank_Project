# leetrank-analytics-python

FastAPI service for user/problem/contest analytics. Heavy compute paths use numpy. Reads directly from Postgres via asyncpg, no ORM.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Liveness |
| GET | `/readyz` | Postgres `SELECT 1` |
| GET | `/metrics` | Prometheus |
| GET | `/v1/analytics/users/{username}/heatmap` | Per-day solve counts (`?days=365`) |
| GET | `/v1/analytics/problems/{slug}/stats` | Acceptance rate per language |
| GET | `/v1/analytics/contests/{slug}/deltas` | Rank deltas across snapshots |

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | Postgres URL (Prisma's `?schema=public` is stripped) |
| `ANALYTICS_PORT` | no | `4016` | Listen port |
| `JWT_SECRET` | no | — | HS256 verification (currently optional) |
| `LOG_LEVEL` | no | `info` | logging level |
| `CORS_ALLOWED_ORIGINS` | no | `*` | Comma-separated origins |

## Local dev

```bash
docker compose up analytics-python

# native (Python 3.13+):
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL=postgresql://leetrank:leetrank-dev@localhost:5432/leetrank \
  uvicorn app.main:app --port 4016 --reload
```

Smoke:

```bash
curl -s http://localhost:4016/healthz
curl -s "http://localhost:4016/v1/analytics/users/jason/heatmap?days=90" | jq
curl -s "http://localhost:4016/v1/analytics/problems/two-sum/stats" | jq
```

## Test

```bash
pytest --cov=app tests/
```

Coverage threshold: **≥ 80%** (backend Node/TS/Python — see global rule #5).

Tests cover: heatmap aggregation (per-day solve counts), problem acceptance-rate-per-language stats, contest rank deltas, readiness probe (asyncpg pool), and input validation on path/query parameters.

## Production runbook

Stateless. Scale horizontally. The heatmap and stats endpoints can be slow on cold cache — Phase 4 adds Redis cache in front of `queries.heatmap_for_user`.

Image: `nguyenson1710/leetrank-analytics-python`. Two-stage `python:3.13-slim`, non-root user, curl-based HEALTHCHECK.

### Slow heatmap

`heatmap_for_user` aggregates submissions for the past N days. If `Submission.createdAt` is missing an index, the GROUP BY scans the table. Confirm `idx_submission_user_createdat` exists (Phase 3.2 migration).

### `503 db unready` on /readyz

asyncpg pool failed to acquire a connection. Check Postgres saturation and `pool_min_size` / `pool_max_size` in `app/db.py`.
