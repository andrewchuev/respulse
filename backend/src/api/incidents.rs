use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::models::{
    AddIncidentUpdateRequest, CreateManualIncidentRequest, Incident, IncidentUpdate,
    IncidentWithDetails, UpdateIncidentRequest, WsMessage,
};
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow)]
struct IncidentRow {
    pub id: Uuid,
    pub monitor_id: Uuid,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub root_cause: Option<String>,
    pub title: Option<String>,
    pub severity: String,
    pub stage: String,
    pub summary: Option<String>,
    pub post_mortem: Option<String>,
    pub is_published: bool,
    pub monitor_name: String,
    pub monitor_url: String,
}

pub async fn list_incidents(
    State(state): State<AppState>,
) -> Result<Json<Vec<IncidentWithDetails>>, (StatusCode, String)> {
    let rows: Vec<IncidentRow> = sqlx::query_as(
        r#"
        SELECT
            i.id,
            i.monitor_id,
            i.status,
            i.started_at,
            i.resolved_at,
            i.duration_seconds,
            i.root_cause,
            COALESCE(i.title, m.name || ' Service Disruption') as title,
            i.severity,
            i.stage,
            i.summary,
            i.post_mortem,
            i.is_published,
            m.name as monitor_name,
            m.url as monitor_url
        FROM incidents i
        JOIN monitors m ON i.monitor_id = m.id
        ORDER BY i.started_at DESC
        LIMIT 100
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut list = Vec::new();
    for r in rows {
        let updates: Vec<IncidentUpdate> = sqlx::query_as::<_, IncidentUpdate>(
            r#"
            SELECT id, incident_id, stage, message, author, created_at
            FROM incident_updates
            WHERE incident_id = $1
            ORDER BY created_at ASC
            "#
        )
        .bind(r.id)
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

        list.push(IncidentWithDetails {
            incident: Incident {
                id: r.id,
                monitor_id: r.monitor_id,
                status: r.status,
                started_at: r.started_at,
                resolved_at: r.resolved_at,
                duration_seconds: r.duration_seconds,
                root_cause: r.root_cause,
                title: r.title,
                severity: r.severity,
                stage: r.stage,
                summary: r.summary,
                post_mortem: r.post_mortem,
                is_published: r.is_published,
            },
            monitor_name: r.monitor_name,
            monitor_url: r.monitor_url,
            updates,
        });
    }

    Ok(Json(list))
}

pub async fn get_incident(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<IncidentWithDetails>, (StatusCode, String)> {
    let r: IncidentRow = sqlx::query_as(
        r#"
        SELECT
            i.id,
            i.monitor_id,
            i.status,
            i.started_at,
            i.resolved_at,
            i.duration_seconds,
            i.root_cause,
            COALESCE(i.title, m.name || ' Service Disruption') as title,
            i.severity,
            i.stage,
            i.summary,
            i.post_mortem,
            i.is_published,
            m.name as monitor_name,
            m.url as monitor_url
        FROM incidents i
        JOIN monitors m ON i.monitor_id = m.id
        WHERE i.id = $1
        "#
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Incident not found".to_string()))?;

    let updates: Vec<IncidentUpdate> = sqlx::query_as::<_, IncidentUpdate>(
        r#"
        SELECT id, incident_id, stage, message, author, created_at
        FROM incident_updates
        WHERE incident_id = $1
        ORDER BY created_at ASC
        "#
    )
    .bind(r.id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    Ok(Json(IncidentWithDetails {
        incident: Incident {
            id: r.id,
            monitor_id: r.monitor_id,
            status: r.status,
            started_at: r.started_at,
            resolved_at: r.resolved_at,
            duration_seconds: r.duration_seconds,
            root_cause: r.root_cause,
            title: r.title,
            severity: r.severity,
            stage: r.stage,
            summary: r.summary,
            post_mortem: r.post_mortem,
            is_published: r.is_published,
        },
        monitor_name: r.monitor_name,
        monitor_url: r.monitor_url,
        updates,
    }))
}

pub async fn update_incident(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateIncidentRequest>,
) -> Result<Json<Incident>, (StatusCode, String)> {
    if !auth.role.can_manage_incidents() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to manage incidents", auth.role.as_str()),
        ));
    }

    let existing: Incident = sqlx::query_as::<_, Incident>(
        "SELECT * FROM incidents WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Incident not found".to_string()))?;

    let title = payload.title.or(existing.title);
    let severity = payload.severity.unwrap_or(existing.severity);
    let stage = payload.stage.unwrap_or(existing.stage);
    let summary = payload.summary.or(existing.summary);
    let post_mortem = payload.post_mortem.or(existing.post_mortem);
    let is_published = payload.is_published.unwrap_or(existing.is_published);

    let status = if stage == "RESOLVED" {
        "RESOLVED".to_string()
    } else {
        existing.status
    };

    let resolved_at = if stage == "RESOLVED" && existing.resolved_at.is_none() {
        Some(Utc::now())
    } else {
        existing.resolved_at
    };

    let updated = sqlx::query_as::<_, Incident>(
        r#"
        UPDATE incidents
        SET title = $1, severity = $2, stage = $3, summary = $4,
            post_mortem = $5, is_published = $6, status = $7, resolved_at = $8
        WHERE id = $9
        RETURNING *
        "#
    )
    .bind(title)
    .bind(severity)
    .bind(stage)
    .bind(summary)
    .bind(post_mortem)
    .bind(is_published)
    .bind(status)
    .bind(resolved_at)
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if updated.status == "RESOLVED" {
        let _ = state.tx.send(WsMessage::IncidentResolved(updated.clone()));
    }

    Ok(Json(updated))
}

pub async fn add_incident_update(
    auth: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddIncidentUpdateRequest>,
) -> Result<Json<IncidentUpdate>, (StatusCode, String)> {
    if !auth.role.can_manage_incidents() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to post incident updates", auth.role.as_str()),
        ));
    }

    let stage_upper = payload.stage.to_uppercase();
    let author = payload.author.unwrap_or_else(|| "On-Call Engineer".to_string());

    let update = sqlx::query_as::<_, IncidentUpdate>(
        r#"
        INSERT INTO incident_updates (incident_id, stage, message, author, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
        "#
    )
    .bind(id)
    .bind(&stage_upper)
    .bind(&payload.message)
    .bind(&author)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Also update the incident's current stage and status if resolved
    if stage_upper == "RESOLVED" {
        let _ = sqlx::query(
            r#"
            UPDATE incidents
            SET stage = 'RESOLVED', status = 'RESOLVED', resolved_at = COALESCE(resolved_at, NOW())
            WHERE id = $1
            "#
        )
        .bind(id)
        .execute(&state.pool)
        .await;
    } else {
        let _ = sqlx::query(
            "UPDATE incidents SET stage = $1 WHERE id = $2"
        )
        .bind(&stage_upper)
        .bind(id)
        .execute(&state.pool)
        .await;
    }

    Ok(Json(update))
}

pub async fn create_manual_incident(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateManualIncidentRequest>,
) -> Result<Json<IncidentWithDetails>, (StatusCode, String)> {
    if !auth.role.can_manage_incidents() {
        return Err((
            StatusCode::FORBIDDEN,
            format!("Forbidden: role {} does not have permission to declare incidents", auth.role.as_str()),
        ));
    }

    let monitor = sqlx::query_as::<_, crate::models::Monitor>(
        "SELECT * FROM monitors WHERE id = $1"
    )
    .bind(payload.monitor_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Monitor not found".to_string()))?;

    let incident_id = Uuid::new_v4();
    let severity = payload.severity.unwrap_or_else(|| "MAJOR".to_string());
    let stage = payload.stage.unwrap_or_else(|| "INVESTIGATING".to_string());
    let summary = payload.summary.unwrap_or_else(|| format!("Manual incident declared for {}", monitor.name));
    let initial_msg = payload.message.unwrap_or_else(|| summary.clone());

    let inc = sqlx::query_as::<_, Incident>(
        r#"
        INSERT INTO incidents (id, monitor_id, status, started_at, root_cause, title, severity, stage, summary, is_published)
        VALUES ($1, $2, 'ONGOING', NOW(), 'Manual Incident', $3, $4, $5, $6, TRUE)
        RETURNING *
        "#
    )
    .bind(incident_id)
    .bind(payload.monitor_id)
    .bind(&payload.title)
    .bind(&severity)
    .bind(&stage)
    .bind(&summary)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let update = sqlx::query_as::<_, IncidentUpdate>(
        r#"
        INSERT INTO incident_updates (incident_id, stage, message, author, created_at)
        VALUES ($1, $2, $3, 'Incident Commander', NOW())
        RETURNING *
        "#
    )
    .bind(incident_id)
    .bind(&stage)
    .bind(&initial_msg)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let _ = state.tx.send(WsMessage::IncidentCreated(inc.clone()));

    Ok(Json(IncidentWithDetails {
        incident: inc,
        monitor_name: monitor.name,
        monitor_url: monitor.url,
        updates: vec![update],
    }))
}
