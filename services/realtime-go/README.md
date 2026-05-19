# leetrank-realtime-go

WebSocket fan-out for live contests and judge verdicts. Subscribes to redis pubsub channels and broadcasts payloads to authenticated websocket clients.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/realtime/health` | — | Liveness |
| GET | `/v1/realtime/readyz` | — | Redis PING |
| GET | `/v1/realtime/metrics` | — | Prometheus |
| GET | `/v1/realtime` | JWT | WebSocket upgrade |

## WebSocket protocol

Connect with `Authorization: Bearer <jwt>` or `?token=<jwt>`. The JWT must be HS256-signed with `JWT_SECRET`.

Auto-subscribes the caller to `verdicts:user:<sub>` if no `?channels=...` query param is provided.

Client → server (JSON):

```jsonc
{ "action": "subscribe",   "channel": "contests:weekly-42" }
{ "action": "unsubscribe", "channel": "contests:weekly-42" }
{ "action": "ping" }
```

Server → client (JSON):

```jsonc
{ "type": "ack",   "channel": "contests:weekly-42" }
{ "type": "event", "channel": "contests:weekly-42", "payload": { ... } }
{ "type": "pong" }
{ "type": "error", "error": "bad channel" }
```

Allowed channel prefixes: `verdicts:user:`, `contests:`, `problems:`, `global`.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | yes | — | HS256 secret matching the auth/identity service |
| `REDIS_URL` | yes | `redis://localhost:6379/0` | Redis pubsub source |
| `REALTIME_PORT` | no | `4017` | Listen port |
| `CORS_ALLOWED_ORIGINS` | no | `http://localhost:3000` | Origin allow-list for `websocket.Accept` |

## Local dev

```bash
docker compose up realtime-go

# native (Go 1.22+):
JWT_SECRET=dev-secret REDIS_URL=redis://:leetrank-dev@localhost:6379/0 \
go run ./cmd/server
```

Smoke (token from `/api/v1/auth/login`):

```bash
wscat -c "ws://localhost:4017/v1/realtime?token=$JWT&channels=verdicts:user:$UID"
```

## Production runbook

Stateless. Horizontal scale is fine — every replica subscribes to redis pubsub and fans out to its own clients. Sticky sessions are NOT required.

Image: `nguyenson1710/leetrank-realtime-go`. Distroless static, non-root.

### Connections climbing without bound

`/v1/realtime/metrics` exposes `realtime_ws_connections`. If a single replica passes ~5K connections, scale out before you blow the file-descriptor limit.

### Dropped messages

`realtime_ws_messages_dropped_total{channel}` increments when a client send buffer (64 entries) is full. Either the client is too slow or you're publishing too aggressively. Tune `ClientSendBuffer` in `internal/hub/hub.go`.

### `401 unauthorized` from `/v1/realtime`

Means JWT verification failed. Confirm `JWT_SECRET` matches the issuer (`identity` for live tokens). Tokens older than 30 s leeway will fail.
