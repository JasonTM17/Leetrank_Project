"""Pytest fixtures for analytics-python tests.

We don't stand up Postgres in unit tests — `app.db.init_pool` is
patched out at the lifespan layer so FastAPI starts cleanly. Routes
that don't touch the pool (`/healthz`, `/metrics`, `/`) are exercised
directly. Heatmap is asserted to surface the missing-pool error
clearly rather than crash the worker.
"""

from __future__ import annotations

import os
from typing import AsyncIterator

import pytest
import pytest_asyncio


# Sane defaults so `get_settings()` doesn't try to read a real .env
# in CI. Set BEFORE the app module is imported.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/test")
os.environ.setdefault("JWT_SECRET", "ci-test-secret-32-chars-aaaaaaaa")
os.environ.setdefault("LOG_LEVEL", "warning")


@pytest_asyncio.fixture
async def asgi_app() -> AsyncIterator:
    """Yield the FastAPI app with init_pool/close_pool monkeypatched
    so we can run lifespan without a live Postgres."""
    from app import cache, db, main

    async def _noop(*_args, **_kwargs):
        return None

    orig_db_init = db.init_pool
    orig_db_close = db.close_pool
    orig_cache_init = cache.init_cache
    orig_cache_close = cache.close_cache
    orig_listener = cache.start_invalidation_listener

    db.init_pool = _noop  # type: ignore[assignment]
    db.close_pool = _noop  # type: ignore[assignment]
    cache.init_cache = _noop  # type: ignore[assignment]
    cache.close_cache = _noop  # type: ignore[assignment]
    cache.start_invalidation_listener = _noop  # type: ignore[assignment]
    main.init_pool = _noop  # type: ignore[assignment]
    main.close_pool = _noop  # type: ignore[assignment]
    main.init_cache = _noop  # type: ignore[assignment]
    main.close_cache = _noop  # type: ignore[assignment]
    main.start_invalidation_listener = _noop  # type: ignore[assignment]
    try:
        yield main.app
    finally:
        db.init_pool = orig_db_init
        db.close_pool = orig_db_close
        cache.init_cache = orig_cache_init
        cache.close_cache = orig_cache_close
        cache.start_invalidation_listener = orig_listener
        main.init_pool = orig_db_init
        main.close_pool = orig_db_close
        main.init_cache = orig_cache_init
        main.close_cache = orig_cache_close
        main.start_invalidation_listener = orig_listener


@pytest.fixture
def app_no_lifespan():
    """Plain app object for tests that don't need lifespan startup
    (httpx ASGITransport is happy with this for stateless routes)."""
    from app import main

    return main.app
