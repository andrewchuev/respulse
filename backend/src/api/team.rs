use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::models::{InviteMemberRequest, TeamMember, UpdateMemberRoleRequest, User, UserRole};
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use uuid::Uuid;

pub async fn list_team_members(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<TeamMember>>, (StatusCode, Response)> {
    let members = sqlx::query_as::<_, TeamMember>(
        "SELECT id, team_id, email, name, role, avatar_url, is_active, created_at, last_login_at 
         FROM users 
         WHERE team_id = $1 
         ORDER BY 
           CASE role
             WHEN 'OWNER' THEN 1
             WHEN 'ADMIN' THEN 2
             WHEN 'ENGINEER' THEN 3
             WHEN 'VIEWER' THEN 4
             ELSE 5
           END, 
           name ASC"
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

    Ok(Json(members))
}

pub async fn invite_member(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<InviteMemberRequest>,
) -> Result<(StatusCode, Json<TeamMember>), (StatusCode, Response)> {
    auth.require_manage_team()?;

    // Only OWNER can invite another OWNER
    if payload.role == UserRole::Owner && auth.role != UserRole::Owner {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Only Organization Owner can assign the OWNER role" })).into_response(),
        ));
    }

    // Plan validation: check member limits
    let team_plan: String = sqlx::query_scalar("SELECT plan FROM teams WHERE id = $1")
        .bind(auth.user.team_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })).into_response()))?
        .unwrap_or_else(|| "FREE".to_string());

    let (member_count,): (i64,) = sqlx::query_as("SELECT COUNT(*)::bigint FROM users WHERE team_id = $1")
        .bind(auth.user.team_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() })).into_response()))?;

    let max_members = crate::plans::limits(&team_plan).max_members;
    if member_count >= max_members {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": format!("Team member limit reached ({} max on the {} plan).{}", max_members, team_plan, state.settings.upgrade_hint())
            })).into_response(),
        ));
    }

    let existing = sqlx::query("SELECT id FROM users WHERE email = $1")
        .bind(&payload.email)
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
            Json(json!({ "error": format!("User already exists with email: {}", payload.email) })).into_response(),
        ));
    }

    // Default avatars for newly invited users
    let sanitized_name = payload.name.replace(' ', "+");
    let avatar_url = format!(
        "https://api.dicebear.com/7.x/initials/svg?seed={}",
        sanitized_name
    );

    let member = sqlx::query_as::<_, TeamMember>(
        "INSERT INTO users (team_id, email, name, role, avatar_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, team_id, email, name, role, avatar_url, is_active, created_at, last_login_at"
    )
    .bind(auth.user.team_id)
    .bind(&payload.email.trim().to_lowercase())
    .bind(&payload.name.trim())
    .bind(payload.role.as_str())
    .bind(avatar_url)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to create user: {}", e) })).into_response(),
        )
    })?;

    Ok((StatusCode::CREATED, Json(member)))
}

pub async fn update_member_role(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(member_id): Path<Uuid>,
    Json(payload): Json<UpdateMemberRoleRequest>,
) -> Result<Json<TeamMember>, (StatusCode, Response)> {
    auth.require_manage_team()?;

    let target = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1 AND team_id = $2")
        .bind(member_id)
        .bind(auth.user.team_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
            )
        })?;

    let target = match target {
        Some(u) => u,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Team member not found" })).into_response(),
            ));
        }
    };

    // If target is OWNER, only OWNER can change it
    if target.role == "OWNER" && auth.role != UserRole::Owner {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Only the Organization Owner can modify the Owner role" })).into_response(),
        ));
    }

    // Only OWNER can promote someone to OWNER
    if payload.role == UserRole::Owner && auth.role != UserRole::Owner {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Only the Organization Owner can grant Owner privileges" })).into_response(),
        ));
    }

    let updated = sqlx::query_as::<_, TeamMember>(
        "UPDATE users SET role = $1 WHERE id = $2 AND team_id = $3
         RETURNING id, team_id, email, name, role, avatar_url, is_active, created_at, last_login_at"
    )
    .bind(payload.role.as_str())
    .bind(member_id)
    .bind(auth.user.team_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to update role: {}", e) })).into_response(),
        )
    })?;

    Ok(Json(updated))
}

pub async fn remove_member(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(member_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Response)> {
    auth.require_manage_team()?;

    let target = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1 AND team_id = $2")
        .bind(member_id)
        .bind(auth.user.team_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
            )
        })?;

    let target = match target {
        Some(u) => u,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Team member not found" })).into_response(),
            ));
        }
    };

    if target.role == "OWNER" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Cannot remove the Organization Owner" })).into_response(),
        ));
    }

    if target.id == auth.user.id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Cannot remove yourself from the organization" })).into_response(),
        ));
    }

    sqlx::query("DELETE FROM users WHERE id = $1 AND team_id = $2")
        .bind(member_id)
        .bind(auth.user.team_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Failed to delete user: {}", e) })).into_response(),
            )
        })?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdatePlanRequest {
    pub plan: String,
}

pub async fn update_team_plan(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<UpdatePlanRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Response)> {
    auth.require_manage_team()?;

    let plan_upper = payload.plan.trim().to_uppercase();
    if plan_upper != "FREE" && plan_upper != "PRO" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid plan. Valid options are 'FREE' or 'PRO'." })).into_response(),
        ));
    }

    // Paid upgrades go through the signed WayForPay webhook; self-service PRO is not allowed.
    if plan_upper == "PRO" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Upgrade to Pro through checkout" })).into_response(),
        ));
    }

    sqlx::query("UPDATE teams SET plan = $1 WHERE id = $2")
        .bind(&plan_upper)
        .bind(auth.user.team_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
            )
        })?;

    Ok(Json(json!({
        "status": "ok",
        "plan": plan_upper,
        "message": format!("Organization plan updated to {}", plan_upper)
    })))
}
