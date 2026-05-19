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
from .config import get_settings
from .db import close_pool, init_pool
from .metrics import REGISTRY, REQ_COUNTER, REQ_LATENCY


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
    logging.info("leetrank-analytics-python ready port=%s", settings.port)
    try:
        yield
    finally:
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


@app.get("/")
async def root():
    return {"service": "leetrank-analytics-python", "version": "0.1.0"}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/readyz")
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


@app.get("/v1/analytics/users/{username}/heatmap")
async def user_heatmap(username: str, days: int = 365):
    days = max(7, min(days, 730))
    return await queries.heatmap_for_user(username, days=days)


@app.get("/v1/analytics/problems/{slug}/stats")
async def problem_stats(slug: str):
    return await queries.problem_stats(slug)


@app.get("/v1/analytics/contests/{slug}/deltas")
async def contest_deltas(slug: str):
    return await queries.contest_deltas(slug)
