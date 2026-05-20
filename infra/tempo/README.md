# Tempo — distributed tracing

Tempo stores OpenTelemetry traces emitted by LeetRank services. It is part of
the opt-in observability overlay and runs alongside Prometheus / Loki / Grafana.

## Start

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up tempo
```

## Ports

- `3200` — Tempo HTTP API and `/ready` healthcheck
- `4317` — OTLP gRPC ingest
- `4318` — OTLP HTTP ingest

## Storage

Local filesystem under `/var/tempo` inside the container, persisted by the
`tempo_data` named volume. Block retention is `1h` for the dev profile —
tune `compactor.compaction.block_retention` in `tempo.yaml` for longer keeps.

## Grafana integration

Provisioned automatically via `infra/grafana/provisioning/datasources/tempo.yml`.
The datasource UID is `tempo`, with `tracesToLogsV2` linking spans to the
`loki` datasource so a span jumps straight to the matching log lines.

## Emitting traces

Point any service's OpenTelemetry exporter at the OTLP HTTP endpoint:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318
OTEL_TRACES_EXPORTER=otlp
OTEL_SERVICE_NAME=leetrank-web
```

Use the gRPC port `4317` if the SDK supports it for lower overhead.
