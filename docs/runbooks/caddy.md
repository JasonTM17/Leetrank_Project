# Caddy Runbook

Quick reference for operating the LeetRank Caddy 2 reverse proxy in production.

---

## What it does

Caddy is the public-facing reverse proxy for LeetRank. It terminates TLS (via ACME/Let's Encrypt), enforces security headers, applies coarse rate limits on auth and admin paths, and routes traffic to the correct backend service. It is the only service with ports 80 and 443 exposed to the internet.

---

## Routing table

All routing is defined in [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile).

| Path pattern     | Backend         | Notes                                                            |
| ---------------- | --------------- | ---------------------------------------------------------------- |
| `/healthz`       | Caddy itself    | Returns `ok 200` — no backend involved                           |
| `/api/v1/auth/*` | `identity:4011` | Canonical auth (services/auth-go); apps/auth retired in ADR 0027 |
| `/api/v1/*`      | `api:4000`      | Ported REST API endpoints                                        |
| `/*` (catch-all) | `app:3000`      | Next.js frontend + legacy API routes                             |

The `handle_path` directives strip the matched prefix before forwarding. For example, `/api/v1/problems` is forwarded to `api:4000` as `/problems`.

---

## TLS certificate renewal

Caddy handles TLS automatically via ACME (Let's Encrypt TLS-ALPN challenge). No manual renewal is needed as long as:

1. Port 443 is reachable from the internet.
2. `PUBLIC_HOSTNAME` in `.env` matches the DNS A record.
3. `ACME_EMAIL` in `.env` is a valid address (used for expiry notifications).

Caddy stores certificates in the `caddy_data` Docker volume. Certificates are renewed automatically 30 days before expiry.

### Verify certificate status

```bash
# Check Caddy logs for TLS activity
docker compose logs caddy | grep -i "tls\|cert\|acme\|renew"

# Check certificate expiry (replace <hostname> with your domain)
echo | openssl s_client -connect <hostname>:443 -servername <hostname> 2>/dev/null \
  | openssl x509 -noout -dates
```

### Force certificate renewal

```bash
# Reload Caddy config (triggers renewal check)
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

# If renewal is stuck, restart Caddy (it will re-attempt on startup)
docker compose restart caddy
```

> **Gap (F-099):** No alert is configured for certificate expiry. Add a synthetic monitor or Prometheus alert on cert expiry days remaining.

---

## Health check

Caddy exposes a `/healthz` endpoint that responds `ok 200` directly without proxying to any backend. Use this for load balancer and uptime monitor probes.

```bash
# Liveness check (no backend dependency)
curl http://localhost/healthz
# Expected: ok

# HTTPS (production)
curl https://<hostname>/healthz
```

---

## Rate limit rules

Defined in the Caddyfile:

| Zone        | Matcher                         | Limit       | Window          |
| ----------- | ------------------------------- | ----------- | --------------- |
| `auth_zone` | `path /api/auth/* /api/admin/*` | 30 requests | 1 minute per IP |

This is a first-line defense. Per-IP rate limiting is also enforced inside `apps/api` and `services/auth-go` (identity).

> **Note:** The Caddyfile matcher uses `/api/auth/*` and `/api/admin/*`. The auth service is routed via `/api/v1/auth/*`. These are different paths — the rate limit currently applies to legacy paths, not the new `/api/v1/auth/*` path. This should be reconciled when Phase 3.1.5 completes.

---

## Caddy admin API

The Caddy admin API runs on `:2019` inside the container. It is **not** exposed in the compose file (no `ports:` mapping for 2019).

To use the admin API for live config reload or diagnostics:

```bash
# Reload config without restart (runs inside the container)
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

# Check running config
docker compose exec caddy caddy adapt --config /etc/caddy/Caddyfile --pretty

# Validate config syntax
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
```

> **Gap (F-022):** Prometheus is configured to scrape `caddy:2019` for metrics, but the admin port is not exposed on the Docker network to Prometheus. Caddy metrics scraping is currently broken. Fix by adding `caddy` to the observability network or enabling the Prometheus plugin in the Caddyfile.

---

## Common 502 / 503 errors

### 502 Bad Gateway

Caddy received a connection error from the backend.

**Triage:**

```bash
# 1. Identify which backend is failing from Caddy logs
docker compose logs --tail=100 caddy | grep -i "502\|upstream\|dial\|refused"

# 2. Check the backend service
docker compose ps app api auth

# 3. Test the backend directly
curl http://localhost:3000/api/health   # app
curl http://localhost:4000/healthz      # api
curl http://localhost:4011/healthz      # identity

# 4. Restart the failing backend
docker compose restart <service>
```

### 503 Service Unavailable

Usually means the backend is up but not yet healthy (slow start), or Caddy's health check is failing.

The `app` backend has a health check configured in the Caddyfile:

```
health_uri /api/health
health_interval 30s
health_timeout 5s
```

Caddy will stop sending traffic to `app:3000` if `/api/health` fails. Check:

```bash
curl http://localhost:3000/api/health
docker compose logs --tail=50 app
```

### Backend slow start

Caddy starts before `app` is healthy (compose `depends_on` only waits for the `app` healthcheck, not Caddy's own health probe). During the first 40 seconds after `app` starts, Caddy may return 502.

This is expected behavior. Wait for `app` to pass its healthcheck:

```bash
docker compose ps app
# Wait until Status shows "healthy"
```

---

## Security headers

Caddy sets the following headers on all responses:

| Header                      | Value                                                           |
| --------------------------- | --------------------------------------------------------------- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload`                  |
| `X-Content-Type-Options`    | `nosniff`                                                       |
| `X-Frame-Options`           | `DENY`                                                          |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                               |
| `Content-Security-Policy`   | See Caddyfile (includes `unsafe-inline`, `unsafe-eval` — F-063) |
| `Server`                    | Removed                                                         |

> **Gap (F-063):** CSP includes `unsafe-inline` and `unsafe-eval` site-wide. These are required by Next.js hydration and Monaco Editor respectively. Tighten once Next.js ships nonce support.

---

## Recent incidents

_No incidents recorded yet. File post-mortems under `docs/post-mortems/YYYY-MM-DD-slug.md`._

---

## Useful commands

```bash
# Stream logs
docker compose logs -f caddy

# Validate Caddyfile syntax
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile

# Reload config (no restart needed)
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

# Restart Caddy
docker compose restart caddy

# Check TLS certificate expiry
echo | openssl s_client -connect <hostname>:443 -servername <hostname> 2>/dev/null \
  | openssl x509 -noout -dates
```

---

## See also

- [`docker.md`](docker.md) — general Docker Compose operations
- [`docs/adr/0008-caddy-as-reverse-proxy.md`](../adr/0008-caddy-as-reverse-proxy.md)
- [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile)

---

_Author: Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)_
