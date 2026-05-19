"""Analytics queries — heavy DB reads with numpy post-processing."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

import numpy as np

from .db import get_pool


async def heatmap_for_user(username: str, *, days: int = 365) -> dict[str, Any]:
    """Per-day solve counts for the past `days`. Returns a numpy-derived
    dense list aligned to the cutoff date so the FE doesn't need to
    backfill missing days."""
    pool = get_pool()
    cutoff = datetime.utcnow() - timedelta(days=days)

    rows = await pool.fetch(
        """
        SELECT date_trunc('day', s."createdAt")::date AS day,
               COUNT(*)::int AS solved
        FROM "Submission" s
        JOIN "User" u ON u.id = s."userId"
        WHERE u.username = $1
          AND s.status = 'ACCEPTED'
          AND s."createdAt" >= $2
        GROUP BY 1
        ORDER BY 1
        """,
        username,
        cutoff,
    )

    if not rows:
        # Fallback for snake_case schemas.
        rows = await pool.fetch(
            """
            SELECT date_trunc('day', s.created_at)::date AS day,
                   COUNT(*)::int AS solved
            FROM submissions s
            JOIN users u ON u.id = s.user_id
            WHERE u.username = $1
              AND s.status = 'ACCEPTED'
              AND s.created_at >= $2
            GROUP BY 1
            ORDER BY 1
            """,
            username,
            cutoff,
        )

    by_day = {r["day"]: int(r["solved"]) for r in rows}

    today = date.today()
    start = today - timedelta(days=days - 1)
    cells = np.zeros(days, dtype=np.int32)
    for i in range(days):
        d = start + timedelta(days=i)
        cells[i] = by_day.get(d, 0)

    total = int(cells.sum())
    streak = _current_streak(cells)
    longest = _longest_streak(cells)

    return {
        "username": username,
        "days": days,
        "start": start.isoformat(),
        "end": today.isoformat(),
        "total_accepted": total,
        "current_streak": streak,
        "longest_streak": longest,
        "cells": cells.tolist(),
    }


def _current_streak(cells: np.ndarray) -> int:
    streak = 0
    for v in reversed(cells.tolist()):
        if v > 0:
            streak += 1
        else:
            break
    return streak


def _longest_streak(cells: np.ndarray) -> int:
    longest = 0
    cur = 0
    for v in cells.tolist():
        if v > 0:
            cur += 1
            longest = max(longest, cur)
        else:
            cur = 0
    return longest


async def problem_stats(slug: str) -> dict[str, Any]:
    """Acceptance rate per language for a single problem."""
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT s.language AS lang,
               SUM(CASE WHEN s.status = 'ACCEPTED' THEN 1 ELSE 0 END)::int AS accepted,
               COUNT(*)::int AS total
        FROM "Submission" s
        JOIN "Problem" p ON p.id = s."problemId"
        WHERE p.slug = $1
        GROUP BY s.language
        ORDER BY total DESC
        """,
        slug,
    )

    if not rows:
        rows = await pool.fetch(
            """
            SELECT s.language AS lang,
                   SUM(CASE WHEN s.status = 'ACCEPTED' THEN 1 ELSE 0 END)::int AS accepted,
                   COUNT(*)::int AS total
            FROM submissions s
            JOIN problems p ON p.id = s.problem_id
            WHERE p.slug = $1
            GROUP BY s.language
            ORDER BY total DESC
            """,
            slug,
        )

    by_lang = []
    total = 0
    accepted = 0
    for r in rows:
        t = int(r["total"]) or 0
        a = int(r["accepted"]) or 0
        total += t
        accepted += a
        by_lang.append({
            "language": r["lang"],
            "accepted": a,
            "total": t,
            "acceptance_rate": (a / t) if t else 0.0,
        })

    return {
        "slug": slug,
        "total_submissions": total,
        "total_accepted": accepted,
        "acceptance_rate": (accepted / total) if total else 0.0,
        "languages": by_lang,
    }


async def contest_deltas(slug: str) -> dict[str, Any]:
    """Compute rank deltas for a contest by snapshot timestamps."""
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT u.username,
               cs.score::int AS score,
               cs."snapshotAt" AS at
        FROM "ContestStanding" cs
        JOIN "Contest" c ON c.id = cs."contestId"
        JOIN "User" u ON u.id = cs."userId"
        WHERE c.slug = $1
        ORDER BY cs."snapshotAt", u.username
        """,
        slug,
    )

    if not rows:
        return {"slug": slug, "snapshots": [], "deltas": []}

    snapshots: dict[Any, list[tuple[str, int]]] = {}
    for r in rows:
        snapshots.setdefault(r["at"], []).append((r["username"], int(r["score"])))

    ts_list = sorted(snapshots.keys())
    ranks_per_ts: list[dict[str, int]] = []
    for ts in ts_list:
        sorted_users = sorted(snapshots[ts], key=lambda x: -x[1])
        ranks_per_ts.append({u: i + 1 for i, (u, _) in enumerate(sorted_users)})

    deltas = []
    if len(ranks_per_ts) >= 2:
        prev = ranks_per_ts[-2]
        cur = ranks_per_ts[-1]
        all_users = set(prev) | set(cur)
        for u in all_users:
            p = prev.get(u)
            c = cur.get(u)
            deltas.append({
                "username": u,
                "previous_rank": p,
                "current_rank": c,
                "delta": (p - c) if (p is not None and c is not None) else None,
            })
        deltas.sort(key=lambda d: (d["current_rank"] is None, d["current_rank"] or 0))

    return {
        "slug": slug,
        "snapshots": [t.isoformat() for t in ts_list],
        "deltas": deltas,
    }
