# Incident Response Runbook

Process for declaring, managing, and closing incidents on the LeetRank stack.

---

## Severity levels

| Level | Name | Definition | Examples | Response time |
|---|---|---|---|---|
| SEV1 | Critical | Complete service outage or data loss in progress | All services down, Postgres corrupted, active ransomware | Immediate — drop everything |
| SEV2 | Major | Significant degradation affecting most users | API returning 5xx for >10% of requests, auth service down, judge not executing | Within 15 minutes |
| SEV3 | Minor | Partial degradation; workaround exists | Slow queries on one endpoint, judge rejecting some IPs, Redis evictions | Within 2 hours |
| SEV4 | Low | Cosmetic or non-user-facing issue | Broken dashboard panel, stale metrics, log noise | Next business day |

---

## Roles

| Role | Responsibility |
|---|---|
| **Incident Commander** | Declares severity, coordinates response, makes go/no-go decisions, owns communication |
| **Scribe** | Records timeline, decisions, and actions in the incident document in real time |
| **Communicator** | Sends status updates to stakeholders; owns the status page (once F-041 is resolved) |
| **Ops** | Executes technical actions: restarts, rollbacks, log analysis, config changes |

For a solo operator (current state), one person fills all roles. Prioritize: Commander → Ops → Scribe.

---

## Incident template

Copy this template to a new file at `docs/post-mortems/YYYY-MM-DD-<slug>.md` when an incident is declared. Fill it in during the incident; complete it within 48 hours of resolution.

```markdown
# Incident: <short title>

**Date:** YYYY-MM-DD
**Severity:** SEV1 / SEV2 / SEV3 / SEV4
**Duration:** HH:MM (from detection to resolution)
**Commander:** <name>
**Scribe:** <name>

## Trigger

<What caused the alert or report? Who noticed first?>

## Timeline

| Time (UTC) | Event |
|---|---|
| HH:MM | Incident detected |
| HH:MM | Commander declared SEV<N> |
| HH:MM | <action taken> |
| HH:MM | Service restored |
| HH:MM | Incident closed |

## Impact

<What was affected? How many users? What data was at risk?>

## Initial diagnosis

<What did you check first? What did the logs/metrics show?>

## Mitigation

<What stopped the bleeding? Restart, rollback, config change?>

## Resolution

<What fully fixed the issue?>

## Root cause

<Why did this happen? Be specific — not "human error" but what decision or gap enabled it.>

## Action items

| Item | Owner | Due date |
|---|---|---|
| <fix or prevention measure> | <name> | YYYY-MM-DD |

## Post-mortem link

This document is the post-mortem. Filed at: `docs/post-mortems/YYYY-MM-DD-<slug>.md`
```

---

## Response procedure

### 1. Detect

Alerts come from Prometheus (once Alertmanager is configured — F-019). Until then, detection is manual: health check failures, user reports, or log monitoring.

```bash
# Quick stack health check
docker compose ps
curl http://localhost/healthz
curl http://localhost:4000/readyz | jq
curl http://localhost:4001/readyz | jq
curl http://localhost:9090/health | jq
```

### 2. Declare

Assess severity using the table above. Declare the incident and open the incident document.

Notify Nguyễn Sơn (jasonbmt06@gmail.com) for SEV1 and SEV2.

### 3. Diagnose

Check logs and metrics for the affected service. Use the per-service runbooks:

- API issues: [`api.md`](api.md)
- Auth issues: [`auth.md`](auth.md)
- Judge issues: [`judge.md`](judge.md)
- Database issues: [`postgres.md`](postgres.md)
- Cache issues: [`redis.md`](redis.md)
- Routing/TLS issues: [`caddy.md`](caddy.md)
- Data loss / host failure: [`disaster-recovery.md`](disaster-recovery.md)

```bash
# Tail all service logs simultaneously
docker compose logs -f --tail=50 app api auth judge postgres redis caddy
```

### 4. Mitigate

Take the fastest action that stops user impact, even if it is not the root-cause fix. Common mitigations:

- Restart a crashed service: `docker compose restart <service>`
- Roll back to the previous image: `docker compose pull <service> && docker compose up -d <service>`
- Redirect traffic: update the Caddyfile to bypass a broken backend.

### 5. Resolve

Fix the root cause. Verify with health checks and metrics.

### 6. Close

- Confirm all services are healthy.
- Send a final status update.
- Complete the incident document within 48 hours.
- Create action items for any gaps exposed.

---

## Post-mortem format (blameless)

Post-mortems are blameless. The goal is to understand what happened and prevent recurrence — not to assign fault.

File post-mortems at `docs/post-mortems/YYYY-MM-DD-<slug>.md`. Use the incident template above.

**Blameless principles:**
- Describe what happened, not who caused it.
- Assume everyone acted with the information they had at the time.
- Focus action items on systems, processes, and tooling — not individuals.
- Publish post-mortems internally so the team learns from them.

---

## Escalation

| Condition | Action |
|---|---|
| SEV1 not mitigated within 30 minutes | Escalate to Nguyễn Sơn directly |
| Data loss confirmed | Invoke [`disaster-recovery.md`](disaster-recovery.md) immediately |
| Security compromise suspected | Isolate the affected container, rotate all secrets, then diagnose |
| Cannot determine root cause | Restore service first, then investigate from logs/metrics |

---

## Open gaps

| ID | Gap | Impact on IR |
|---|---|---|
| F-017 | No Sentry/error tracking | No automatic error aggregation; must grep logs manually |
| F-019 | Alertmanager not configured | No automatic paging; incidents detected manually |
| F-020 | No paging webhook | No Slack/PagerDuty notification on alert fire |
| F-038 | On-call rotation undefined | No formal escalation path |
| F-041 | No status page | Cannot communicate status to users |

---

## See also

- [`disaster-recovery.md`](disaster-recovery.md) — DR scenarios
- [`api.md`](api.md), [`auth.md`](auth.md), [`judge.md`](judge.md) — per-service runbooks
- [`postgres.md`](postgres.md), [`redis.md`](redis.md), [`caddy.md`](caddy.md) — infrastructure runbooks
- [`docker.md`](docker.md) — general Docker Compose operations

---

_Author: Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)_
