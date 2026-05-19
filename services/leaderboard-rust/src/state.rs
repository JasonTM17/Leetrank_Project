use crate::config::Config;
use anyhow::Context;
use redis::aio::ConnectionManager;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState {
    pub pg: PgPool,
    pub redis: ConnectionManager,
    pub jwt_secret: String,
    pub admin_token: Option<String>,
}

impl AppState {
    pub async fn new(cfg: &Config) -> anyhow::Result<Self> {
        let pg = PgPoolOptions::new()
            .max_connections(8)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect(&cfg.database_url)
            .await
            .context("connect postgres")?;

        let client = redis::Client::open(cfg.redis_url.as_str())
            .context("redis client")?;
        let redis = ConnectionManager::new(client)
            .await
            .context("redis connection manager")?;

        Ok(Self {
            pg,
            redis,
            jwt_secret: cfg.jwt_secret.clone(),
            admin_token: cfg.admin_token.clone(),
        })
    }
}
