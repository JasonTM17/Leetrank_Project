"""Contest standings-deltas endpoint test.

The DB layer is monkeypatched to return a deterministic two-snapshot
fixture so we can pin the pagination + sort ordering without standing
up Postgres.
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app import main, queries


@pytest.mark.asyncio
async def test_standings_deltas_separates_movers_and_fallers(
    monkeypatch, app_no_lifespan
):
    fake_payload = {
        "slug": "weekly-1",
        "snapshots": ["2025-01-01T10:00:00", "2025-01-01T11:00:00"],
        "deltas": [
            {"username": "alice", "previous_rank": 5, "current_rank": 1, "delta": 4},
            {"username": "bob", "previous_rank": 1, "current_rank": 5, "delta": -4},
            {"username": "carol", "previous_rank": 3, "current_rank": 2, "delta": 1},
            {"username": "dan", "previous_rank": 2, "current_rank": 4, "delta": -2},
            {
                "username": "eve",
                "previous_rank": None,
                "current_rank": 6,
                "delta": None,
            },
        ],
    }

    async def fake_contest_deltas(slug: str):
        return fake_payload

    monkeypatch.setattr(queries, "contest_deltas", fake_contest_deltas)
    monkeypatch.setattr(main.queries, "contest_deltas", fake_contest_deltas)

    transport = ASGITransport(app=app_no_lifespan)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get(
            "/v1/analytics/contests/weekly-1/standings-deltas",
            params={"page": 1, "page_size": 2},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["slug"] == "weekly-1"
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert body["total_movers"] == 4  # eve excluded (delta is None)
    assert body["total_fallers"] == 4

    movers = [m["username"] for m in body["top_movers"]]
    fallers = [f["username"] for f in body["biggest_fallers"]]
    assert movers == ["alice", "carol"]
    assert fallers == ["bob", "dan"]


@pytest.mark.asyncio
async def test_standings_deltas_clamps_pagination(monkeypatch, app_no_lifespan):
    async def fake(slug: str):
        return {"slug": slug, "snapshots": [], "deltas": []}

    monkeypatch.setattr(queries, "contest_deltas", fake)
    monkeypatch.setattr(main.queries, "contest_deltas", fake)

    transport = ASGITransport(app=app_no_lifespan)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.get(
            "/v1/analytics/contests/x/standings-deltas",
            params={"page": -3, "page_size": 9999},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 1
    assert body["page_size"] == 100
