# 23. Multi-region readiness plan

Date: 2026-05-19

## Status

Proposed. Not implemented; this ADR captures the staged plan so the team avoids design choices that paint us into a corner.

## Context

LeetRank today is single-region (one Postgres primary, one Redis primary, all services co-located in one DC). That's correct for our current scale. As we add international users, three pressure points appear:

1. **Latency.** A user in Singapore hitting a US-East-1 backend pays 200+ ms RTT per request. SSR pages and judge submissions feel sluggish.
2. **Resilience.** A regional outage takes the entire platform offline, with no graceful degradation.
3. **Compliance.** GDPR and emerging APAC data-residency rules require user PII to remain in-region.

The temptation is to bolt on read replicas and call it multi-region. That works for stateless reads and breaks for everything else — judge dispatch, rating updates, contest write paths.

## Decision

Define a **three-stage rollout** rather than a flag-day cutover. Each stage is independently shippable and reversible.

### Stage 1 — Read-replica reach (no code changes)

- Provision Postgres read replicas in 2 secondary regions.
- Add a read-only Caddy POP per region that proxies stateless reads (`apps/api`, `services/problems-go`) to the in-region replica.
- Writes remain single-primary; the gateway routes mutating verbs to the home region.
- Redis stays single-region.

This buys ~70% of the latency win for the read-heavy traffic without touching application code.

### Stage 2 — Active-active reads, single-primary writes

- Deploy full service stacks (web + api + auth + problems-go + submissions-go) per region.
- Each stack reads from its in-region Postgres replica and Redis replica.
- Writes still funnel to the home-region primary via service-to-service RPC over the platform's private mesh.
- Sticky-route logged-in users to a "home region" derived at signup; this avoids cross-region session-cookie fights.
- Add `X-Region` headers and per-region Prometheus stacks; dashboards split by region.

Stage 2 requires:

- Service-to-service auth that survives the cross-region hop. Already covered by [ADR 0013](0013-service-to-service-auth.md) (Ed25519 JWKS).
- A region-aware CDN or anycast frontend (Cloudflare / Fly Anycast / AWS Global Accelerator). Caddy on its own can't do anycast.

### Stage 3 — Multi-primary or partitioned writes

Two viable shapes; pick one based on Stage-2 telemetry:

- **Multi-primary Postgres** (Citus, YugabyteDB, or Aurora Limitless). Application stays single-logical-database; the storage layer handles geo-partitioning. Highest engineering cost, lowest application complexity.
- **Application-level partitioning.** Hard-partition users to a home region; cross-region operations (global leaderboard, cross-region contest) become async aggregates. Lower storage cost, higher application complexity.

Defer the choice until Stage-2 data tells us which traffic class actually needs write locality.

## Consequences

**Positive at every stage:**

- Latency wins for the dominant traffic class (reads) without write-path complexity.
- Failure-domain isolation: a regional outage degrades to single-region read-only, not full unavailability.
- A clear reversal path at each stage — Stage 1 fails closed by routing everything home; Stage 2 fails closed by demoting the bad region to read-only.

**Negative:**

- Operational complexity grows linearly per region. Need region-aware deploy tooling, per-region observability, per-region secrets distribution.
- Stage 3 in either form is a multi-quarter project. Don't promise it on a timeline until Stage 2 is shipped and stable.
- Replication lag is now a user-visible product surface. The leaderboard ZSET (see [ADR 0022](0022-leaderboard-caching-strategy.md)) needs explicit region semantics; either eventually-consistent ("rankings update within ~30 s globally") or pinned-to-home.

**Neutral:**

- The application services are already stateless and horizontally scalable. The blocker is the data tier, not the compute tier.

## Engineering invariants to preserve now

These keep Stage 1 and Stage 2 reachable later. Adopt them in code review starting today:

- No `localhost`-baked DB connection strings. Connection strings come from env. (Done.)
- No assumption of a single Redis. Pick keys with multi-region awareness — prefix all keys with their scope (`lb:global:`, `lb:region:apac:`).
- No service-to-service calls that assume same-process or same-host. Already enforced by the ADR 0011 split.
- Idempotent write endpoints. Submission creation already uses a client-supplied UUID; preserve that pattern for new writes.
- Time stamps in UTC; never persist local time. (Done.)
- No region-specific code paths in services. Region awareness lives in the gateway and config, not in handler logic.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Single-region forever | Latency and compliance pressure already visible; deferring just makes it harder later. |
| Skip Stage 1/2 and go to multi-primary | High engineering cost upfront; we don't yet have the telemetry to choose between multi-primary models. |
| Edge-only deployment (no DB in-region) | Solves nothing — every request still pays the cross-region DB hop. |
| Vendor-locked solution (e.g. Vercel global functions) | Incompatible with the self-host requirement and ADR 0011's container-first stance. |
