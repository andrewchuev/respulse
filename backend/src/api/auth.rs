use crate::api::monitors::AppState;
use crate::auth::{create_jwt, hash_password, verify_password, AuthUser};
use crate::models::{
    AuthResponse, LoginRequest, RegisterRequest, SwitchUserRequest, Team, User, UserProfile,
    UserRole,
};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use uuid::Uuid;

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Response)> {
    let company_name = payload.company_name.trim();
    let name = payload.name.trim();
    let email = payload.email.trim().to_lowercase();
    let password = payload.password.trim();

    // Validations
    if company_name.len() < 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Company name must be at least 2 characters" })).into_response(),
        ));
    }
    if name.len() < 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Name must be at least 2 characters" })).into_response(),
        ));
    }
    if !email.contains('@') || !email.contains('.') || email.len() < 5 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Please enter a valid email address" })).into_response(),
        ));
    }
    if password.len() < 6 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Password must be at least 6 characters" })).into_response(),
        ));
    }

    // Check if user already exists
    let existing = sqlx::query("SELECT id FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
            )
        })?;

    if existing.is_some() {
        return Err((
            StatusCode::CONFLICT,
            Json(json!({ "error": "An account with this email already exists" })).into_response(),
        ));
    }

    // Create Team
    let team_id = Uuid::new_v4();
    let base_slug = company_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    let slug = format!("{}-{}", base_slug, &team_id.to_string()[..6]);

    let team = sqlx::query_as::<_, Team>(
        "INSERT INTO teams (id, name, slug) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(team_id)
    .bind(company_name)
    .bind(&slug)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to create organization: {}", e) })).into_response(),
        )
    })?;

    // Hash password
    let password_hash = hash_password(password).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to hash password: {}", e) })).into_response(),
        )
    })?;

    // Create User with OWNER role
    let user_id = Uuid::new_v4();
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (id, team_id, email, name, password_hash, role, avatar_url, is_active, last_login_at)
         VALUES ($1, $2, $3, $4, $5, 'OWNER', NULL, TRUE, NOW())
         RETURNING *"
    )
    .bind(user_id)
    .bind(team.id)
    .bind(&email)
    .bind(name)
    .bind(password_hash)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to create user: {}", e) })).into_response(),
        )
    })?;

    // Generate JWT
    let token = create_jwt(&user, "OWNER").map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to generate JWT: {}", e) })).into_response(),
        )
    })?;

    let profile = UserProfile {
        id: user.id,
        team_id: team.id,
        team_name: team.name,
        email: user.email,
        name: user.name,
        role: UserRole::Owner,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        permissions: UserRole::Owner.permissions(),
    };

    Ok(Json(AuthResponse {
        token,
        user: profile,
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Response)> {
    let email = payload.email.trim().to_lowercase();
    let password = payload.password.trim();

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1 AND is_active = TRUE"
    )
    .bind(&email)
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
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Invalid email or password" })).into_response(),
            ));
        }
    };

    if !verify_password(password, &user.password_hash) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Invalid email or password" })).into_response(),
        ));
    }

    // Update last_login_at
    let _ = sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&state.pool)
        .await;

    // Fetch team
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
        name: "ResPulse Team".to_string(),
        slug: "respulse-team".to_string(),
        created_at: chrono::Utc::now(),
    });

    let role = UserRole::from_str(&user.role);

    // Generate JWT
    let token = create_jwt(&user, &user.role).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to generate JWT: {}", e) })).into_response(),
        )
    })?;

    let profile = UserProfile {
        id: user.id,
        team_id: user.team_id,
        team_name: team.name,
        email: user.email,
        name: user.name,
        role: role.clone(),
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        permissions: role.permissions(),
    };

    Ok(Json(AuthResponse {
        token,
        user: profile,
    }))
}

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
) -> Result<Json<AuthResponse>, (StatusCode, Response)> {
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

    let token = create_jwt(&user, &user.role).unwrap_or_else(|_| "demo-token".to_string());

    let profile = UserProfile {
        id: user.id,
        team_id: user.team_id,
        team_name: team.name,
        email: user.email,
        name: user.name,
        role: role.clone(),
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        permissions: role.permissions(),
    };

    Ok(Json(AuthResponse {
        token,
        user: profile,
    }))
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
                role: role.clone(),
                avatar_url: u.avatar_url,
                is_active: u.is_active,
                permissions: role.permissions(),
            }
        })
        .collect();

    Ok(Json(profiles))
}
