# 24. Observability stack: zerolog + Prometheus + OpenTelemetry

Date: 2026-05-19

## Status

Accepted.

## Context

Six services (web, api, auth, auth-go, problems-go, submissions-go, judge) plus Postgres, Redis, Caddy, and n8n. Each emits logs, metrics, and traces. Without a single canonical stack, every service ships its own ad-hoc logger, every dashboard speaks a different metric format, and tracing — when it works — only works for one service in isolation.

We need three guarantees:

1. **One log shape across services.** Structured JSON, same field names, request IDs that propagate.
2. **One metrics format.** Prometheus text exposition for everything; no per-service exporters.
3. **One trace format.** OpenTelemetry, OTLP-over-HTTP, single collector.

Three options were on the table:

| Option | Logs | Metrics | Traces |
|--------|------|---------|--------|
| **A. Hosted (Datadog / New Relic)** | One agent | One agent | One agent |
| **B. Self-hosted ELK + Prom + Jaeger** | Filebeat → Logstash → Elasticsearch | Prometheus + Grafana | Jaeger UI |
| **C. zerolog + Prometheus + OTel + Loki + Tempo + Grafana** | zerolog → stdout → Promtail → Loki | client_golang → Prometheus | OTel SDK → Collector → Tempo |

## Decision

Adopt **option C**: zerolog (Go) and pino-equivalent JSON (TS) for logs, Prometheus client libraries for metrics, OpenTelemetry for tracing. Backend: Loki + Prometheus + Tempo, fronted by a single Grafana.

### Logging

- Go services: `github.com/rs/zerolog`. JSON output to stdout. Standard fields: `ts`, `level`, `msg`, `request_id`, `user_id` (if authenticated), `route`, `latency_ms`, `status`.
- TS services: existing pino-style JSON logger in `apps/api/src/logger.ts`. Same field names.
- Containers ship logs to stdout; the Docker logging driver pipes to Loki via Promtail (compose `docker-compose.observability.yml`).

### Metrics

- Go services: `github.com/prometheus/client_golang`. Each service exposes `/metrics`. Standard counters + histograms: `http_requests_total{route,method,status}`, `http_request_duration_seconds{route,method}`, `db_connections_in_use`, `db_query_duration_seconds`.
- TS services: `prom-client`, same metric names.
- Judge: same plus `judge_executions_total{language,verdict}`, `judge_execution_duration_seconds{language}`, `judge_concurrent`.
- Prometheus scrapes every 15 s.

### Tracing

- All services use the OpenTelemetry SDK with the OTLP-HTTP exporter pointed at the Collector.
- Sampling: head-based, 100% in dev, 10% in production (override via `OTEL_TRACES_SAMPLER_ARG`).
- Trace propagation: W3C Trace Context (`traceparent` header). Automatic on the Hono and chi middleware chains; manual on outbound HTTP / DB calls via the SDK.
- Backend: OTel Collector → Tempo. Grafana queries Tempo via the Tempo data source.

### Standard middleware chain

Every service runs this chain in this order:

1. Request ID (incoming `X-Request-ID` if present, else generate UUIDv7).
2. Trace context propagation (`traceparent`).
3. Access log (one structured line per request, with `request_id` and `trace_id`).
4. Recover (panics captured with stack and emitted as `level=error`).
5. Timeout (15 s default).
6. Metrics middleware (records `http_request_duration_seconds`).

`X-Request-ID` and `traceparent` are returned in the response so users can quote them in support tickets.

## Consequences

**Positive:**

- One mental model across services. Onboarding documentation reduces from "here are seven loggers" to "here's the canonical observability stack."
- Free correlation: `request_id` and `trace_id` link a log line to a trace span. A 500 in production becomes a one-click investigation.
- All open-source, self-hostable. No vendor lock.
- Grafana dashboards versioned in `infra/grafana/dashboards/` so dashboard drift is reviewable.
- Production-grade out of the box — `docker-compose.observability.yml` boots the full stack locally.

**Negative:**

- Five extra containers in the observability profile (Loki, Promtail, Tempo, Prometheus, Grafana). Acceptable: dev-only opt-in via `--profile observability`.
- OTel SDK adds ~5 MB per Go binary and ~20 MB to TS bundles. Worth it for cross-service traces.
- Operational learning curve — engineers need to know Grafana, PromQL, and LogQL.

**Neutral:**

- Existing zerolog-and-Prometheus code in services already follows this shape. The ADR mostly codifies what's already shipping.

## Implementation checklist

- [x] Standard middleware chain in `apps/api`, `services/auth-go`, `services/problems-go`, `services/submissions-go`.
- [x] Per-service `/metrics` endpoint.
- [ ] OTel SDK wired in every service (Phase 4 — currently only the Go services have it).
- [x] `docker-compose.observability.yml` boots Prometheus + Loki + Tempo + Grafana.
- [x] Grafana provisioned with the canonical service dashboard.
- [ ] Alert rules for P95 latency, 5xx rate, judge timeout rate (Phase 4).

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Hosted (Datadog) | Recurring cost; vendor lock; data sovereignty. |
| ELK | Heavyweight; Elasticsearch ops cost; Loki+Promtail covers our log volume. |
| Per-service stacks | Defeats the purpose; we get the worst of every tool. |
| OTel logs (instead of zerolog) | OTel logs are immature in Go as of writing; revisit in 2027. |
