use crate::cache;
use crate::error::{AppError, AppResult};
use crate::metrics;
use crate::state::AppState;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::response::IntoResponse;
use axum::Json;
use prometheus::Encoder;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default)]
    pub offset: usize,
}

fn default_limit() -> usize { 50 }

#[derive(Debug, Serialize)]
pub struct ListResponse {
    pub total: u64,
    pub limit: usize,
    pub offset: usize,
    pub entries: Vec<cache::LeaderboardEntry>,
}

pub async fn root() -> impl IntoResponse {
    Json(json!({
        "service": "leetrank-leaderboard-rust",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

pub async fn healthz() -> impl IntoResponse {
    Json(json!({"status": "ok"}))
}

pub async fn readyz(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let mut redis = state.redis.clone();
    cache::ping(&mut redis).await?;
    sqlx::query("SELECT 1").execute(&state.pg).await?;
    Ok(Json(json!({"status": "ready"})))
}

pub async fn metrics_handler() -> impl IntoResponse {
    let metric_families = metrics::registry().gather();
    let mut buffer = Vec::new();
    let encoder = prometheus::TextEncoder::new();
    encoder.encode(&metric_families, &mut buffer).ok();
    let body = String::from_utf8(buffer).unwrap_or_default();
    (
        [("content-type", "text/plain; version=0.0.4")],
        body,
    )
}

pub async fn list_leaderboard(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> AppResult<Json<ListResponse>> {
    let timer = metrics::req_latency().with_label_values(&["GET /v1/leaderboard"]).start_timer();

    let limit = q.limit.clamp(1, 100);
    let offset = q.offset.min(100_000);

    let mut redis = state.redis.clone();
    let total = cache::total(&mut redis).await?;
    let entries = cache::list_top(&mut redis, limit, offset).await?;

    timer.observe_duration();
    metrics::req_counter()
        .with_label_values(&["GET /v1/leaderboard", "200"])
        .inc();

    Ok(Json(ListResponse { total, limit, offset, entries }))
}

pub async fn user_rank(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> AppResult<Json<cache::LeaderboardEntry>> {
    let mut redis = state.redis.clone();
    let entry = cache::user_rank(&mut redis, &username).await?
        .ok_or(AppError::NotFound)?;
    metrics::req_counter()
        .with_label_values(&["GET /v1/leaderboard/user", "200"])
        .inc();
    Ok(Json(entry))
}

// ---- contest leaderboard ----------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ContestQuery {
    #[serde(default = "default_limit")]
    pub limit: usize,
}

#[derive(Debug, Serialize)]
pub struct ContestResponse {
    pub slug: String,
    pub limit: usize,
    pub entries: Vec<cache::LeaderboardEntry>,
}

pub async fn contest_leaderboard(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(q): Query<ContestQuery>,
) -> AppResult<Json<ContestResponse>> {
    let timer = metrics::req_latency()
        .with_label_values(&["GET /v1/leaderboard/contest"])
        .start_timer();

    if slug.is_empty() {
        return Err(AppError::BadRequest("slug required".into()));
    }
    let limit = q.limit.clamp(1, 100);

    let mut redis = state.redis.clone();
    let entries = cache::list_contest_top(&mut redis, &slug, limit).await?;

    timer.observe_duration();
    metrics::req_counter()
        .with_label_values(&["GET /v1/leaderboard/contest", "200"])
        .inc();

    Ok(Json(ContestResponse { slug, limit, entries }))
}

// ---- period leaderboards (weekly|monthly|all-time) -------------------

#[derive(Debug, Deserialize)]
pub struct PeriodQuery {
    #[serde(default)]
    pub period: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default)]
    pub offset: usize,
}

#[derive(Debug, Serialize)]
pub struct PeriodResponse {
    pub period: String,
    pub total: u64,
    pub limit: usize,
    pub offset: usize,
    pub entries: Vec<cache::LeaderboardEntry>,
}

pub async fn period_leaderboard(
    State(state): State<AppState>,
    Path(period): Path<String>,
    Query(q): Query<PeriodQuery>,
) -> AppResult<Json<PeriodResponse>> {
    // Path takes precedence over the optional ?period= override; both
    // exist so the FE can hit either /v1/leaderboard/weekly or
    // /v1/leaderboard/all-time?period=monthly without re-routing.
    let chosen = q.period.as_deref().unwrap_or(&period);
    let parsed = cache::Period::parse(chosen)
        .ok_or_else(|| AppError::BadRequest(format!("unknown period: {chosen}")))?;

    let limit = q.limit.clamp(1, 100);
    let offset = q.offset.min(100_000);

    let mut redis = state.redis.clone();
    let total = cache::period_total(&mut redis, parsed).await?;
    let entries = cache::list_period_top(&mut redis, parsed, limit, offset).await?;

    metrics::req_counter()
        .with_label_values(&["GET /v1/leaderboard/period", "200"])
        .inc();

    Ok(Json(PeriodResponse {
        period: chosen.to_string(),
        total,
        limit,
        offset,
        entries,
    }))
}

pub async fn recompute(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<Json<serde_json::Value>> {
    // Admin auth: either X-Admin-Token matches ADMIN_TOKEN, or Bearer token
    // is a valid JWT with role=admin.
    let header_token = headers
        .get("x-admin-token")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let bearer = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.to_string());

    let mut allow = false;
    if let (Some(expected), Some(got)) = (state.admin_token.as_deref(), header_token.as_deref()) {
        if !expected.is_empty() && expected == got {
            allow = true;
        }
    }
    if !allow {
        if let Some(tok) = bearer.as_deref() {
            if let Some(c) = crate::auth::verify_hs256(tok, &state.jwt_secret) {
                if c.role.as_deref() == Some("admin") {
                    allow = true;
                }
            }
        }
    }
    if !allow {
        return Err(AppError::Unauthorized);
    }

    let mut redis = state.redis.clone();
    let count = cache::recompute(&state.pg, &mut redis).await?;

    metrics::req_counter()
        .with_label_values(&["POST /v1/leaderboard/recompute", "200"])
        .inc();

    Ok(Json(json!({
        "ok": true,
        "indexed": count,
    })))
}
