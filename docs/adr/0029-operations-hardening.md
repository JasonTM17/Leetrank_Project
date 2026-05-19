# 29. Operations hardening — graceful drain, automated PG backups, container resource limits

Date: 2026-05-19

## Status

Accepted

## Context

The 2026-05-18 critic-team review of LeetRank flagged four operational gaps that pushed our prod-readiness score from "good" to "fragile":

| ID | Finding | Impact |
|---|---|---|
| O-01 | Go services call `srv.Shutdown()` immediately on SIGTERM. There is no lame-duck delay, so Caddy keeps routing traffic to a process that is already tearing down its handlers — request bodies in flight are aborted mid-read. | Visible 5xx spikes during every rolling deploy. |
| O-04 | `docs/runbooks/disaster-recovery.md` had RTO=4h / RPO=24h with no drill instructions. Numbers were aspirational, not testable. | DR plan was ceremonial. |
| O-07 | No automated Postgres backup. The runbook itself flagged "run `pg_dump` manually before risky operations" as the only safety net (F-008). | Single-host loss = total data loss. |
| M-04 | `docker-compose.yml` had no healthcheck on the `caddy` service, so `depends_on` ordering and any future orchestrator promotion would treat Caddy as healthy the instant the container started, before it had bound `:80`. | False-green health, hides outages. |

Additionally, the judge service runs untrusted code under nsjail with no container-level cap on memory, CPU, or PIDs. A nsjail escape — or simply a runaway compile — could starve the host. Other Go services had no caps either, which means a single misbehaving service can OOM the host before Compose's restart loop fires.

The composite operations score before this work was approximately 75/100 against our internal rubric (graceful shutdown, backup, runbooks, healthchecks, resource isolation, observability).

## Decision

Land four small, independent changes in one ADR because they are all part of the same operational-readiness sweep:

1. **Graceful shutdown drain in every Go service.** Each service (`auth-go`, `submissions-go`, `problems-go`, `judge-service`) gets:
   - An `atomic.Bool` readiness flag, started `true`.
   - `/healthz` returns 503 once the flag is flipped.
   - On SIGTERM/SIGINT: flip the flag false, sleep `lameDuckDelay = 3 * time.Second`, then call `srv.Shutdown(ctx)` with the existing 15s grace.
   - Caddy's `health_uri` polls `/api/health` for the web service every 30s; service-mesh-style probes for the Go services follow the same readiness contract. The 3s window is enough for one Caddy poll cycle to mark the upstream unhealthy and steer new traffic to siblings.

2. **Automated Postgres backup.** A new `.github/workflows/postgres-backup.yml` runs nightly at 03:00 UTC plus on-demand. It boots an ephemeral Postgres 16, applies the Prisma schema, dumps a `--format=custom --compress=9` artifact, and uploads it via `actions/upload-artifact@v4` with 30-day retention. If `BACKUP_DATABASE_URL` is set, it dumps the staging DB too. Real S3 push is gated on `AWS_ACCESS_KEY_ID` + `BACKUP_S3_BUCKET` secrets — left unset, the workflow degrades gracefully to GitHub-hosted artifacts only.

   Two helper scripts ship alongside:
   - `scripts/backup-postgres.sh` — `pg_dump` + optional age/gpg encryption + optional S3 upload + local retention sweep.
   - `scripts/restore-postgres.sh` — reverse path with `pg_restore`, decrypts `.age` / `.gpg` inputs.

3. **Container resource limits.** `docker-compose.yml` now caps:
   - `judge`: `mem_limit: 1g`, `cpus: 2.0`, `pids_limit: 1024` (priority because of untrusted code).
   - `identity` / `submissions` / `problems` (Go services): `mem_limit: 512m`, `cpus: 1.0`, `pids_limit: 512`.

4. **Caddy healthcheck.** `caddy` service in compose now probes `http://localhost:80/healthz` (the existing public liveness endpoint inside the Caddyfile) every 30s.

5. **Runbook update.** `docs/runbooks/disaster-recovery.md` now states RTO=30min, RPO=24h, includes a copy-paste restore drill that boots an isolated `COMPOSE_PROJECT_NAME=leetrank-drill` stack, and reserves a "Last drill date" line for tracking.

## Consequences

**Positive:**
- Rolling deploys stop bleeding 5xx during pod swap-out — the 3s drain plus existing 15s shutdown grace covers every realistic in-flight request.
- F-008 is closed against a verifiable artifact pipeline. The 30-day retention via GH Actions is the floor; S3 export is wired, just gated on credentials.
- Judge can no longer fork-bomb the host or eat all RAM. A misbehaving Go service can OOM only itself.
- DR plan is now drillable in under 30 minutes — restore a real dump into an isolated compose project and validate against `/readyz`.
- Caddy healthcheck closes the false-green gap; future promotion to a real orchestrator inherits a working liveness contract.

**Negative:**
- Container memory caps add risk of OOM-kill if traffic spikes. Mitigation: limits are headroom-padded against current p99 RSS; bump the cap before bumping traffic, and watch `container_memory_usage_bytes` in Prometheus.
- The 3s lame-duck delay extends every shutdown by 3s. Negligible for prod but visible in tight CI loops.
- GH Actions artifact retention is 30 days. Anything older requires the S3 path (still credential-gated).

**Neutral:**
- Backup encryption is opt-in via `BACKUP_PUBKEY`. We chose not to force it for the CI smoke dumps because the artifact is already private to the repo.
- Lame-duck delay is a constant rather than env-tunable. If we need to flex it per-environment later we can promote it to a config value; for now the 3s default matches Caddy's poll cadence and YAGNI applies.

## Alternatives considered

| Alternative | Why rejected |
|-------------|-------------|
| Use Kubernetes `preStop` hook + readiness gate instead of in-process drain | We are not on k8s yet (ADR 0023). Building the drain in-process is portable and lets compose, k8s, and Nomad all reuse the same contract. |
| Continuous WAL archiving / PITR for backups | Correct end-state (F-009) but requires either a managed PG or `wal-g` + S3 plumbing. Out of scope for this ADR; nightly logical dumps are the floor. |
| Move backups to a managed service (Neon, RDS) | Would solve F-008 + F-009 in one shot but requires a migration off self-hosted Compose. Tracked separately; not blocking this hardening pass. |
| Use Docker `deploy.resources.limits` (Swarm syntax) instead of `mem_limit` / `cpus` | Compose v2 still respects the legacy keys for non-Swarm runs; Swarm-only `deploy:` is silently ignored on `docker compose up`. We picked the keys that actually fire today. |
| Skip Caddy healthcheck because Caddy "doesn't really need one" | The healthcheck isn't for Caddy itself — it's for any future orchestrator that uses `depends_on` ordering or restart-on-unhealthy. Cheap insurance. |

## Follow-ups

- Wire `AWS_ACCESS_KEY_ID` + `BACKUP_S3_BUCKET` repo secrets to flip on offsite uploads.
- Run the first restore drill and stamp `docs/runbooks/disaster-recovery.md` with a real "Last drill date".
- Promote `lameDuckDelay` to env (`SHUTDOWN_LAME_DUCK_MS`) only if a real environment needs to flex it.
- Track p99 RSS for each service post-deploy; tighten or relax the `mem_limit` based on a week of data.
