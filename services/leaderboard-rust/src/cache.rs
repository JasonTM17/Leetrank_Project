use crate::error::AppResult;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

pub const ZSET_KEY: &str = "leaderboard:global";
pub const ZSET_KEY_WEEKLY: &str = "leaderboard:weekly";
pub const ZSET_KEY_MONTHLY: &str = "leaderboard:monthly";

/// Composite-score scale used by contest ZSETs.
///
/// Maintainers store `points * SCALE - last_submission_unix` so the ZSET's
/// natural DESC ordering gives `(points DESC, last_submission ASC)` —
/// higher points first, earlier submission wins ties. We decode by
/// `points = ((composite + ts_max) / SCALE).ceil()`; with SCALE = 1e10
/// and any reasonable Unix timestamp (< 1e10), `ceil(composite / SCALE)`
/// recovers the integer points exactly.
pub const CONTEST_SCORE_SCALE: f64 = 1.0e10;

pub fn contest_zset_key(slug: &str) -> String {
    format!("leaderboard:contest:{slug}")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: u64,
    pub username: String,
    pub score: f64,
}

pub async fn list_top(
    redis: &mut ConnectionManager,
    limit: usize,
    offset: usize,
) -> AppResult<Vec<LeaderboardEntry>> {
    let start = offset as isize;
    let stop = (offset + limit).saturating_sub(1) as isize;

    let raw: Vec<(String, f64)> = redis.zrevrange_withscores(ZSET_KEY, start, stop).await?;

    let entries = raw
        .into_iter()
        .enumerate()
        .map(|(i, (username, score))| LeaderboardEntry {
            rank: (offset + i + 1) as u64,
            username,
            score,
        })
        .collect();
    Ok(entries)
}

pub async fn user_rank(
    redis: &mut ConnectionManager,
    username: &str,
) -> AppResult<Option<LeaderboardEntry>> {
    let score: Option<f64> = redis.zscore(ZSET_KEY, username).await?;
    let Some(score) = score else { return Ok(None) };
    let rank: Option<i64> = redis.zrevrank(ZSET_KEY, username).await?;
    let rank = rank.unwrap_or(-1).max(0) as u64;
    Ok(Some(LeaderboardEntry {
        rank: rank + 1,
        username: username.to_string(),
        score,
    }))
}

pub async fn total(redis: &mut ConnectionManager) -> AppResult<u64> {
    let count: u64 = redis.zcard(ZSET_KEY).await?;
    Ok(count)
}

// Pipelined recompute: pull (username, solvedCount) tuples from postgres,
// DEL the ZSET, then ZADD in batches. Caller must hold an admin token.
pub async fn recompute(
    pg: &PgPool,
    redis: &mut ConnectionManager,
) -> AppResult<u64> {
    // The schema has User.username TEXT and User.solvedCount INT (camelCase
    // because Prisma quoted it). Some seeds use snake_case — fall back.
    let rows = match sqlx::query_as::<_, (String, i64)>(
        r#"SELECT "username", COALESCE("solvedCount", 0)::bigint FROM "User""#,
    )
    .fetch_all(pg)
    .await
    {
        Ok(r) => r,
        Err(_) => sqlx::query_as::<_, (String, i64)>(
            r#"SELECT username, COALESCE(solved_count, 0)::bigint FROM users"#,
        )
        .fetch_all(pg)
        .await?,
    };

    let _: () = redis.del(ZSET_KEY).await?;

    let mut count: u64 = 0;
    for chunk in rows.chunks(500) {
        let mut pipe = redis::pipe();
        for (username, score) in chunk {
            pipe.zadd(ZSET_KEY, username, *score as f64);
            count += 1;
        }
        let _: () = pipe.query_async(redis).await?;
    }

    Ok(count)
}

pub async fn ping(redis: &mut ConnectionManager) -> AppResult<()> {
    let _: String = redis::cmd("PING").query_async(redis).await?;
    Ok(())
}

// ---- contest leaderboard ------------------------------------------------

/// Decode a composite contest score back into raw integer points. See
/// `CONTEST_SCORE_SCALE` for the encoding scheme.
pub fn decode_contest_points(composite: f64) -> i64 {
    (composite / CONTEST_SCORE_SCALE).ceil() as i64
}

/// Read the top entries from `leaderboard:contest:{slug}`. Order is the
/// ZSET's natural DESC: highest composite first which means
/// `score DESC, last_submission ASC` per the encoding scheme.
pub async fn list_contest_top(
    redis: &mut ConnectionManager,
    slug: &str,
    limit: usize,
) -> AppResult<Vec<LeaderboardEntry>> {
    let key = contest_zset_key(slug);
    let stop = limit.saturating_sub(1) as isize;
    let raw: Vec<(String, f64)> = redis.zrevrange_withscores(&key, 0, stop).await?;

    let entries = raw
        .into_iter()
        .enumerate()
        .map(|(i, (username, composite))| LeaderboardEntry {
            rank: (i + 1) as u64,
            username,
            score: decode_contest_points(composite) as f64,
        })
        .collect();
    Ok(entries)
}

// ---- period leaderboards (weekly + monthly + all-time) ------------------

#[derive(Debug, Clone, Copy)]
pub enum Period {
    Weekly,
    Monthly,
    AllTime,
}

impl Period {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "weekly" => Some(Self::Weekly),
            "monthly" => Some(Self::Monthly),
            "all-time" | "alltime" | "all_time" => Some(Self::AllTime),
            _ => None,
        }
    }

    pub fn key(self) -> &'static str {
        match self {
            Self::Weekly => ZSET_KEY_WEEKLY,
            Self::Monthly => ZSET_KEY_MONTHLY,
            Self::AllTime => ZSET_KEY,
        }
    }

    pub fn since_sql(self) -> Option<&'static str> {
        match self {
            Self::Weekly => Some("NOW() - INTERVAL '7 days'"),
            Self::Monthly => Some("NOW() - INTERVAL '30 days'"),
            Self::AllTime => None,
        }
    }
}

pub async fn list_period_top(
    redis: &mut ConnectionManager,
    period: Period,
    limit: usize,
    offset: usize,
) -> AppResult<Vec<LeaderboardEntry>> {
    let start = offset as isize;
    let stop = (offset + limit).saturating_sub(1) as isize;
    let raw: Vec<(String, f64)> = redis
        .zrevrange_withscores(period.key(), start, stop)
        .await?;
    let entries = raw
        .into_iter()
        .enumerate()
        .map(|(i, (username, score))| LeaderboardEntry {
            rank: (offset + i + 1) as u64,
            username,
            score,
        })
        .collect();
    Ok(entries)
}

pub async fn period_total(redis: &mut ConnectionManager, period: Period) -> AppResult<u64> {
    let count: u64 = redis.zcard(period.key()).await?;
    Ok(count)
}

/// Recompute one period ZSET from postgres. Counts distinct accepted
/// problem ids per user inside the configured window.
pub async fn recompute_period(
    pg: &PgPool,
    redis: &mut ConnectionManager,
    period: Period,
) -> AppResult<u64> {
    let sql = match period.since_sql() {
        Some(window) => format!(
            r#"SELECT u."username", COUNT(DISTINCT s."problemId")::bigint AS solved
               FROM "Submission" s
               JOIN "User" u ON u.id = s."userId"
               WHERE s.status = 'accepted' AND s."createdAt" >= {window}
               GROUP BY u."username""#
        ),
        None => r#"SELECT u."username", COUNT(DISTINCT s."problemId")::bigint AS solved
                   FROM "Submission" s
                   JOIN "User" u ON u.id = s."userId"
                   WHERE s.status = 'accepted'
                   GROUP BY u."username""#
            .to_string(),
    };

    let rows = sqlx::query_as::<_, (String, i64)>(&sql).fetch_all(pg).await?;

    let _: () = redis.del(period.key()).await?;
    let mut count: u64 = 0;
    for chunk in rows.chunks(500) {
        let mut pipe = redis::pipe();
        for (username, score) in chunk {
            pipe.zadd(period.key(), username, *score as f64);
            count += 1;
        }
        let _: () = pipe.query_async(redis).await?;
    }
    Ok(count)
}
