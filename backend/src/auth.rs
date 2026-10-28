use crate::api::monitors::AppState;
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

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,       // user_id
    pub email: String,
    pub role: String,
    pub team_id: String,
    pub exp: usize,        // expiry timestamp
}

pub fn get_jwt_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| "respulse_jwt_secret_key_2026_super_secure".to_string())
}

pub fn create_jwt(user: &User, role: &str) -> Result<String, jsonwebtoken::errors::Error> {
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
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(get_jwt_secret().as_bytes()),
    )
}

pub fn verify_jwt(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::default();
    validation.validate_exp = true;
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(get_jwt_secret().as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
}

pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
    bcrypt::hash(password, 10)
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    if hash.starts_with("$2") {
        bcrypt::verify(password, hash).unwrap_or(false)
    } else if hash == "pbkdf2:demo" || hash.starts_with("demo:") {
        // Allow common demo passwords for seeded accounts
        password == "password123" || password == "respulse2026" || password == "admin123" || password == "demo"
    } else {
        false
    }
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

        // 1. Check Authorization header: Bearer <token>
        let auth_header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .map(|s| s.trim().to_string());

        // 2. Check x-user-email header (for backwards compatibility / persona switcher)
        let email_header = parts
            .headers
            .get("x-user-email")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.trim().to_string());

        let user: Option<User> = if let Some(token) = auth_header.as_ref() {
            // First try decoding as JWT
            if let Ok(claims) = verify_jwt(token) {
                if let Ok(user_uuid) = uuid::Uuid::parse_str(&claims.sub) {
                    sqlx::query_as::<_, User>(
                        "SELECT * FROM users WHERE id = $1 AND is_active = TRUE"
                    )
                    .bind(user_uuid)
                    .fetch_optional(&app_state.pool)
                    .await
                    .ok()
                    .flatten()
                } else {
                    None
                }
            } else if token.contains('@') {
                // Token is passed as raw email (e.g. from legacy demo persona switcher)
                sqlx::query_as::<_, User>(
                    "SELECT * FROM users WHERE email = $1 AND is_active = TRUE"
                )
                .bind(token)
                .fetch_optional(&app_state.pool)
                .await
                .ok()
                .flatten()
            } else {
                None
            }
        } else if let Some(email) = email_header.as_ref() {
            sqlx::query_as::<_, User>(
                "SELECT * FROM users WHERE email = $1 AND is_active = TRUE"
            )
            .bind(email)
            .fetch_optional(&app_state.pool)
            .await
            .ok()
            .flatten()
        } else {
            None
        };

        let user = match user {
            Some(u) => u,
            None => {
                // If no valid auth provided, fall back to first active user (Alice Vance - Owner)
                let fallback = sqlx::query_as::<_, User>(
                    "SELECT * FROM users WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1"
                )
                .fetch_optional(&app_state.pool)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
                    )
                })?;

                match fallback {
                    Some(f) => f,
                    None => {
                        return Err((
                            StatusCode::UNAUTHORIZED,
                            Json(json!({ "error": "Unauthorized: No valid user or token found" })).into_response(),
                        ));
                    }
                }
            }
        };

        let role = UserRole::from_str(&user.role);
        Ok(AuthUser { user, role })
    }
}
