//! Integration tests for the leaderboard-rust route layer.
//!
//! Scope: stateless routes only — `/healthz` and the empty-list shape.
//! We avoid spinning up redis/postgres in unit tests; full storage
//! coverage lives in the e2e suite. CI is the source of truth (no Rust
//! toolchain in the agent sandbox).

use axum::{body::Body, http::Request, http::StatusCode};
use http_body_util::BodyExt;
use leaderboard_rust::{
    canonical_period, decode_contest_points, empty_list_response, encode_contest_score,
    health_router,
};
use tower::ServiceExt;

#[tokio::test]
async fn health_endpoint_returns_200_with_status_ok() {
    let app = health_router();

    let resp = app
        .oneshot(
            Request::builder()
                .uri("/v1/leaderboard/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json, serde_json::json!({"status": "ok"}));
}

#[tokio::test]
async fn healthz_alias_returns_200_with_status_ok() {
    let app = health_router();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
}

#[tokio::test]
async fn unknown_route_returns_404() {
    let app = health_router();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/v1/leaderboard/missing")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn empty_leaderboard_response_serialises_with_entries_array() {
    // The FE depends on the `entries` field name. This pins the contract
    // so a rename in the type can't slip through silently.
    let body = empty_list_response();
    let raw = serde_json::to_value(&body).unwrap();
    assert_eq!(raw["total"], 0);
    assert_eq!(raw["limit"], 50);
    assert_eq!(raw["offset"], 0);
    assert!(raw["entries"].is_array());
    assert_eq!(raw["entries"].as_array().unwrap().len(), 0);
}

// ---- contest leaderboard score encoding ---------------------------------

#[test]
fn contest_score_orders_higher_points_first() {
    // Higher points always wins, regardless of timestamp.
    let alice = encode_contest_score(300, 1_700_000_000);
    let bob = encode_contest_score(200, 1_600_000_000);
    assert!(alice > bob, "300 pts should outrank 200 pts");
}

#[test]
fn contest_score_breaks_ties_by_earlier_submission() {
    // Same points -> earlier (smaller) timestamp wins.
    let early = encode_contest_score(300, 1_700_000_000);
    let late = encode_contest_score(300, 1_700_000_500);
    assert!(early > late, "earlier last-submission should outrank later");
}

#[test]
fn contest_score_round_trips_points() {
    for &p in &[0_i64, 1, 99, 250, 1_000, 9_999] {
        let composite = encode_contest_score(p, 1_700_000_000);
        assert_eq!(decode_contest_points(composite), p, "decode mismatch for {p}");
    }
}

// ---- period parsing -----------------------------------------------------

#[test]
fn period_parsing_accepts_known_aliases() {
    assert_eq!(canonical_period("weekly"), Some("weekly"));
    assert_eq!(canonical_period("monthly"), Some("monthly"));
    assert_eq!(canonical_period("all-time"), Some("all-time"));
    assert_eq!(canonical_period("alltime"), Some("all-time"));
    assert_eq!(canonical_period("all_time"), Some("all-time"));
}

#[test]
fn period_parsing_rejects_unknown() {
    assert_eq!(canonical_period(""), None);
    assert_eq!(canonical_period("daily"), None);
    assert_eq!(canonical_period("yearly"), None);
}
