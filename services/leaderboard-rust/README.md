# leetrank-leaderboard-rust

High-performance leaderboard service. Reads the `leaderboard:global` Redis sorted set and serves paginated rankings. Admins can recompute the ZSET from postgres.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/healthz` | — | Liveness probe |
| GET | `/readyz` | — | Readiness probe (Redis PING + Postgres SELECT 1) |
| GET | `/metrics` | — | Prometheus metrics |
| GET | `/v1/leaderboard` | — | Paginated top users (`?limit=N&offset=M`) |
| GET | `/v1/leaderboard/user/:username` | — | A single user's rank + score |
| POST | `/v1/leaderboard/recompute` | admin | Rebuild the ZSET from postgres |

`POST /v1/leaderboard/recompute` accepts either `X-Admin-Token: <ADMIN_TOKEN>` or `Authorization: Bearer <jwt>` where the JWT carries `role=admin`.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | yes | — | Postgres connection string used for recompute |
| `REDIS_URL` | no | `redis://localhost:6379/0` | Redis with the leaderboard ZSET |
| `LEADERBOARD_PORT` | no | `4014` | Listen port |
| `JWT_SECRET` | no | `dev-secret-change-me` | HS256 secret for admin JWTs |
| `ADMIN_TOKEN` | no | — | Static token accepted via `X-Admin-Token` |
| `RUST_LOG` | no | `info` | tracing filter |

## Local dev

```bash
docker compose up leaderboard-rust

# native (Rust 1.83+):
DATABASE_URL=postgresql://leetrank:leetrank-dev@localhost:5432/leetrank \
REDIS_URL=redis://:leetrank-dev@localhost:6379/0 \
cargo run --bin leaderboard-rust
```

Smoke test:

```bash
curl -s http://localhost:4014/healthz
curl -s "http://localhost:4014/v1/leaderboard?limit=10&offset=0" | jq
curl -s -X POST -H "X-Admin-Token: $ADMIN_TOKEN" \
  http://localhost:4014/v1/leaderboard/recompute
```

## Test

```bash
cargo test

# Coverage (requires cargo-tarpaulin):
cargo tarpaulin --out Html
```

Coverage threshold: **≥ 70%** (standard Rust service — see global rule #5).

Tests cover: paginated leaderboard retrieval (ZREVRANGE), single-user rank lookup, admin recompute endpoint (auth via X-Admin-Token and JWT), readiness probe (Redis PING + Postgres SELECT 1), and error responses for missing users.

## Production runbook

Stateless. Hot path is the Redis ZRANGE; recompute is the only Postgres traffic. Scale horizontally without coordination.

Image: `nguyenson1710/leetrank-leaderboard-rust`. Distroless cc-debian12 runtime, non-root.

### `503 Service Unavailable` on `/readyz`

Probe issues PING to Redis and `SELECT 1` to Postgres. Investigate whichever returns first in the logs.

### Stale rankings

The ZSET is only as fresh as the last `recompute`. Wire a cron (Phase 4) or have `submissions-go` ZINCRBY on accept.
