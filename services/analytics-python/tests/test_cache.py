"""Cache layer tests — exercise hit/miss + invalidation against the
in-process MEMORY backend (no real redis needed).
"""

from __future__ import annotations

import pytest

from app import cache as cache_mod


@pytest.mark.asyncio
async def test_cache_falls_back_to_memory_on_unreachable_redis():
    # bogus url forces the except branch in init_cache
    await cache_mod.init_cache("redis://127.0.0.1:1/0")
    assert cache_mod._get_cache() is not None
    await cache_mod.close_cache()


@pytest.mark.asyncio
async def test_cached_call_returns_producer_then_serves_from_cache():
    await cache_mod.init_cache("redis://127.0.0.1:1/0")
    calls = {"n": 0}

    async def producer():
        calls["n"] += 1
        return {"v": calls["n"]}

    a = await cache_mod.cached_call("u", ("alice",), 30, producer)
    b = await cache_mod.cached_call("u", ("alice",), 30, producer)
    assert a == {"v": 1}
    assert b == {"v": 1}, "second call must be a cache hit"
    assert calls["n"] == 1, "producer should be called exactly once"
    await cache_mod.close_cache()


@pytest.mark.asyncio
async def test_invalidate_drops_entry():
    await cache_mod.init_cache("redis://127.0.0.1:1/0")
    calls = {"n": 0}

    async def producer():
        calls["n"] += 1
        return {"v": calls["n"]}

    await cache_mod.cached_call("u", ("bob",), 30, producer)
    await cache_mod.invalidate("u", "bob")
    again = await cache_mod.cached_call("u", ("bob",), 30, producer)
    assert again == {"v": 2}
    assert calls["n"] == 2
    await cache_mod.close_cache()


@pytest.mark.asyncio
async def test_handle_invalidate_drops_user_and_problem_keys():
    await cache_mod.init_cache("redis://127.0.0.1:1/0")
    # seed
    await cache_mod.cached_call("heatmap", ("alice", "365"), 30, _const({"x": 1}))
    await cache_mod.cached_call("problem_stats", ("two-sum",), 30, _const({"y": 1}))

    await cache_mod._handle_invalidate(
        {"type": "submit", "username": "alice", "slug": "two-sum"}
    )

    # Re-call: producer must run again (different sentinel value).
    h = await cache_mod.cached_call(
        "heatmap", ("alice", "365"), 30, _const({"x": 2})
    )
    p = await cache_mod.cached_call(
        "problem_stats", ("two-sum",), 30, _const({"y": 2})
    )
    assert h == {"x": 2}
    assert p == {"y": 2}
    await cache_mod.close_cache()


def _const(v):
    async def _f():
        return v

    return _f
