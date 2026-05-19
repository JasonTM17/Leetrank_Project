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
    from app import db, main

    async def _noop_init(*_args, **_kwargs):
        return None

    async def _noop_close(*_args, **_kwargs):
        return None

    orig_init = db.init_pool
    orig_close = db.close_pool
    db.init_pool = _noop_init  # type: ignore[assignment]
    db.close_pool = _noop_close  # type: ignore[assignment]
    main.init_pool = _noop_init  # type: ignore[assignment]
    main.close_pool = _noop_close  # type: ignore[assignment]
    try:
        yield main.app
    finally:
        db.init_pool = orig_init
        db.close_pool = orig_close
        main.init_pool = orig_init
        main.close_pool = orig_close


@pytest.fixture
def app_no_lifespan():
    """Plain app object for tests that don't need lifespan startup
    (httpx ASGITransport is happy with this for stateless routes)."""
    from app import main

    return main.app
