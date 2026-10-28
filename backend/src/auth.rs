use crate::api::monitors::AppState;
use crate::models::{User, UserRole};
use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

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

        // 1. Check for X-User-Email header or Authorization header (e.g. Bearer user@domain)
        let email_header = parts
            .headers
            .get("x-user-email")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .or_else(|| {
                parts
                    .headers
                    .get("authorization")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.strip_prefix("Bearer "))
                    .map(|s| s.trim().to_string())
            });

        let target_email = email_header.unwrap_or_else(|| "alice@respulse.internal".to_string());

        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE email = $1 AND is_active = TRUE"
        )
        .bind(&target_email)
        .fetch_optional(&app_state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
            )
        })?;

        let user = match user {
            Some(u) => u,
            None => {
                // If requested email not found, fall back to first active user (Alice Vance - Owner)
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
                            Json(json!({ "error": "No valid user found" })).into_response(),
                        ));
                    }
                }
            }
        };

        let role = UserRole::from_str(&user.role);

        Ok(AuthUser { user, role })
    }
}
