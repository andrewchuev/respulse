use crate::api::monitors::AppState;
use crate::db::DbPool;
use crate::models::{User, UserRole};
use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;

const MIN_JWT_SECRET_LEN: usize = 32;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,       // user_id
    pub email: String,
    pub role: String,
    pub team_id: String,
    pub exp: usize,        // expiry timestamp
}

/// Process-wide authentication settings, resolved once at startup.
pub struct AuthConfig {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    /// Enables passwordless persona switching and the seeded demo passwords.
    pub demo_mode: bool,
}

impl AuthConfig {
    /// Fails fast on a missing or weak `JWT_SECRET` so the server never runs with a guessable key.
    pub fn from_env() -> Result<Self, String> {
        let secret = std::env::var("JWT_SECRET")
            .map_err(|_| "JWT_SECRET must be set".to_string())?;
        let demo_mode = std::env::var("DEMO_MODE")
            .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
            .unwrap_or(false);
        Self::new(&secret, demo_mode)
    }

    pub fn new(secret: &str, demo_mode: bool) -> Result<Self, String> {
        if secret.len() < MIN_JWT_SECRET_LEN {
            return Err(format!(
                "JWT_SECRET must be at least {} characters long",
                MIN_JWT_SECRET_LEN
            ));
        }
        Ok(Self {
            encoding_key: EncodingKey::from_secret(secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
            demo_mode,
        })
    }

    pub fn create_jwt(&self, user: &User, role: &str) -> Result<String, jsonwebtoken::errors::Error> {
        let now = chrono::Utc::now().timestamp() as usize;
        // 7 days expiration
        let exp = now + 7 * 24 * 3600;
        let claims = Claims {
            sub: user.id.to_string(),
            email: user.email.clone(),
            role: role.to_string(),
            team_id: user.team_id.to_string(),
            exp,
        };
        encode(&Header::default(), &claims, &self.encoding_key)
    }

    pub fn verify_jwt(&self, token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
        // Default validation pins HS256 and requires a valid `exp`.
        decode::<Claims>(token, &self.decoding_key, &Validation::default()).map(|data| data.claims)
    }

    /// Seeded demo accounts carry a placeholder hash and accept well-known passwords only in demo mode.
    pub fn verify_password(&self, password: &str, hash: &str) -> bool {
        if hash.starts_with("$2") {
            bcrypt::verify(password, hash).unwrap_or(false)
        } else if self.demo_mode && (hash == "pbkdf2:demo" || hash.starts_with("demo:")) {
            password == "password123" || password == "respulse2026" || password == "admin123" || password == "demo"
        } else {
            false
        }
    }
}

pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
    bcrypt::hash(password, 10)
}

/// Resolves a JWT to an active user; the role is always re-read from the database.
pub async fn user_from_token(config: &AuthConfig, pool: &DbPool, token: &str) -> Option<User> {
    let claims = config.verify_jwt(token).ok()?;
    let user_id = uuid::Uuid::parse_str(&claims.sub).ok()?;
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1 AND is_active = TRUE")
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

fn unauthorized(message: &str) -> (StatusCode, Response) {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": message })).into_response(),
    )
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user: User,
    pub role: UserRole,
}

impl AuthUser {
    pub fn require_mutate_monitors(&self) -> Result<(), (StatusCode, Response)> {
        if self.role.can_mutate_monitors() {
            Ok(())
        } else {
            Err((
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "Forbidden: modifying monitors requires Engineer role or higher",
                    "role": self.role.as_str()
                }))
                .into_response(),
            ))
        }
    }

    pub fn require_manage_incidents(&self) -> Result<(), (StatusCode, Response)> {
        if self.role.can_manage_incidents() {
            Ok(())
        } else {
            Err((
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "Forbidden: managing incidents requires Engineer role or higher",
                    "role": self.role.as_str()
                }))
                .into_response(),
            ))
        }
    }

    pub fn require_manage_channels(&self) -> Result<(), (StatusCode, Response)> {
        if self.role.can_manage_channels() {
            Ok(())
        } else {
            Err((
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "Forbidden: managing notification channels requires Engineer role or higher",
                    "role": self.role.as_str()
                }))
                .into_response(),
            ))
        }
    }

    pub fn require_manage_team(&self) -> Result<(), (StatusCode, Response)> {
        if self.role.can_manage_team() {
            Ok(())
        } else {
            Err((
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "Forbidden: team management requires Admin or Owner role",
                    "role": self.role.as_str()
                }))
                .into_response(),
            ))
        }
    }
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = (StatusCode, Response);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        let token = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .ok_or_else(|| unauthorized("Unauthorized: missing bearer token"))?;

        let user = user_from_token(&app_state.auth, &app_state.pool, token)
            .await
            .ok_or_else(|| unauthorized("Unauthorized: invalid or expired token"))?;

        let role = UserRole::from_str(&user.role);
        Ok(AuthUser { user, role })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    const SECRET: &str = "unit-test-secret-that-is-long-enough-123";

    fn sample_user() -> User {
        User {
            id: Uuid::new_v4(),
            team_id: Uuid::new_v4(),
            email: "user@example.com".to_string(),
            name: "User".to_string(),
            password_hash: String::new(),
            role: "VIEWER".to_string(),
            avatar_url: None,
            is_active: true,
            last_login_at: None,
            email_verified_at: None,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn rejects_short_secret() {
        assert!(AuthConfig::new("too-short", false).is_err());
    }

    #[test]
    fn jwt_round_trip() {
        let config = AuthConfig::new(SECRET, false).unwrap();
        let user = sample_user();
        let token = config.create_jwt(&user, "VIEWER").unwrap();
        let claims = config.verify_jwt(&token).unwrap();
        assert_eq!(claims.sub, user.id.to_string());
    }

    #[test]
    fn jwt_signed_with_other_secret_is_rejected() {
        let issuer = AuthConfig::new("another-secret-that-is-long-enough-456", false).unwrap();
        let verifier = AuthConfig::new(SECRET, false).unwrap();
        let token = issuer.create_jwt(&sample_user(), "OWNER").unwrap();
        assert!(verifier.verify_jwt(&token).is_err());
    }

    #[test]
    fn demo_passwords_require_demo_mode() {
        let off = AuthConfig::new(SECRET, false).unwrap();
        let on = AuthConfig::new(SECRET, true).unwrap();
        assert!(!off.verify_password("password123", "pbkdf2:demo"));
        assert!(on.verify_password("password123", "pbkdf2:demo"));
    }
}
