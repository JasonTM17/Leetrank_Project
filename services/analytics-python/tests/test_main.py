"""Smoke tests for the analytics-python FastAPI app.

Scope: routes that don't require a live Postgres pool. The heatmap
route is exercised once with the pool monkeypatched out so we
verify the surface-level wiring, not the SQL. Full DB-backed
coverage lives in the e2e suite.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.mark.asyncio
async def test_root_returns_service_identity(app_no_lifespan):
    transport = ASGITransport(app=app_no_lifespan)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "leetrank-analytics-python"
    assert "version" in body


@pytest.mark.asyncio
async def test_healthz_returns_200_with_status_ok(app_no_lifespan):
    transport = ASGITransport(app=app_no_lifespan)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_metrics_endpoint_returns_prometheus_text(app_no_lifespan):
    transport = ASGITransport(app=app_no_lifespan)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/metrics")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers.get("content-type", "")
    # The middleware-driven counter is registered at module load.
    assert "analytics_http_requests_total" in resp.text or "process_" in resp.text


@pytest.mark.asyncio
async def test_unknown_route_returns_404(app_no_lifespan):
    transport = ASGITransport(app=app_no_lifespan)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/v1/analytics/this-does-not-exist")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_heatmap_route_surfaces_db_unavailable_cleanly(app_no_lifespan):
    """Without init_pool, get_pool() raises RuntimeError. We assert the
    request doesn't hang and the framework surfaces an error rather
    than the route silently returning 200 with bogus data."""
    transport = ASGITransport(app=app_no_lifespan, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get("/v1/analytics/users/test/heatmap")
    # Either 500 (uncaught RuntimeError -> framework default) or 503.
    # The contract here is "non-2xx" — we don't pin a specific code.
    assert resp.status_code >= 500
