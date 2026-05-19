// LeetRank leaderboard-rust — high-performance leaderboard service.
//
// Reads sorted set `leaderboard:global` from Redis and serves paginated
// rankings. Admin route POST /v1/leaderboard/recompute rebuilds the ZSET
// from postgres.

mod auth;
mod cache;
mod config;
mod error;
mod handlers;
mod metrics;
mod state;

use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::{compression::CompressionLayer, cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Healthcheck mode (used by docker HEALTHCHECK on distroless).
    if std::env::args().any(|a| a == "-healthcheck") {
        let port = std::env::var("LEADERBOARD_PORT").unwrap_or_else(|_| "4014".to_string());
        let url = format!("http://127.0.0.1:{port}/healthz");
        match reqwest_blocking_get(&url).await {
            Ok(true) => std::process::exit(0),
            _ => std::process::exit(1),
        }
    }

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let cfg = config::Config::from_env()?;
    let state = state::AppState::new(&cfg).await?;

    let app = Router::new()
        .route("/", get(handlers::root))
        .route("/healthz", get(handlers::healthz))
        .route("/readyz", get(handlers::readyz))
        .route("/metrics", get(handlers::metrics_handler))
        .route("/v1/leaderboard", get(handlers::list_leaderboard))
        .route("/v1/leaderboard/user/:username", get(handlers::user_rank))
        .route("/v1/leaderboard/contest/:slug", get(handlers::contest_leaderboard))
        .route("/v1/leaderboard/recompute", post(handlers::recompute))
        .layer(CompressionLayer::new())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr: SocketAddr = format!("0.0.0.0:{}", cfg.port).parse()?;
    tracing::info!(port = %cfg.port, "leetrank-leaderboard-rust started");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

// Background loop: refresh weekly + monthly ZSETs from postgres on a
// 60-second cadence. Failures are logged and retried on the next tick —
// stale data beats a panicked task.
async fn run_period_recompute_loop(state: state::AppState) {
    use std::time::Duration;
    let mut ticker = tokio::time::interval(Duration::from_secs(60));
    // Skip the immediate first tick — readyz already proves redis is up,
    // we don't want to block startup with a heavy SQL aggregate.
    ticker.tick().await;
    loop {
        ticker.tick().await;
        let mut redis = state.redis.clone();
        for period in [cache::Period::Weekly, cache::Period::Monthly] {
            match cache::recompute_period(&state.pg, &mut redis, period).await {
                Ok(n) => tracing::debug!(?period, indexed = n, "period recompute ok"),
                Err(e) => tracing::warn!(?period, error = %e, "period recompute failed"),
            }
        }
    }
}

async fn shutdown_signal() {
    use tokio::signal;
    let ctrl_c = async {
        signal::ctrl_c().await.expect("install ctrl-c handler");
    };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("install signal handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown: drain begin");
}

// Tiny no-deps GET probe for the healthcheck binary mode. We don't pull
// reqwest just for this.
async fn reqwest_blocking_get(url: &str) -> anyhow::Result<bool> {
    // url is always http://127.0.0.1:<port>/healthz
    let after_scheme = url.strip_prefix("http://").ok_or_else(|| anyhow::anyhow!("scheme"))?;
    let (hostport, path) = after_scheme.split_once('/').unwrap_or((after_scheme, ""));
    let (host, port_str) = hostport.split_once(':').ok_or_else(|| anyhow::anyhow!("port"))?;
    let port: u16 = port_str.parse()?;
    let path = if path.is_empty() { "/".to_string() } else { format!("/{path}") };

    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut stream = tokio::net::TcpStream::connect((host, port)).await?;
    let req = format!(
        "GET {path} HTTP/1.0\r\nHost: {host}\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(req.as_bytes()).await?;
    let mut buf = Vec::new();
    stream.read_to_end(&mut buf).await?;
    let head = String::from_utf8_lossy(&buf);
    Ok(head.starts_with("HTTP/1.0 200") || head.starts_with("HTTP/1.1 200"))
}
