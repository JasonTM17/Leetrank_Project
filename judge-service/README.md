# LeetRank Judge Service

Go-based code execution service that safely runs user-submitted code against test cases. Runs on port **9090**. Spawns a per-submission Docker container, applies CPU / wall-clock / memory limits, and streams the verdict back to the caller.

See [ADR 0003](../docs/adr/0003-go-for-judge-service.md), [ADR 0009](../docs/adr/0009-judge-concurrency-bounds.md), and [ADR 0020](../docs/adr/0020-judge-sandbox-model.md) for the design history.

## Purpose and responsibilities

| Responsibility                           | Owned here?                    |
| ---------------------------------------- | ------------------------------ |
| Compile + run user code in a sandbox     | Yes                            |
| Compare output to expected stdout        | Yes                            |
| Enforce CPU / wall-clock / memory caps   | Yes                            |
| Per-IP rate limiting on `/execute`       | Yes                            |
| Pattern blocklist for dangerous syscalls | Yes                            |
| Submission persistence                   | No → `services/submissions-go` |
| User auth                                | No → `services/auth-go`        |

## Endpoints

| Method | Path       | Description                                      |
| ------ | ---------- | ------------------------------------------------ |
| GET    | `/healthz` | Liveness — 200 while process is up               |
| GET    | `/readyz`  | Readiness — confirms language toolchains present |
| POST   | `/execute` | Run code against test cases, return verdict      |

`POST /execute` request body:

```json
{
  "language": "python",
  "code": "print(int(input()) * 2)",
  "testCases": [{ "input": "21", "expectedOutput": "42" }],
  "timeLimit": 5000,
  "memoryLimit": 256
}
```

Limits: 20 test cases per request, 10 000 ms hard wall-clock per case, 512 MB max RSS. See [ADR 0009](../docs/adr/0009-judge-concurrency-bounds.md).

## Supported languages

### Scripting

| Language          | ID           | Runtime |
| ----------------- | ------------ | ------- |
| Python 3          | `python`     | python3 |
| JavaScript (Node) | `javascript` | node 20 |
| TypeScript        | `typescript` | tsx     |
| Ruby              | `ruby`       | ruby    |
| PHP               | `php`        | php-cli |
| Bash              | `bash`       | bash    |
| Lua               | `lua`        | lua5.4  |
| Perl              | `perl`       | perl    |
| Elixir            | `elixir`     | elixir  |

### Compiled

| Language  | ID       | Toolchain       |
| --------- | -------- | --------------- |
| Go        | `go`     | golang-go       |
| Rust      | `rust`   | rustc           |
| C (gcc)   | `c`      | gcc             |
| C++ (g++) | `cpp`    | g++             |
| C# (Mono) | `csharp` | mono-mcs / mono |

### JVM

| Language | ID       | Toolchain           |
| -------- | -------- | ------------------- |
| Java     | `java`   | default-jdk (javac) |
| Kotlin   | `kotlin` | kotlinc             |
| Scala    | `scala`  | scalac              |

### Data

| Language     | ID    | Runtime |
| ------------ | ----- | ------- |
| SQL (sqlite) | `sql` | sqlite3 |
| R            | `r`   | Rscript |

### Deferred

| Language | Reason                                                   |
| -------- | -------------------------------------------------------- |
| Swift    | Requires `packages.swift.org` apt key; runtime ~600 MB   |
| Haskell  | `ghc` ~700 MB; would push image past 3 GB                |
| Dart     | Requires Google apt key (`dl.google.com/linux/dart/deb`) |

## Environment variables

| Variable               | Required | Default | Description                   |
| ---------------------- | -------- | ------- | ----------------------------- |
| `JUDGE_PORT`           | no       | `9090`  | HTTP listen port              |
| `JUDGE_MAX_CONCURRENT` | no       | `8`     | Global concurrent submissions |
| `JUDGE_RATE_LIMIT`     | no       | `30`    | Per-IP requests / 60 s window |
| `LOG_LEVEL`            | no       | `info`  | Log threshold                 |

## Local dev

```bash
cd judge-service
go run .
# Listening on http://localhost:9090
```

Smoke-test:

```bash
curl -s -X POST http://localhost:9090/execute \
  -H 'Content-Type: application/json' \
  -d '{
    "language": "python",
    "code": "print(int(input()) + 1)",
    "testCases": [{"input": "41", "expectedOutput": "42"}]
  }' | jq
```

Run tests:

```bash
go test ./...
```

Coverage threshold: **≥ 70%** (standard Go service — see global rule #5).

## Production runbook

### Image build

```bash
docker build -t nguyenson1710/leetrank-judge:latest \
             -t nguyenson1710/leetrank-judge:$(git rev-parse --short HEAD) \
             ./judge-service
docker push nguyenson1710/leetrank-judge:latest
docker push nguyenson1710/leetrank-judge:$(git rev-parse --short HEAD)
```

The image is intentionally large (~2 GB) — every supported toolchain ships preinstalled. Compose mounts `/var/run/docker.sock` so the judge can spawn sibling containers per submission.

### Scale-out

Multi-replica is supported, but each replica needs Docker socket access. The per-IP rate limiter is in-process today; replace with the Redis limiter from [ADR 0007](../docs/adr/0007-redis-for-cache-and-queue.md) before going beyond a single replica in production.

## On-call playbook

### Submissions stuck in `Judging` state

1. `docker compose logs judge | tail -200` — look for `exec.CommandContext: context deadline exceeded`. That's a timeout, expected behaviour for slow code.
2. `docker ps | grep judge-runner` — orphan sandbox containers indicate the cleanup goroutine is wedged. Restart the judge container.
3. Confirm Docker daemon health: `docker info | tail -20`.

### `429 Too Many Requests` from `/execute`

Per-IP cap (default 30 req / 60 s). Forward the `Retry-After` header to the user; raise `JUDGE_RATE_LIMIT` only after confirming it's a legitimate burst.

### Sandbox escape attempt detected

Pattern blocklist in `judge-service/main.go` rejects suspicious code with `400 Bad Request`. Logs include the matched pattern. Do **not** loosen the patterns without a security review — see [ADR 0009](../docs/adr/0009-judge-concurrency-bounds.md) and [SECURITY.md](../SECURITY.md).

### High memory pressure on the host

Each runner container caps at 512 MB RSS. With `JUDGE_MAX_CONCURRENT=8` the upper bound is ~4 GB plus the judge itself. If you see OOM kills:

1. Lower `JUDGE_MAX_CONCURRENT`.
2. Confirm no orphan runners (`docker ps -a | grep judge-runner`).
3. Add swap or move to a larger host.

### Logs

| Source                   | Where                                      |
| ------------------------ | ------------------------------------------ |
| Judge JSON logs          | stdout — `docker compose logs judge`       |
| Per-runner stdout/stderr | captured by exec, returned in the response |
| Docker daemon logs       | host system — `journalctl -u docker`       |

## Architecture

Single Go binary. Each submission spawns a Docker container running the appropriate toolchain image; stdin/stdout are streamed via `exec.CommandContext`. Test cases run concurrently up to the per-request bound; results are aggregated into a single verdict (`Accepted`, `Wrong Answer`, `Time Limit Exceeded`, `Memory Limit Exceeded`, `Runtime Error`, `Compilation Error`).

See also: [ADR 0003](../docs/adr/0003-go-for-judge-service.md), [ADR 0009](../docs/adr/0009-judge-concurrency-bounds.md), [ADR 0020](../docs/adr/0020-judge-sandbox-model.md).
