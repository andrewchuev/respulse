use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::models::{FastSpringCheckoutConfig, PaymentTransaction, Team};
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use hmac::{Hmac, KeyInit, Mac};
use serde_json::json;
use sha2::Sha256;
use std::env;
use tracing::{error, info, warn};
use uuid::Uuid;

const FASTSPRING_STORE_ID: &str = "reslab";
const FASTSPRING_PRODUCT_PATH: &str = "respulse-pro-plan";
const FASTSPRING_PRODUCT_DISPLAY: &str = "ResPulse Pro Plan";
const PRO_PLAN_PRICE: f64 = 8.00;
const PRO_PLAN_CURRENCY: &str = "USD";

/// FastSpring signs every webhook body with HMAC-SHA256 and sends it base64-encoded here.
const SIGNATURE_HEADER: &str = "x-fs-signature";

fn is_live_mode() -> bool {
    env::var("FASTSPRING_LIVE_MODE")
        .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
        .unwrap_or(false)
}

/// Webhook verification settings, resolved once at startup.
pub struct WebhookConfig {
    secret: Option<String>,
}

impl WebhookConfig {
    pub fn from_env() -> Self {
        let secret = env::var("FASTSPRING_WEBHOOK_SECRET").ok().filter(|s| !s.is_empty());
        if secret.is_none() {
            warn!("FASTSPRING_WEBHOOK_SECRET is not set: FastSpring webhooks will be rejected");
        }
        Self { secret }
    }

    fn verify(&self, body: &[u8], signature_b64: &str) -> bool {
        let Some(secret) = self.secret.as_deref() else {
            return false;
        };
        let Ok(signature) = BASE64.decode(signature_b64.trim()) else {
            return false;
        };
        let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) else {
            return false;
        };
        mac.update(body);
        // verify_slice compares in constant time.
        mac.verify_slice(&signature).is_ok()
    }
}

/// Returns FastSpring checkout configuration for the authenticated team.
pub async fn get_fastspring_config(
    auth: AuthUser,
) -> Json<FastSpringCheckoutConfig> {
    let is_live = is_live_mode();

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

/// Reports whether the team's Pro upgrade has landed.
///
/// The plan is only ever upgraded by the signed FastSpring webhook; a client-supplied order
/// reference proves nothing, so this endpoint never trusts the request body.
pub async fn confirm_fastspring_payment(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, (StatusCode, Response)> {
    auth.require_manage_team()?;

    let team = sqlx::query_as::<_, Team>("SELECT * FROM teams WHERE id = $1")
        .bind(auth.user.team_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            error!("Failed to load team for payment confirmation: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to load organization" })).into_response(),
            )
        })?;

    if team.plan != "PRO" {
        return Err((
            StatusCode::CONFLICT,
            Json(json!({
                "error": "Payment not confirmed yet. The plan upgrades automatically once FastSpring reports the order; try again in a minute."
            }))
            .into_response(),
        ));
    }

    Ok(Json(json!({
        "status": "ok",
        "plan": "PRO",
        "message": "Your organization is on the Pro plan.",
        "provider": "FASTSPRING"
    })))
}

/// FastSpring Webhook listener for real-time order and subscription events.
pub async fn fastspring_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> StatusCode {
    if state.webhook.secret.is_none() {
        error!("Rejecting FastSpring webhook: FASTSPRING_WEBHOOK_SECRET is not configured");
        return StatusCode::SERVICE_UNAVAILABLE;
    }

    let signature = headers
        .get(SIGNATURE_HEADER)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !state.webhook.verify(&body, signature) {
        warn!("Rejecting FastSpring webhook with missing or invalid signature");
        return StatusCode::UNAUTHORIZED;
    }

    info!("Received FastSpring webhook: {} bytes", body.len());

    let parsed: Result<serde_json::Value, _> = serde_json::from_slice(&body);
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

        // Test-store orders must never upgrade a team in live mode.
        if is_live_mode() && data.get("live").and_then(|v| v.as_bool()) == Some(false) {
            warn!("Ignoring non-live FastSpring event {} in live mode", event_type);
            continue;
        }

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

#[cfg(test)]
mod tests {
    use super::*;

    fn sign(secret: &str, body: &[u8]) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(body);
        BASE64.encode(mac.finalize().into_bytes())
    }

    fn config(secret: Option<&str>) -> WebhookConfig {
        WebhookConfig { secret: secret.map(str::to_string) }
    }

    #[test]
    fn accepts_valid_signature() {
        let body = br#"{"events":[]}"#;
        assert!(config(Some("s3cret")).verify(body, &sign("s3cret", body)));
    }

    #[test]
    fn rejects_tampered_body_wrong_secret_and_garbage() {
        let body = br#"{"events":[]}"#;
        let cfg = config(Some("s3cret"));
        assert!(!cfg.verify(br#"{"events":[1]}"#, &sign("s3cret", body)));
        assert!(!cfg.verify(body, &sign("other", body)));
        assert!(!cfg.verify(body, "not-base64!!"));
        assert!(!cfg.verify(body, ""));
    }

    #[test]
    fn fails_closed_without_secret() {
        let body = b"{}";
        assert!(!config(None).verify(body, &sign("anything", body)));
    }
}
