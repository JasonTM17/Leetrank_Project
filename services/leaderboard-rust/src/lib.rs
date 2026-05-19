//! Library surface for `leaderboard-rust`.
//!
//! This is intentionally tiny: it exposes a stateless health router so
//! integration tests can exercise the route layer without standing up
//! Postgres + Redis. The bin (main.rs) does not depend on this lib —
//! we keep them parallel to avoid invasive refactors. Once the service
//! grows, real handlers can migrate here for shared test coverage.

use axum::{routing::get, Json, Router};
use serde_json::json;

/// Composite-score scale used by contest ZSETs. Mirrors `cache::CONTEST_SCORE_SCALE`.
pub const CONTEST_SCORE_SCALE: f64 = 1.0e10;

/// Encode `(points, last_submission_unix)` into a single ZSET score so the
/// natural DESC ordering yields `points DESC, last_submission ASC`.
pub fn encode_contest_score(points: i64, last_submission_unix: i64) -> f64 {
    (points as f64) * CONTEST_SCORE_SCALE - last_submission_unix as f64
}

/// Recover the integer points from a composite score.
pub fn decode_contest_points(composite: f64) -> i64 {
    (composite / CONTEST_SCORE_SCALE).ceil() as i64
}

/// Parse a period string the same way the handler does. Returns the
/// canonical key the service uses (`weekly`, `monthly`, `all-time`).
pub fn canonical_period(s: &str) -> Option<&'static str> {
    match s {
        "weekly" => Some("weekly"),
        "monthly" => Some("monthly"),
        "all-time" | "alltime" | "all_time" => Some("all-time"),
        _ => None,
    }
}

/// Stateless router that mirrors the `/healthz` shape served by the
/// production binary. Tests can drive it via `tower::ServiceExt::oneshot`.
pub fn health_router() -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/leaderboard/health", get(healthz))
}

async fn healthz() -> Json<serde_json::Value> {
    Json(json!({"status": "ok"}))
}

/// Empty-leaderboard response shape. Pure function over the cache layer's
/// public type — exercised by integration_test.rs to lock in the `entries`
/// field name (FE depends on it) without needing a live redis.
#[derive(Debug, serde::Serialize, serde::Deserialize, PartialEq)]
pub struct EmptyListResponse {
    pub total: u64,
    pub limit: usize,
    pub offset: usize,
    pub entries: Vec<serde_json::Value>,
}

pub fn empty_list_response() -> EmptyListResponse {
    EmptyListResponse {
        total: 0,
        limit: 50,
        offset: 0,
        entries: Vec::new(),
    }
}
