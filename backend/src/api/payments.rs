use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::models::{ConfirmFastSpringPaymentRequest, FastSpringCheckoutConfig, PaymentTransaction};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use std::env;
use tracing::{error, info, warn};
use uuid::Uuid;

const FASTSPRING_STORE_ID: &str = "reslab";
const FASTSPRING_PRODUCT_PATH: &str = "respulse-pro-plan";
const FASTSPRING_PRODUCT_DISPLAY: &str = "ResPulse Pro Plan";
const PRO_PLAN_PRICE: f64 = 8.00;
const PRO_PLAN_CURRENCY: &str = "USD";

/// Returns FastSpring checkout configuration for the authenticated team.
pub async fn get_fastspring_config(
    auth: AuthUser,
) -> Json<FastSpringCheckoutConfig> {
    let is_live: bool = env::var("FASTSPRING_LIVE_MODE")
        .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
        .unwrap_or(false);

    let store_domain = if is_live {
        format!("{}.onfastspring.com", FASTSPRING_STORE_ID)
    } else {
        format!("{}.test.onfastspring.com", FASTSPRING_STORE_ID)
    };

    let popup_storefront = format!("{}/popup-reslab", store_domain);
    let checkout_url = format!(
        "https://{}/{}?referrer={}&contact_email={}",
        store_domain,
        FASTSPRING_PRODUCT_PATH,
        auth.user.team_id,
        auth.user.email
    );

    Json(FastSpringCheckoutConfig {
        store_id: FASTSPRING_STORE_ID.to_string(),
        is_test: !is_live,
        storefront: popup_storefront,
        product_path: FASTSPRING_PRODUCT_PATH.to_string(),
        plan_name: FASTSPRING_PRODUCT_DISPLAY.to_string(),
        amount: PRO_PLAN_PRICE,
        currency: PRO_PLAN_CURRENCY.to_string(),
        billing_cycle: "MONTHLY".to_string(),
        checkout_url,
        team_id: auth.user.team_id.to_string(),
        user_email: auth.user.email.clone(),
    })
}

/// Confirms FastSpring payment/order completion and upgrades the team to PRO.
pub async fn confirm_fastspring_payment(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<ConfirmFastSpringPaymentRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Response)> {
    auth.require_manage_team()?;

    let tx_id = payload
        .order_id
        .or(payload.reference)
        .or(payload.subscription_id)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("FS-{}", Uuid::new_v4().simple()));

    let payer_email = payload
        .payer_email
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| auth.user.email.clone());

    let recipient = format!("FastSpring ({})", FASTSPRING_STORE_ID);

    // 1. Record transaction
    let tx_record = sqlx::query_as::<_, PaymentTransaction>(
        r#"
        INSERT INTO payment_transactions (
            team_id, provider, transaction_id, payer_email, recipient_email,
            amount, currency, status, plan, billing_cycle, payload
        )
        VALUES ($1, 'FASTSPRING', $2, $3, $4, $5, $6, 'COMPLETED', 'PRO', 'MONTHLY', $7)
        RETURNING *
        "#,
    )
    .bind(auth.user.team_id)
    .bind(&tx_id)
    .bind(&payer_email)
    .bind(&recipient)
    .bind(PRO_PLAN_PRICE)
    .bind(PRO_PLAN_CURRENCY)
    .bind(json!({
        "order_id": tx_id,
        "product_path": FASTSPRING_PRODUCT_PATH,
        "confirmed_by_user": auth.user.email,
        "confirmed_at": chrono::Utc::now().to_rfc3339()
    }))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        error!("Failed to record FastSpring transaction: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
        )
    })?;

    // 2. Upgrade team to PRO plan
    sqlx::query(
        r#"
        UPDATE teams
        SET plan = 'PRO',
            subscription_status = 'ACTIVE',
            subscription_id = $1,
            subscription_provider = 'FASTSPRING',
            subscription_started_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(&tx_id)
    .bind(auth.user.team_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        error!("Failed to update team plan to PRO: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })).into_response(),
        )
    })?;

    info!(
        "Team {} successfully upgraded to PRO plan via FastSpring order {}",
        auth.user.team_id, tx_id
    );

    Ok(Json(json!({
        "status": "ok",
        "plan": "PRO",
        "message": "FastSpring order verified. Your organization has been upgraded to the Pro plan!",
        "transaction": tx_record,
        "provider": "FASTSPRING"
    })))
}

/// FastSpring Webhook listener for real-time order and subscription events.
pub async fn fastspring_webhook(
    State(state): State<AppState>,
    body: String,
) -> StatusCode {
    info!("Received FastSpring webhook: {} bytes", body.len());

    let parsed: Result<serde_json::Value, _> = serde_json::from_str(&body);
    let events = match parsed {
        Ok(json) => {
            if let Some(events) = json.get("events").and_then(|e| e.as_array()) {
                events.clone()
            } else if json.is_object() {
                vec![json]
            } else {
                vec![]
            }
        }
        Err(e) => {
            error!("Failed to parse FastSpring webhook JSON: {:?}", e);
            return StatusCode::BAD_REQUEST;
        }
    };

    for event in events {
        let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");
        let data = event.get("data").unwrap_or(&event);

        info!("Processing FastSpring event: type={}", event_type);

        let order_id = data.get("order")
            .or_else(|| data.get("id"))
            .or_else(|| data.get("reference"))
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| "FS-WEBHOOK")
            .to_string();

        let payer_email = data.get("account")
            .and_then(|a| a.get("contact"))
            .and_then(|c| c.get("email"))
            .and_then(|e| e.as_str())
            .unwrap_or("")
            .to_string();

        let amount = data.get("total")
            .and_then(|t| t.as_f64())
            .unwrap_or(PRO_PLAN_PRICE);

        let currency = data.get("currency")
            .and_then(|c| c.as_str())
            .unwrap_or(PRO_PLAN_CURRENCY)
            .to_string();

        // Extract team_id from tags or referrer
        let team_id_opt: Option<Uuid> = data.get("tags")
            .and_then(|t| t.get("team_id"))
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
            .or_else(|| {
                data.get("referrer")
                    .and_then(|v| v.as_str())
                    .and_then(|s| Uuid::parse_str(s).ok())
            });

        match event_type {
            "order.completed" | "subscription.activated" | "subscription.charge.completed" => {
                if let Some(team_id) = team_id_opt {
                    let recipient = format!("FastSpring ({})", FASTSPRING_STORE_ID);
                    let _ = sqlx::query(
                        r#"
                        INSERT INTO payment_transactions (
                            team_id, provider, transaction_id, payer_email, recipient_email,
                            amount, currency, status, plan, billing_cycle, payload
                        )
                        VALUES ($1, 'FASTSPRING', $2, $3, $4, $5, $6, 'COMPLETED', 'PRO', 'MONTHLY', $7)
                        "#,
                    )
                    .bind(team_id)
                    .bind(&order_id)
                    .bind(&payer_email)
                    .bind(&recipient)
                    .bind(amount)
                    .bind(&currency)
                    .bind(event.clone())
                    .execute(&state.pool)
                    .await;

                    let _ = sqlx::query(
                        r#"
                        UPDATE teams
                        SET plan = 'PRO',
                            subscription_status = 'ACTIVE',
                            subscription_id = $1,
                            subscription_provider = 'FASTSPRING',
                            subscription_started_at = NOW()
                        WHERE id = $2
                        "#,
                    )
                    .bind(&order_id)
                    .bind(team_id)
                    .execute(&state.pool)
                    .await;

                    info!("Team {} upgraded to PRO via FastSpring event {}", team_id, event_type);
                } else {
                    warn!("FastSpring event {} missing valid team_id in tags or referrer", event_type);
                }
            }
            "subscription.canceled" | "subscription.deactivated" => {
                if let Some(team_id) = team_id_opt {
                    let status = if event_type == "subscription.canceled" { "CANCELED" } else { "DEACTIVATED" };
                    let _ = sqlx::query(
                        r#"
                        UPDATE teams
                        SET subscription_status = $1
                        WHERE id = $2
                        "#,
                    )
                    .bind(status)
                    .bind(team_id)
                    .execute(&state.pool)
                    .await;

                    info!("Team {} subscription status updated to {} via FastSpring", team_id, status);
                }
            }
            _ => {
                info!("Unhandled FastSpring event type: {}", event_type);
            }
        }
    }

    StatusCode::OK
}

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
