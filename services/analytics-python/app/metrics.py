"""Prometheus metrics."""

from prometheus_client import Counter, Histogram, CollectorRegistry

REGISTRY = CollectorRegistry()

REQ_COUNTER = Counter(
    "analytics_http_requests_total",
    "Total HTTP requests",
    labelnames=("route", "status"),
    registry=REGISTRY,
)

REQ_LATENCY = Histogram(
    "analytics_http_request_duration_seconds",
    "HTTP request latency",
    labelnames=("route",),
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5),
    registry=REGISTRY,
)
