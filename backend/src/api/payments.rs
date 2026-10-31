use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::models::PaymentTransaction;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

/// Returns billing and payment transaction history for the authenticated team.
pub async fn get_payment_history(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<PaymentTransaction>>, (StatusCode, Response)> {
    let records = sqlx::query_as::<_, PaymentTransaction>(
        r#"
        SELECT * FROM payment_transactions
        WHERE team_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
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

    Ok(Json(records))
}
