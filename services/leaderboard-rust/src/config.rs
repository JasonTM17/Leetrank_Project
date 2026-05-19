use anyhow::Context;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: String,
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub admin_token: Option<String>,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let port = std::env::var("LEADERBOARD_PORT").unwrap_or_else(|_| "4014".to_string());
        let database_url = std::env::var("DATABASE_URL")
            .context("DATABASE_URL is required")?;
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379/0".to_string());
        let jwt_secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "dev-secret-change-me".to_string());
        let admin_token = std::env::var("ADMIN_TOKEN").ok();

        Ok(Self {
            port,
            database_url,
            redis_url,
            jwt_secret,
            admin_token,
        })
    }
}
