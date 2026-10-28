use crate::api::monitors::AppState;
use crate::auth::{hash_password, AuthUser};
use crate::email_verification;
use crate::models::{
    AuthResponse, LoginRequest, RegisterRequest, SwitchUserRequest, Team, User, UserProfile,
    UserRole,
};
use crate::rate_limit::{client_ip, too_many_requests};
use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use std::net::SocketAddr;
use tracing::error;
use uuid::Uuid;

pub async fn register(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Response)> {
    state
        .limits
        .check_register(client_ip(&headers, peer))
        .map_err(too_many_requests)?;

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
    let ping_key = format!("pk_{}", Uuid::new_v4().to_string().replace('-', ""));

    let team = sqlx::query_as::<_, Team>(
        "INSERT INTO teams (id, name, slug, ping_key) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(team_id)
    .bind(company_name)
    .bind(&slug)
    .bind(&ping_key)
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
        "INSERT INTO users (id, team_id, email, name, password_hash, role, avatar_url, is_active, last_login_at, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, 'OWNER', NULL, TRUE, NOW(), CASE WHEN $6 THEN NOW() ELSE NULL END)
         RETURNING *"
    )
    .bind(user_id)
    .bind(team.id)
    .bind(&email)
    .bind(name)
    .bind(password_hash)
    .bind(!state.settings.require_email_verification)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to create user: {}", e) })).into_response(),
        )
    })?;

    if state.settings.require_email_verification {
        // The account exists but cannot sign in until the link is used; a failed send can be retried via resend.
        if let Err(e) = email_verification::issue_and_send(&state, &user).await {
            error!("Failed to send verification email to {}: {}", user.email, e);
        }
        return Ok(Json(json!({ "status": "verification_required", "email": user.email })));
    }

    // Generate JWT
    let token = state.auth.create_jwt(&user, "OWNER").map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to generate JWT: {}", e) })).into_response(),
        )
    })?;

    let profile = UserProfile {
        id: user.id,
        team_id: team.id,
        team_name: team.name,
        team_ping_key: Some(team.ping_key),
        team_plan: team.plan,
        email: user.email,
        name: user.name,
        role: UserRole::Owner,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        permissions: UserRole::Owner.permissions(),
    };

    Ok(Json(
        serde_json::to_value(AuthResponse { token, user: profile }).expect("AuthResponse serializes"),
    ))
}

pub async fn login(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Response)> {
    state
        .limits
        .check_login(client_ip(&headers, peer))
        .map_err(too_many_requests)?;

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

    if !state.auth.verify_password(password, &user.password_hash) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "Invalid email or password" })).into_response(),
        ));
    }

    // Checked after the password so the answer does not reveal whether an address is registered.
    if state.settings.require_email_verification && user.email_verified_at.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "Please confirm your email address first. We sent you a link when you signed up.",
                "code": "EMAIL_NOT_VERIFIED"
            }))
            .into_response(),
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
        ping_key: "pk_live_enterprise0000000000001".to_string(),
        plan: "PRO".to_string(),
        created_at: chrono::Utc::now(),
    });

    let role = UserRole::from_str(&user.role);

    // Generate JWT
    let token = state.auth.create_jwt(&user, &user.role).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to generate JWT: {}", e) })).into_response(),
        )
    })?;

    let profile = UserProfile {
        id: user.id,
        team_id: user.team_id,
        team_name: team.name,
        team_ping_key: Some(team.ping_key),
        team_plan: team.plan,
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
        ping_key: "pk_live_enterprise0000000000001".to_string(),
        plan: "PRO".to_string(),
        created_at: chrono::Utc::now(),
    });

    let profile = UserProfile {
        id: auth.user.id,
        team_id: auth.user.team_id,
        team_name: team.name,
        team_ping_key: Some(team.ping_key),
        team_plan: team.plan,
        email: auth.user.email,
        name: auth.user.name,
        role: auth.role,
        avatar_url: auth.user.avatar_url,
        is_active: auth.user.is_active,
        permissions: auth.role.permissions(),
    };

    Ok(Json(profile))
}

/// Seeded demo accounts live under this domain; only they can be switched to without a password.
const DEMO_EMAIL_DOMAIN: &str = "@respulse.internal";

/// Public auth capabilities so the UI can hide demo-only controls.
pub async fn auth_config(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({
        "demo_mode": state.auth.demo_mode,
        "billing_enabled": state.settings.billing_enabled,
        "plans": { "FREE": crate::plans::FREE, "PRO": crate::plans::PRO },
    }))
}

/// Passwordless persona login for the seeded demo organization. Disabled unless `DEMO_MODE` is on.
pub async fn switch_user(
    State(state): State<AppState>,
    Json(payload): Json<SwitchUserRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Response)> {
    if !state.auth.demo_mode {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Demo persona switching is disabled" })).into_response(),
        ));
    }

    let email = payload.email.trim().to_lowercase();
    if !email.ends_with(DEMO_EMAIL_DOMAIN) {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Demo user not found" })).into_response(),
        ));
    }

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
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Demo user not found" })).into_response(),
            ));
        }
    };

    let team = sqlx::query_as::<_, Team>(
        "SELECT * FROM teams WHERE id = $1"
    )
    .bind(user.team_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
        )
    })?;

    let role = UserRole::from_str(&user.role);

    // Update last_login_at
    let _ = sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&state.pool)
        .await;

    let token = state.auth.create_jwt(&user, &user.role).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to generate JWT: {}", e) })).into_response(),
        )
    })?;

    let profile = UserProfile {
        id: user.id,
        team_id: user.team_id,
        team_name: team.name,
        team_ping_key: Some(team.ping_key),
        team_plan: team.plan,
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
    auth: AuthUser,
) -> Result<Json<Vec<UserProfile>>, (StatusCode, Response)> {
    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE team_id = $1 AND is_active = TRUE ORDER BY created_at ASC"
    )
    .bind(auth.user.team_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
        )
    })?;

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
        name: "My Team".to_string(),
        slug: "my-team".to_string(),
        ping_key: "pk_live_enterprise0000000000001".to_string(),
        plan: "PRO".to_string(),
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
                team_ping_key: Some(team.ping_key.clone()),
                team_plan: team.plan.clone(),
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

#[derive(Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Deserialize)]
pub struct ResendVerificationRequest {
    pub email: String,
}

/// Opens a session for a user that has just been confirmed (shared by the verification link flow).
async fn auth_response(state: &AppState, user: User) -> Result<AuthResponse, (StatusCode, Response)> {
    let internal = |e: &dyn std::fmt::Display| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to sign in: {}", e) })).into_response(),
        )
    };

    let team = sqlx::query_as::<_, Team>("SELECT * FROM teams WHERE id = $1")
        .bind(user.team_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| internal(&e))?;
    let token = state.auth.create_jwt(&user, &user.role).map_err(|e| internal(&e))?;
    let _ = sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&state.pool)
        .await;

    let role = UserRole::from_str(&user.role);
    Ok(AuthResponse {
        token,
        user: UserProfile {
            id: user.id,
            team_id: user.team_id,
            team_name: team.name,
            team_ping_key: Some(team.ping_key),
            team_plan: team.plan,
            email: user.email,
            name: user.name,
            role: role.clone(),
            avatar_url: user.avatar_url,
            is_active: user.is_active,
            permissions: role.permissions(),
        },
    })
}

/// Consumes the emailed token and signs the user in. POST, so link scanners that prefetch URLs cannot use it up.
pub async fn verify_email(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Response)> {
    state
        .limits
        .check_login(client_ip(&headers, peer))
        .map_err(too_many_requests)?;

    let user = email_verification::consume(&state.pool, &payload.token)
        .await
        .map_err(|e| {
            error!("Email verification lookup failed: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Verification failed, please try again" })).into_response(),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "This confirmation link is invalid or has expired." })).into_response(),
            )
        })?;

    Ok(Json(auth_response(&state, user).await?))
}

/// Sends a fresh confirmation link. The answer is identical for unknown, confirmed and pending addresses.
pub async fn resend_verification(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(payload): Json<ResendVerificationRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Response)> {
    state
        .limits
        .check_resend(client_ip(&headers, peer))
        .map_err(too_many_requests)?;

    if state.settings.require_email_verification {
        let email = payload.email.trim().to_lowercase();
        let pending = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE email = $1 AND is_active = TRUE AND email_verified_at IS NULL",
        )
        .bind(&email)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();

        if let Some(user) = pending {
            if let Err(e) = email_verification::issue_and_send(&state, &user).await {
                error!("Failed to resend verification email to {}: {}", user.email, e);
            }
        }
    }

    Ok(Json(json!({ "status": "ok" })))
}
