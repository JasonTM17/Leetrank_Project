# 0003. Go for the Judge Service

Date: 2026-05-17
Status: Accepted

## Context

The judge service must execute untrusted user code in multiple languages (Python, JavaScript, Ruby, Go) against test cases with hard wall-clock timeouts. Each submission fans out to N concurrent OS processes — one per test case — and must kill them reliably when the deadline expires.

Key requirements:
- Spawn and kill OS processes with hard timeouts
- Run test cases concurrently to minimise total latency
- Low memory footprint (the service is capped at 256 MB in `docker-compose.prod.yml`)
- Simple HTTP API consumed by the Next.js app

## Decision

Implement the judge as a standalone **Go** service (`judge-service/main.go`). Concurrency is handled with goroutines and `sync.WaitGroup` (`runConcurrent` in `main.go`). Hard timeouts use `context.WithTimeout` passed to `exec.CommandContext`, which sends SIGKILL to the child process when the deadline is exceeded. Graceful HTTP server shutdown uses `http.Server.Shutdown` with a 15-second context.

## Consequences

- **Easier:** Goroutines are cheap; spawning 20 concurrent test-case processes costs negligible overhead. `context.WithTimeout` + `exec.CommandContext` gives reliable process termination without manual signal handling.
- **Harder:** The service is a separate binary that must be built and deployed independently. Developers need Go installed locally to modify it.
- **Risk:** The current security model is pattern-based (`dangerousPatterns` map in `main.go`) rather than OS-level sandboxing (seccomp, namespaces). This is a known limitation documented separately.

## Alternatives considered

- **Node.js `child_process`** — event-loop model makes it awkward to fan out many blocking subprocesses; `child_process.spawn` timeout handling requires manual `setTimeout` + `kill`, which is error-prone under load.
- **Rust** — excellent performance and safety, but the async process-spawning ecosystem (`tokio::process`) adds complexity that is not justified for this service's scope. Build times are also significantly longer.
- **Python subprocess** — GIL limits true parallelism for CPU-bound orchestration; slower startup than Go.
