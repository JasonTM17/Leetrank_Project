"""LeetRank analytics-python — FastAPI entrypoint."""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

import orjson
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, PlainTextResponse
from prometheus_client import generate_latest

from . import queries
from .cache import (
    cached_call,
    close_cache,
    init_cache,
    start_invalidation_listener,
)
from .config import get_settings
from .db import close_pool, init_pool
from .metrics import REGISTRY, REQ_COUNTER, REQ_LATENCY
from .schemas import (
    ContestDeltasResponse,
    ContestStandingsDeltasResponse,
    HealthResponse,
    HeatmapResponse,
    ProblemStatsResponse,
    RootResponse,
)


def _configure_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            '{"ts":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    _configure_logging(settings.log_level)
    await init_pool(settings.database_url)
    await init_cache(settings.redis_url)
    await start_invalidation_listener()
    logging.info("leetrank-analytics-python ready port=%s", settings.port)
    try:
        yield
    finally:
        await close_cache()
        await close_pool()
        logging.info("leetrank-analytics-python: drained")


app = FastAPI(
    title="leetrank-analytics-python",
    version="0.1.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

settings = get_settings()
allowed = [o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed or ["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    route = f"{request.method} {request.url.path}"
    with REQ_LATENCY.labels(route=route).time():
        response = await call_next(request)
    REQ_COUNTER.labels(route=route, status=str(response.status_code)).inc()
    return response


@app.get("/", response_model=RootResponse)
async def root():
    return {"service": "leetrank-analytics-python", "version": "0.1.0"}


@app.get("/healthz", response_model=HealthResponse)
async def healthz():
    return {"status": "ok"}


@app.get("/readyz", response_model=HealthResponse)
async def readyz():
    from .db import get_pool

    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"db unready: {e}") from e
    return {"status": "ready"}


@app.get("/metrics")
async def metrics() -> Response:
    body = generate_latest(REGISTRY)
    return PlainTextResponse(body.decode("utf-8"), media_type="text/plain; version=0.0.4")


@app.get(
    "/v1/analytics/users/{username}/heatmap",
    response_model=HeatmapResponse,
    summary="Per-day accepted submission counts",
)
async def user_heatmap(username: str, days: int = 365):
    days = max(7, min(days, 730))
    return await cached_call(
        "heatmap",
        (username, str(days)),
        ttl_seconds=300,
        producer=lambda: queries.heatmap_for_user(username, days=days),
    )


@app.get(
    "/v1/analytics/problems/{slug}/stats",
    response_model=ProblemStatsResponse,
    summary="Per-language acceptance stats for a problem",
)
async def problem_stats(slug: str):
    return await cached_call(
        "problem_stats",
        (slug,),
        ttl_seconds=60,
        producer=lambda: queries.problem_stats(slug),
    )


@app.get(
    "/v1/analytics/contests/{slug}/deltas",
    response_model=ContestDeltasResponse,
    summary="Raw rank delta between the two most recent snapshots",
)
async def contest_deltas(slug: str):
    return await queries.contest_deltas(slug)


@app.get(
    "/v1/analytics/contests/{slug}/standings-deltas",
    response_model=ContestStandingsDeltasResponse,
    summary="Top movers and biggest fallers, paginated",
)
async def contest_standings_deltas(
    slug: str,
    page: int = 1,
    page_size: int = 20,
):
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    raw = await queries.contest_deltas(slug)
    deltas = [d for d in raw["deltas"] if d.get("delta") is not None]
    movers = sorted(deltas, key=lambda d: -(d["delta"] or 0))
    fallers = sorted(deltas, key=lambda d: (d["delta"] or 0))
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "slug": slug,
        "snapshots": raw["snapshots"],
        "page": page,
        "page_size": page_size,
        "total_movers": len(movers),
        "total_fallers": len(fallers),
        "top_movers": movers[start:end],
        "biggest_fallers": fallers[start:end],
    }
