use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::models::{SwitchUserRequest, Team, User, UserProfile, UserRole};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

pub async fn get_current_user(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<UserProfile>, (StatusCode, Response)> {
    let team = sqlx::query_as::<_, Team>(
        "SELECT * FROM teams WHERE id = $1"
    )
    .bind(auth.user.team_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
        )
    })?
    .unwrap_or(Team {
        id: auth.user.team_id,
        name: "ResPulse Enterprise Team".to_string(),
        slug: "respulse-enterprise".to_string(),
        created_at: chrono::Utc::now(),
    });

    let profile = UserProfile {
        id: auth.user.id,
        team_id: auth.user.team_id,
        team_name: team.name,
        email: auth.user.email,
        name: auth.user.name,
        role: auth.role,
        avatar_url: auth.user.avatar_url,
        is_active: auth.user.is_active,
        permissions: auth.role.permissions(),
    };

    Ok(Json(profile))
}

pub async fn switch_user(
    State(state): State<AppState>,
    Json(payload): Json<SwitchUserRequest>,
) -> Result<Json<UserProfile>, (StatusCode, Response)> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1 AND is_active = TRUE"
    )
    .bind(&payload.email)
    .fetch_optional(&state.pool)
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
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("User not found with email: {}", payload.email) })).into_response(),
            ));
        }
    };

    let team = sqlx::query_as::<_, Team>(
        "SELECT * FROM teams WHERE id = $1"
    )
    .bind(user.team_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
        )
    })?
    .unwrap_or(Team {
        id: user.team_id,
        name: "ResPulse Enterprise Team".to_string(),
        slug: "respulse-enterprise".to_string(),
        created_at: chrono::Utc::now(),
    });

    let role = UserRole::from_str(&user.role);

    // Update last_login_at
    let _ = sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&state.pool)
        .await;

    let profile = UserProfile {
        id: user.id,
        team_id: user.team_id,
        team_name: team.name,
        email: user.email,
        name: user.name,
        role,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        permissions: role.permissions(),
    };

    Ok(Json(profile))
}

pub async fn list_available_users(
    State(state): State<AppState>,
) -> Result<Json<Vec<UserProfile>>, (StatusCode, Response)> {
    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE is_active = TRUE ORDER BY created_at ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
        )
    })?;

    let team = sqlx::query_as::<_, Team>(
        "SELECT * FROM teams LIMIT 1"
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
        )
    })?
    .unwrap_or(Team {
        id: uuid::Uuid::nil(),
        name: "ResPulse Enterprise Team".to_string(),
        slug: "respulse-enterprise".to_string(),
        created_at: chrono::Utc::now(),
    });

    let profiles = users
        .into_iter()
        .map(|u| {
            let role = UserRole::from_str(&u.role);
            UserProfile {
                id: u.id,
                team_id: u.team_id,
                team_name: team.name.clone(),
                email: u.email,
                name: u.name,
                role,
                avatar_url: u.avatar_url,
                is_active: u.is_active,
                permissions: role.permissions(),
            }
        })
        .collect();

    Ok(Json(profiles))
}
