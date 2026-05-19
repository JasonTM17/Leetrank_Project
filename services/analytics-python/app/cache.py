"""Response cache backed by aiocache + redis.

The cache wraps individual route handlers (heatmap, problem_stats) and
falls back transparently to a no-op SimpleMemoryCache if the configured
redis URL is unreachable at startup; this keeps unit tests cheap and
guards against a redis flap from taking the analytics service offline.

Invalidation is event-driven: the submissions service publishes
`{"type":"submit","username":"...","slug":"..."}` on the redis pubsub
channel `analytics:invalidate`, and a background task wired up in
main.lifespan deletes the affected cache keys.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from contextlib import suppress
from typing import Any, Awaitable, Callable, Optional

import redis.asyncio as redis_async
from aiocache import Cache
from aiocache.serializers import JsonSerializer

logger = logging.getLogger(__name__)

# Module-level cache singleton — initialised by init_cache() at lifespan
# startup and cleared by close_cache() on shutdown.
_cache: Optional[Cache] = None
_pubsub_task: Optional[asyncio.Task] = None
_redis_url: Optional[str] = None

CACHE_PREFIX = "analytics:cache:"
INVALIDATE_CHANNEL = "analytics:invalidate"


def _key_for(namespace: str, *parts: str) -> str:
    raw = "|".join(parts)
    digest = hashlib.sha1(raw.encode()).hexdigest()[:16]
    return f"{CACHE_PREFIX}{namespace}:{digest}"


async def init_cache(redis_url: str) -> None:
    """Open the cache. On any redis connection error this falls back to
    an in-process memory cache so the service still boots."""
    global _cache, _redis_url
    _redis_url = redis_url
    try:
        client = redis_async.from_url(redis_url, decode_responses=False)
        await client.ping()
        _cache = Cache(
            Cache.REDIS,
            endpoint=client.connection_pool.connection_kwargs.get("host", "localhost"),
            port=client.connection_pool.connection_kwargs.get("port", 6379),
            db=client.connection_pool.connection_kwargs.get("db", 0),
            serializer=JsonSerializer(),
            namespace="",
        )
        logger.info("analytics cache: redis ready url=%s", redis_url)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "analytics cache: redis unavailable, using in-memory cache (err=%s)",
            exc,
        )
        _cache = Cache(Cache.MEMORY, serializer=JsonSerializer(), namespace="")


async def close_cache() -> None:
    global _cache, _pubsub_task
    if _pubsub_task is not None:
        _pubsub_task.cancel()
        with suppress(asyncio.CancelledError):
            await _pubsub_task
        _pubsub_task = None
    if _cache is not None:
        with suppress(Exception):
            await _cache.close()
        _cache = None


def _get_cache() -> Optional[Cache]:
    return _cache


async def cached_call(
    namespace: str,
    parts: tuple[str, ...],
    ttl_seconds: int,
    producer: Callable[[], Awaitable[Any]],
) -> Any:
    """Return cached value if present, else call producer and cache it.
    Any cache backend error degrades silently to the producer."""
    c = _get_cache()
    if c is None:
        return await producer()
    key = _key_for(namespace, *parts)
    try:
        hit = await c.get(key)
    except Exception as exc:  # noqa: BLE001
        logger.warning("cache get failed: %s", exc)
        return await producer()
    if hit is not None:
        return hit
    value = await producer()
    try:
        await c.set(key, value, ttl=ttl_seconds)
    except Exception as exc:  # noqa: BLE001
        logger.warning("cache set failed: %s", exc)
    return value


async def invalidate(namespace: str, *parts: str) -> None:
    """Delete a single cached entry. No-op if the cache is offline."""
    c = _get_cache()
    if c is None:
        return
    key = _key_for(namespace, *parts)
    with suppress(Exception):
        await c.delete(key)


async def start_invalidation_listener() -> None:
    """Subscribe to INVALIDATE_CHANNEL and react to submit events.

    Payload shape:
        {"type":"submit","username":"alice","slug":"two-sum"}
    """
    global _pubsub_task
    if _redis_url is None:
        return
    if _pubsub_task is not None and not _pubsub_task.done():
        return
    _pubsub_task = asyncio.create_task(_pubsub_loop(_redis_url))


async def _pubsub_loop(redis_url: str) -> None:
    try:
        client = redis_async.from_url(redis_url, decode_responses=True)
        ps = client.pubsub()
        await ps.subscribe(INVALIDATE_CHANNEL)
        logger.info("analytics cache: invalidation listener up")
        async for msg in ps.listen():
            if msg.get("type") != "message":
                continue
            try:
                data = json.loads(msg["data"])
            except Exception:  # noqa: BLE001
                continue
            await _handle_invalidate(data)
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("invalidation listener exiting: %s", exc)


async def _handle_invalidate(event: dict[str, Any]) -> None:
    if event.get("type") != "submit":
        return
    username = str(event.get("username", ""))
    slug = str(event.get("slug", ""))
    if username:
        for d in (30, 90, 365, 730):
            await invalidate("heatmap", username, str(d))
    if slug:
        await invalidate("problem_stats", slug)
