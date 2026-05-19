"""asyncpg pool wrapper."""

from __future__ import annotations

import asyncpg
from typing import Optional

_pool: Optional[asyncpg.Pool] = None


async def init_pool(database_url: str, *, min_size: int = 1, max_size: int = 8) -> asyncpg.Pool:
    global _pool
    # asyncpg expects "postgresql://" — strip Prisma's "?schema=public" if present.
    url = database_url.split("?", 1)[0]
    _pool = await asyncpg.create_pool(
        dsn=url,
        min_size=min_size,
        max_size=max_size,
        command_timeout=10,
    )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("db pool not initialized")
    return _pool
