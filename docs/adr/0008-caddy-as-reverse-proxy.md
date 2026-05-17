# 0008. Caddy as Reverse Proxy

Date: 2026-05-17
Status: Accepted

## Context

LeetRank needs a reverse proxy in front of the Next.js app and judge service to handle:

- TLS termination with automatic certificate provisioning and renewal
- HTTP → HTTPS redirects
- Routing `/api/judge/*` to the judge service on port 9090 and all other traffic to the Next.js app on port 3000
- Static asset caching headers

The current `docker-compose.yml` exposes ports 3000 and 9090 directly, which is acceptable for development but not for production where TLS is required and the judge service should not be publicly reachable.

## Decision

Use **Caddy 2** as the reverse proxy. Caddy will be added as a service in `docker-compose.prod.yml`, listening on ports 80 and 443. A `Caddyfile` in the repo root will define the routing rules. Caddy's automatic HTTPS feature provisions Let's Encrypt certificates without any manual configuration.

The judge service port (9090) will be removed from the public compose port mapping; only Caddy will reach it via the internal Docker network.

## Consequences

- **Easier:** Zero-config TLS — Caddy handles ACME challenges, certificate renewal, and HTTPS redirects automatically. The `Caddyfile` syntax is significantly simpler than Nginx config. No certbot cron job needed.
- **Harder:** Caddy is less widely known than Nginx; some operators may be unfamiliar with `Caddyfile` syntax. Caddy's automatic HTTPS requires the server to be reachable on port 80 for ACME HTTP-01 challenges.
- **Risk:** Caddy stores certificates in a local directory by default. In a multi-instance deployment, a shared volume or Caddy's clustering support is needed to avoid each instance requesting its own certificate.

## Alternatives considered

- **Nginx** — battle-tested and widely understood, but TLS certificate management requires certbot, a cron job, and manual renewal configuration. More verbose config for simple proxy rules. Rejected to reduce operational overhead.
- **Traefik** — excellent Docker-native auto-discovery via labels, but the configuration model (providers, entrypoints, routers, middlewares) is more complex than needed for two upstream services. Rejected.
- **AWS ALB / Cloudflare** — valid for cloud deployments but introduces external dependencies. The self-hosted compose stack should work without a cloud provider.
