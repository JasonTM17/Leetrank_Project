//! Integration tests for the leaderboard-rust route layer.
//!
//! Scope: stateless routes only — `/healthz` and the empty-list shape.
//! We avoid spinning up redis/postgres in unit tests; full storage
//! coverage lives in the e2e suite. CI is the source of truth (no Rust
//! toolchain in the agent sandbox).

use axum::{body::Body, http::Request, http::StatusCode};
use http_body_util::BodyExt;
use leaderboard_rust::{empty_list_response, health_router};
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
