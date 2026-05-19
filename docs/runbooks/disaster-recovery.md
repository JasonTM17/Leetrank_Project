# Disaster Recovery Runbook

Procedures for recovering the LeetRank stack from data loss, service compromise, or full host failure.

---

## RTO / RPO targets

| Target | Value | Notes |
|---|---|---|
| RTO (Recovery Time Objective) | **30 minutes** | Time from incident declaration to service restored. Achievable when (a) latest dump is local + decrypted, (b) Docker Hub images are reachable, (c) DNS TTL ≤ 300s. |
| RPO (Recovery Point Objective) | **24 hours** | Maximum acceptable data loss. Anchored to the daily 03:00 UTC `postgres-backup` workflow (`.github/workflows/postgres-backup.yml`, ADR 0029). Tighten to 1h once WAL archiving / PITR (F-009) lands. |

These are the operational targets after ADR 0029. They assume a single-host Docker Compose deployment with the daily GH Actions backup. Automated backup (F-008 — addressed) and a staging environment (F-051) are prerequisites for reliably meeting these targets.

**Last restore drill:** _pending_ — file the result at `docs/post-mortems/YYYY-MM-DD-dr-drill.md` and update this line.

---

## Backup inventory

| Asset | Location | Cadence | Status |
|---|---|---|---|
| Postgres data | `postgres_data` Docker volume (local) | Manual only | **Gap: F-008 — automated backup not yet implemented** |
| Redis AOF | `redis_data` Docker volume (local) | Continuous (AOF) | Local only; no off-site copy (F-010) |
| Container images | Docker Hub (`jasontm17/leetrank-*`) | On every push to `main` | `latest` + SHA tag |
| Application code | GitHub (`JasonTM17/LeetRank_Project`) | On every push | Primary source of truth |
| Caddy TLS certs | `caddy_data` Docker volume (local) | Auto-renewed by Caddy | Regenerated automatically if lost |

> **Critical gap:** Postgres has no automated off-site backup. Until F-008 is resolved, run a manual `pg_dump` before any risky operation and store the dump off-host.

---

## Restore scenario 1: Postgres corruption or ransomware

**Symptoms:** Postgres fails to start, data files are corrupted, or the volume is encrypted by ransomware.

**Prerequisites:** A `pg_dump` backup file (`.sql.gz`) taken before the incident.

```bash
# 1. Stop all services that use Postgres
docker compose stop app api auth

# 2. Remove the corrupted volume
docker compose down
docker volume rm leetrank_project_postgres_data

# 3. Start only Postgres (creates a fresh empty volume)
docker compose up -d postgres
docker compose exec postgres pg_isready -U leetrank -d leetrank

# 4. Restore from the latest dump
gunzip -c leetrank-<timestamp>.sql.gz \
  | docker compose exec -T postgres psql -U leetrank -d leetrank

# 5. Run Prisma migrations to ensure schema is current
docker compose run --rm api npx prisma migrate deploy

# 6. Restart all services
docker compose up -d

# 7. Verify health
curl http://localhost:4000/readyz | jq
curl http://localhost:4001/readyz | jq
curl http://localhost:3000/api/health
```

**Data loss:** Everything since the last dump. With no automated backup, this could be up to 24 hours (RPO).

---

## Restore scenario 2: Single service compromise

**Symptoms:** One container is behaving unexpectedly, shows signs of compromise, or is running unknown processes.

**Principle:** Rebuild from the known-good Docker Hub image pinned to a specific SHA. Do not attempt to repair a potentially compromised container in place.

```bash
# 1. Identify the compromised service (e.g., api)
docker compose ps

# 2. Stop and remove the container
docker compose stop api
docker compose rm -f api

# 3. Pull the last known-good image by SHA
# Find the SHA from the GitHub Actions run that preceded the incident
docker pull jasontm17/leetrank-api:<sha>

# 4. Update docker-compose.yml to pin the image to the known-good SHA
# (temporarily override the build: block with image: jasontm17/leetrank-api:<sha>)

# 5. Start the service from the pinned image
docker compose up -d api

# 6. Verify health
curl http://localhost:4000/healthz | jq

# 7. Rotate JWT_SECRET and DATABASE_URL password if the service had access to them
# Update .env, then restart all services
docker compose up -d
```

**After recovery:** File a post-mortem. Investigate how the compromise occurred. Check whether secrets need rotation.

---

## Restore scenario 3: Full host loss

**Symptoms:** The VM or physical host is unrecoverable (hardware failure, provider incident, accidental deletion).

**Prerequisites:**
- A Postgres dump stored off-host (or accept data loss up to RPO).
- Docker and Docker Compose installed on the new host.
- `.env` file with all secrets (stored securely off-host — never in the repo).
- DNS A record pointing to the new host's IP.

```bash
# On the new host:

# 1. Install Docker Engine 24+ and Docker Compose v2.20+
# (follow https://docs.docker.com/engine/install/)

# 2. Clone the repository
git clone https://github.com/JasonTM17/LeetRank_Project.git
cd LeetRank_Project

# 3. Restore .env from secure storage
# (copy your .env file to the project root)

# 4. Pull images from Docker Hub (faster than rebuilding)
docker compose pull

# 5. Start infrastructure services first
docker compose up -d postgres redis
# Wait for postgres to be healthy
docker compose ps postgres

# 6. Restore Postgres from the latest dump
gunzip -c /path/to/leetrank-<timestamp>.sql.gz \
  | docker compose exec -T postgres psql -U leetrank -d leetrank

# 7. Run migrations
docker compose run --rm api npx prisma migrate deploy

# 8. Start all services
docker compose up -d

# 9. Verify health
curl http://localhost/healthz
curl http://localhost:4000/readyz | jq

# 10. Update DNS A record to point to the new host IP
# Caddy will automatically obtain a new TLS certificate once DNS propagates
```

**Estimated time:** 1–2 hours (excluding DNS propagation, which can take up to 48 hours).

---

## Restore scenario 4: Code repository loss

**Symptoms:** The GitHub repository is deleted, corrupted, or inaccessible.

```bash
# Option A: Restore from a local clone
# If any developer has a recent local clone:
git remote set-url origin https://github.com/JasonTM17/LeetRank_Project.git
git push --mirror origin

# Option B: Restore from Docker Hub images
# The images on Docker Hub contain the compiled application.
# Source code can be extracted from the image layers (partial recovery):
docker create --name tmp jasontm17/leetrank-api:latest
docker cp tmp:/app ./recovered-api
docker rm tmp

# Option C: Restore from GitHub forks
# If forks exist, clone from a fork and push to a new repo:
gh repo create JasonTM17/LeetRank_Project --public
git clone https://github.com/<fork-owner>/LeetRank_Project.git
cd LeetRank_Project
git remote set-url origin https://github.com/JasonTM17/LeetRank_Project.git
git push --mirror origin
```

**Prevention:** Ensure at least one developer maintains a local clone that is pulled regularly.

---

## Communication plan

When a SEV1 or SEV2 incident is declared:

1. **First contact:** Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)
2. **Status updates:** Post to the incident channel every 30 minutes until resolved.
3. **User communication template:**

```
[LeetRank Status Update — <timestamp>]

We are currently experiencing <brief description of impact>.
Affected: <list of affected features>
Status: Investigating / Mitigating / Resolved
ETA: <estimated resolution time or "unknown">
Next update: <time of next update>
```

> **Gap (F-041):** No public status page is configured. Until one exists, communicate via GitHub Issues or direct contact.

---

## Restore drill — step by step

Run quarterly (or after any major schema change). The drill must hit RTO=30min wall-clock from the moment you start the timer.

```bash
# 0. Start the timer.
date -u +%Y-%m-%dT%H:%M:%SZ | tee /tmp/dr-drill-start.txt

# 1. Pull the latest dump artifact from the postgres-backup workflow.
gh run list --workflow=postgres-backup.yml --limit 1 --json databaseId -q '.[0].databaseId'
gh run download <RUN_ID> -n postgres-backup-<RUN_ID> -D /tmp/dr-drill

# 2. Spin up an isolated drill stack on a test compose project name to avoid
#    clobbering the live volumes.
COMPOSE_PROJECT_NAME=leetrank-drill docker compose -f docker-compose.yml up -d postgres
COMPOSE_PROJECT_NAME=leetrank-drill docker compose exec postgres pg_isready -U leetrank -d leetrank

# 3. Restore from the dump using the helper script.
DATABASE_URL="postgresql://leetrank:leetrank-dev@127.0.0.1:5432/leetrank?schema=public" \
  RESTORE_CLEAN=1 \
  bash scripts/restore-postgres.sh /tmp/dr-drill/leetrank-*.dump

# 4. Boot the rest of the stack against the restored DB and run smoke checks.
COMPOSE_PROJECT_NAME=leetrank-drill docker compose up -d
curl -fsS http://localhost:4000/readyz | jq
curl -fsS http://localhost:4011/readyz | jq
curl -fsS http://localhost:4013/readyz | jq

# 5. Spot-check user counts and recent submissions match the source dump.
COMPOSE_PROJECT_NAME=leetrank-drill docker compose exec postgres \
  psql -U leetrank -d leetrank -c "select count(*) from \"User\"; select max(\"createdAt\") from \"Submission\";"

# 6. Stop the timer; record duration in the post-mortem.
date -u +%Y-%m-%dT%H:%M:%SZ | tee /tmp/dr-drill-end.txt

# 7. Tear down the drill stack and free the volumes.
COMPOSE_PROJECT_NAME=leetrank-drill docker compose down -v
```

If wall-clock exceeded RTO=30min, file a finding in the post-mortem with the slow step (download? restore? schema migrate? smoke?) and add a follow-up issue.

---

## Drill cadence

| Drill type | Frequency | Description |
|---|---|---|
| Tabletop exercise | Quarterly | Walk through a scenario verbally; identify gaps without executing |
| Backup restore test | Quarterly | Restore a Postgres dump to a test environment; verify data integrity |
| Full restore drill | Annually | Execute scenario 3 (full host loss) on a spare VM |

Record drill results in `docs/post-mortems/YYYY-MM-DD-dr-drill.md`.

---

## Open gaps from prod-readiness audit (2026-05-18)

The following items from the prod-readiness audit directly affect DR posture. They must be resolved before this runbook can be considered reliable.

| ID | Finding | Priority |
|---|---|---|
| F-008 | No automated Postgres backup | Blocker |
| F-010 | No off-site Redis backup | Major |
| F-019 | Alertmanager not configured — no paging | Blocker |
| F-020 | No paging webhook (Slack/PagerDuty) | Blocker |
| F-034 | RTO/RPO were undefined (now documented here) | Blocker — addressed |
| F-037 | Per-service runbooks missing (now written) | Blocker — addressed |
| F-038 | On-call rotation undefined | Blocker |
| F-041 | No status page | Major |
| F-051 | No staging environment | Major |
| F-072 | DR doc missing (this document) | Blocker — addressed |
| F-009 | No PITR (point-in-time recovery) | Major |
| F-011 | No pgBouncer (connection storm risk) | Major |

---

## See also

- [`postgres.md`](postgres.md) — detailed Postgres restore steps
- [`redis.md`](redis.md) — Redis AOF restore steps
- [`incident-response.md`](incident-response.md) — incident severity and roles
- [`docker.md`](docker.md) — general Docker Compose operations

---

_Author: Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)_
