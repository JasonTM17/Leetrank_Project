"""Pydantic response models for analytics endpoints.

These models pin the JSON shape served by /v1/analytics/* so the
generated OpenAPI document matches the actual responses, and so
breaking changes show up as type errors at runtime in tests.

Keep models flat-ish — the heatmap dense cell array is a bare list[int]
on purpose, the FE renders it directly without any wrapper.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class HeatmapResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str
    days: int = Field(ge=7, le=730)
    start: str
    end: str
    total_accepted: int
    current_streak: int
    longest_streak: int
    cells: list[int]


class LanguageStats(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: str
    accepted: int
    total: int
    acceptance_rate: float


class ProblemStatsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str
    total_submissions: int
    total_accepted: int
    acceptance_rate: float
    languages: list[LanguageStats]


class ContestDelta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str
    previous_rank: Optional[int] = None
    current_rank: Optional[int] = None
    delta: Optional[int] = None


class ContestDeltasResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str
    snapshots: list[str]
    deltas: list[ContestDelta]


class ContestStandingsDeltasResponse(BaseModel):
    """Top movers (positive delta) + biggest fallers (negative delta)
    extracted from the most recent two snapshots, paginated."""

    model_config = ConfigDict(extra="forbid")

    slug: str
    snapshots: list[str]
    page: int
    page_size: int
    total_movers: int
    total_fallers: int
    top_movers: list[ContestDelta]
    biggest_fallers: list[ContestDelta]


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str


class RootResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    service: str
    version: str
