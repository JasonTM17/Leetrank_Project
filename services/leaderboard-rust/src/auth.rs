use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    pub exp: usize,
}

pub fn verify_hs256(token: &str, secret: &str) -> Option<Claims> {
    let key = DecodingKey::from_secret(secret.as_bytes());
    let mut validation = Validation::default();
    validation.leeway = 30;
    decode::<Claims>(token, &key, &validation)
        .ok()
        .map(|d| d.claims)
}
