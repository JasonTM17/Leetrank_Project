# Judge Service Runbook (`judge-service`)

Quick reference for operating the LeetRank code-execution judge in production.

---

## What it does

`judge-service` is a Go HTTP server on port 9090 that executes user-submitted code against test cases in a sandboxed environment. It supports 30+ languages via per-language runner scripts (Python, JavaScript, Ruby) and a registry-driven executor for compiled/interpreted languages (Go, C, C++, Rust, Java, PHP, TypeScript, SQL, and more). Each submission is security-checked against per-language dangerous-pattern blocklists before execution. Concurrency is bounded by `JUDGE_GLOBAL_MAX` (global slot cap) and `JUDGE_PER_IP_MAX` (per-IP slot cap). The service is internal — it is not exposed through Caddy and is only reachable from `app` and `api` on the Docker network.

---

## Health endpoint

| Endpoint | Purpose | Expected response |
|---|---|---|
| `GET /health` | Liveness + scheduler snapshot | `200 {"status":"ok","service":"leetrank-judge","scheduler":{...}}` |

```bash
# Health check
curl http://localhost:9090/health | jq

# Scheduler snapshot (shows in-flight and queued counts)
curl http://localhost:9090/health | jq '.scheduler'
```

The scheduler snapshot includes current in-flight count and per-IP slot usage. Use it to diagnose concurrency exhaustion.

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `RUNNER_TIMEOUT` | `5` | Per-test-case timeout in seconds |
| `JUDGE_GLOBAL_MAX` | `16` | Max concurrent executions across all IPs |
| `JUDGE_PER_IP_MAX` | `4` | Max concurrent executions per IP |
| `JUDGE_QUEUE_WAIT_MS` | `10000` | Max time (ms) a request waits for a slot before 503 |
| `JUDGE_PORT` | `9090` | Listening port |

---

## Common alerts

All alert definitions live in [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml).

### `ServiceDown` (severity: critical) — `job=judge`

**Condition:** `up == 0` for `job=judge` for 2 minutes.

**Meaning:** Prometheus cannot scrape `judge:9090`. The container is down or crashed.

> **Note:** The judge service does not expose a `/metrics` endpoint today — Prometheus scrapes `/metrics` on `judge:9090` per `prometheus.yml` but the judge does not implement it. `ServiceDown` fires when the scrape target is unreachable (container down), not on metric absence. This is a known gap (F-037 adjacent).

**Triage:**

```bash
# 1. Check container state
docker compose ps judge

# 2. Tail recent logs
docker compose logs --tail=100 judge

# 3. Manual health check
curl http://localhost:9090/health | jq

# 4. Restart if stopped/exited
docker compose up -d judge

# 5. Check for toolchain startup failures
docker compose logs judge | grep -i "error\|fatal\|loadLanguageRegistry"
```

Escalate to Nguyễn Sơn (jasonbmt06@gmail.com) if the service does not recover within 10 minutes.

---

### `JudgeRejectionRate` (severity: warning)

**Condition:** `rate(leetrank_judge_rejections_total[5m]) > 1` — more than 1 rejection per second for 5 minutes.

**Meaning:** The scheduler is refusing requests because all concurrency slots are occupied. Either traffic is spiking or executions are hanging (timeout not firing, zombie processes).

**Triage:**

```bash
# 1. Check scheduler state
curl http://localhost:9090/health | jq '.scheduler'

# 2. Check for zombie judge processes
docker compose exec judge ps aux | grep -E "python3|node|ruby|gcc|g\+\+|rustc|java"

# 3. Check RUNNER_TIMEOUT is set correctly
docker compose exec judge env | grep RUNNER_TIMEOUT

# 4. Check for hung temp files (sign of incomplete cleanup)
docker compose exec judge ls /tmp | grep judge_

# 5. If slots are all occupied by hung processes, restart the service
docker compose restart judge
```

If the rejection rate is sustained and traffic is legitimate, consider raising `JUDGE_GLOBAL_MAX` in `.env` and restarting:

```bash
# Edit .env: JUDGE_GLOBAL_MAX=32
docker compose up -d judge
```

---

## Common failure modes

### Submission timeouts (RUNNER_TIMEOUT)

Signs: Submissions return `status: "time_limit_exceeded"` for code that should pass. Or the opposite: code that should time out completes.

The `RUNNER_TIMEOUT` env var sets the per-test-case timeout in seconds (default 5). The request-level `timeLimit` field (in milliseconds) is capped at 10,000 ms (10 s) in code. If `RUNNER_TIMEOUT` is shorter than the request's `timeLimit`, the runner script kills the process first.

Fix: Adjust `RUNNER_TIMEOUT` in `.env`. Restart the judge after changing it.

---

### Concurrency exhaustion

Signs: `JudgeRejectionRate` fires, `/execute` returns `503 {"status":"busy"}`.

The scheduler enforces two caps:
- `JUDGE_GLOBAL_MAX` (default 16) — total slots across all IPs.
- `JUDGE_PER_IP_MAX` (default 4) — slots per source IP.

A request waits up to `JUDGE_QUEUE_WAIT_MS` (default 10,000 ms) for a slot before returning 503.

Fix: Raise `JUDGE_GLOBAL_MAX` if the host has capacity. If slots are occupied by hung processes, restart the judge.

---

### Per-language toolchain failure

Signs: Submissions for a specific language return `runtime_error` with a compile error message, but the code is valid. Other languages work fine.

This is a toolchain issue (missing binary, wrong version, broken runner script), not an SLA breach.

**Triage:**

```bash
# Test a specific language runner directly
docker compose exec judge python3 --version
docker compose exec judge node --version
docker compose exec judge ruby --version
docker compose exec judge go version
docker compose exec judge gcc --version

# Check runner scripts exist
docker compose exec judge ls /app/runners/
```

If a binary is missing, the judge image needs to be rebuilt with the correct toolchain. Check `judge-service/Dockerfile`.

---

### Sandbox escape detection (`isSafe` rejection)

Signs: Submissions return `status: "security_error"` with `"Forbidden: dangerous operations detected in code"`.

This is expected behavior — the `isSafe()` function in `main.go` checks submitted code against per-language blocklists before execution. It is not an incident unless the rate is anomalously high (potential abuse attempt).

**Triage:**

```bash
# Check for high security_error rate in logs
docker compose logs --tail=200 judge | grep "security_error"

# If abuse is suspected, check source IPs in Caddy logs
docker compose logs --tail=200 caddy | grep "429\|POST.*execute"
```

> **Note:** The current `isSafe()` implementation is string-matching only (F-085 in prod-readiness audit). It can be bypassed with encoding tricks. A proper sandbox (nsjail/firejail/seccomp) is planned for Phase 3.2.

---

### Cleanup of `judge_*` temp dirs

The judge creates temp files in the OS temp directory (`/tmp/judge_*`) for wrapper-runner languages (Python, JavaScript, Ruby). These are removed via `defer os.Remove(tmpPath)` after each execution.

If the judge crashes mid-execution, orphaned temp files may accumulate.

```bash
# Check for orphaned temp files
docker compose exec judge ls /tmp | grep judge_

# Clean up manually if needed
docker compose exec judge sh -c 'rm -f /tmp/judge_*'
```

---

## Recent incidents

_No incidents recorded yet. File post-mortems under `docs/post-mortems/YYYY-MM-DD-slug.md`._

---

## Useful commands

```bash
# Stream logs
docker compose logs -f judge

# Last 100 lines
docker compose logs --tail=100 judge

# Health + scheduler snapshot
curl http://localhost:9090/health | jq

# Test a submission manually (Python example)
curl -s -X POST http://localhost:9090/execute \
  -H "Content-Type: application/json" \
  -d '{"code":"print(int(input())+1)","language":"python","testCases":[{"input":"1","expected":"2"}]}' | jq

# Check running processes inside the container
docker compose exec judge ps aux

# Check orphaned temp files
docker compose exec judge ls /tmp | grep judge_

# Restart
docker compose restart judge

# Rebuild and restart
docker compose build judge && docker compose up -d judge
```

---

## See also

- [`docker.md`](docker.md) — general Docker Compose operations
- [`docs/adr/0003-go-for-judge-service.md`](../adr/0003-go-for-judge-service.md) — why Go
- [`docs/adr/0009-judge-concurrency-bounds.md`](../adr/0009-judge-concurrency-bounds.md) — concurrency design
- [`infra/prometheus/alerts.yml`](../../infra/prometheus/alerts.yml) — alert definitions

---

_Author: Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)_
