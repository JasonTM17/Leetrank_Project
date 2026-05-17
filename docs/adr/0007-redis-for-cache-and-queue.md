# 0007. Redis for Cache and Queue

Date: 2026-05-17
Status: Accepted

## Context

LeetRank has two near-term needs that benefit from a fast, shared key-value store:

1. **Rate limiting.** The judge service currently implements an in-process rate limiter (`rateLimiter` struct in `judge-service/main.go`). This works for a single instance but state is lost on restart and cannot be shared across multiple replicas.

2. **Async judging queue.** As submission volume grows, synchronous HTTP calls from the Next.js app to the judge service will time out under load. A queue allows the app to enqueue a job and poll for results, decoupling submission ingestion from execution.

An in-memory store (e.g. a Go `sync.Map` or a Node.js `Map`) cannot be shared across processes or survive restarts. A relational database (Postgres) can store rate-limit counters but adds write amplification and lock contention for high-frequency increments.

## Decision

Add **Redis 7** to the infrastructure stack with `appendonly yes` persistence. Redis will be used for:

- **Rate limit counters** — `INCR` + `EXPIRE` per IP key, replacing the in-process `rateLimiter` in `judge-service/main.go`.
- **Job queue** — `LPUSH` / `BRPOP` (or Redis Streams) for async submission processing.
- **Session cache** — optional short-TTL cache for frequently read problem data to reduce Postgres load.

## Consequences

- **Easier:** Atomic `INCR` + `EXPIRE` is the canonical Redis rate-limit pattern; no mutex needed. Queue semantics are built-in. State survives judge service restarts.
- **Harder:** Adds a third service to the compose stack. Developers must have Redis running locally. `appendonly yes` increases disk I/O slightly compared to RDB-only persistence.
- **Risk:** Redis is single-threaded for command execution; a slow Lua script or large key scan can block all clients. Mitigated by keeping operations simple (no Lua, no `KEYS *`).
- **Tradeoff:** In-memory Redis is not durable across host reboots without a volume mount. Rate-limit counters resetting on restart is acceptable; job queue data must be persisted.

## Alternatives considered

- **In-process memory** — current approach; not shareable across replicas, lost on restart. Rejected for production.
- **Postgres counters** — works but adds write amplification for high-frequency rate-limit increments. Rejected.
- **BullMQ (Node.js, backed by Redis)** — good option for the queue layer; still requires Redis. May be adopted on top of this decision.
- **RabbitMQ / NATS** — more capable message brokers but heavier than needed for the current scale.
