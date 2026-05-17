# 0009. Judge Concurrency Bounds

Date: 2026-05-17
Status: Accepted

## Context

The judge service executes untrusted user code in OS subprocesses. Without concurrency limits, a single burst of submissions could spawn hundreds of processes simultaneously, exhausting CPU, memory, and file descriptors on the host.

Two distinct threat vectors exist:

1. **Global resource exhaustion** — too many concurrent executions across all users.
2. **Per-IP abuse** — a single client hammering the `/execute` endpoint to monopolise resources or probe for timing side-channels.

The current implementation in `judge-service/main.go` addresses the per-IP vector with an in-process sliding-window rate limiter (`rateLimiter` struct, 30 requests per 60-second window per IP). Test cases within a single request are fanned out concurrently via goroutines (`runConcurrent`), bounded by the 20-test-case limit enforced in `executeHandler`.

## Decision

Enforce concurrency at two levels:

1. **Per-IP rate limit** — 30 requests per 60-second window, implemented with a `sync.Mutex`-protected map of `ipRecord` structs in `judge-service/main.go`. The IP is extracted from `X-Forwarded-For` (first entry) or `RemoteAddr`.

2. **Per-request test-case bound** — maximum 20 test cases per request (`len(req.TestCases) > 20` check in `executeHandler`). Each test case runs in its own goroutine via `runConcurrent`; the goroutines are bounded by this limit.

3. **Hard process timeout** — each subprocess is wrapped in `context.WithTimeout` with a configurable `timeLimit` (default 5000 ms, max 10 000 ms). `exec.CommandContext` sends SIGKILL when the deadline is exceeded, preventing zombie processes.

When Redis is adopted (see ADR 0007), the in-process rate limiter will be replaced with a Redis `INCR`/`EXPIRE` counter to support multi-instance deployments.

## Consequences

- **Easier:** Simple, auditable bounds with no external dependencies in the current single-instance deployment. The 20-test-case cap also limits the blast radius of a single malicious request.
- **Harder:** The in-process rate limiter resets on service restart and cannot be shared across replicas. This is a known limitation tracked in ADR 0007.
- **Risk:** The current security model uses pattern matching (`dangerousPatterns` in `judge-service/main.go`) rather than OS-level sandboxing. A sufficiently creative submission could bypass the pattern list. OS-level sandboxing (seccomp, user namespaces) is the recommended next step.

## Alternatives considered

- **Global semaphore (channel-based)** — a buffered Go channel as a counting semaphore would cap total concurrent executions globally. Not yet implemented; should be added alongside the Redis migration.
- **Worker pool** — a fixed pool of goroutines consuming from a channel queue. More predictable resource usage but adds latency for queued requests. Deferred to the async judging work (ADR 0007).
- **cgroups / container-per-submission** — strongest isolation but high overhead per submission. Appropriate at LeetCode scale; overkill for the current deployment.
