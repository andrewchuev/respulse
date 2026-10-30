//! WayForPay payment processing and recurring subscription management.
//!
//! Implements offline checkout session generation, webhook signature validation,
//! idempotency tracking, and recurring subscription cancellation via WayForPay's regularApi.

use axum::body::Bytes;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::{Months, Utc};
use hmac::{Hmac, KeyInit, Mac};
use md5::Md5;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use subtle::ConstantTimeEq;
use tracing::{info, warn};
use uuid::Uuid;

use crate::api::monitors::AppState;
use crate::auth::AuthUser;

const WAYFORPAY_PURCHASE_URL: &str = "https://secure.wayforpay.com/pay?behavior=offline";
const WAYFORPAY_REGULAR_API_URL: &str = "https://api.wayforpay.com/regularApi";
const WAYFORPAY_REGULAR_API_OK: i64 = 4100;
const WAYFORPAY_REGULAR_API_RULE_NOT_FOUND: i64 = 4102;
const SUBSCRIPTION_MAX_MONTHS: u32 = 240;

#[derive(Clone, Debug)]
pub struct WayForPayConfig {
    pub merchant_account: String,
    pub secret_key: String,
    pub merchant_password: String,
    pub merchant_domain_name: String,
    pub currency: String,
    pub app_url: String,
}

impl WayForPayConfig {
    pub fn from_env(app_url: &str) -> Option<Self> {
        let merchant_account = std::env::var("WAYFORPAY_MERCHANT_ACCOUNT").ok()?.trim().to_string();
        if merchant_account.is_empty() {
            return None;
        }
        let secret_key = std::env::var("WAYFORPAY_SECRET_KEY").ok()?.trim().to_string();
        if secret_key.is_empty() {
            return None;
        }
        let merchant_password = std::env::var("WAYFORPAY_MERCHANT_PASSWORD")
            .unwrap_or_default()
            .trim()
            .to_string();
        let merchant_domain_name = std::env::var("WAYFORPAY_MERCHANT_DOMAIN")
            .unwrap_or_else(|_| "respulse.online".to_string())
            .trim()
            .to_string();
        let currency = std::env::var("WAYFORPAY_CURRENCY")
            .unwrap_or_else(|_| "USD".to_string())
            .trim()
            .to_string();

        Some(Self {
            merchant_account,
            secret_key,
            merchant_password,
            merchant_domain_name,
            currency,
            app_url: app_url.to_string(),
        })
    }
}

fn hmac_md5_hex(secret: &str, message: &str) -> String {
    let mut mac = Hmac::<Md5>::new_from_slice(secret.as_bytes()).expect("HMAC accepts any length key");
    mac.update(message.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

fn date_after_months(interval_months: u32) -> chrono::NaiveDate {
    let today = Utc::now().date_naive();
    today.checked_add_months(Months::new(interval_months)).unwrap_or(today)
}

fn format_wfp_date(date: chrono::NaiveDate) -> String {
    date.format("%d.%m.%Y").to_string()
}

fn build_order_reference(team_id: Uuid, plan: &str) -> String {
    format!(
        "respulse_{}_{}_{}_{}",
        team_id,
        plan.to_lowercase(),
        Utc::now().timestamp(),
        &Uuid::new_v4().to_string()[..8]
    )
}

fn parse_order_reference(order_reference: &str) -> Option<(Uuid, String)> {
    let mut parts = order_reference.split('_');
    if parts.next()? != "respulse" {
        return None;
    }
    let team_id_str = parts.next()?;
    let team_id = Uuid::parse_str(team_id_str).ok()?;
    let plan = parts.next()?.to_uppercase();
    Some((team_id, plan))
}

#[derive(Debug, Deserialize)]
pub struct CreateCheckoutRequest {
    #[serde(default = "default_pro_plan")]
    pub plan: String,
}

fn default_pro_plan() -> String {
    "PRO".to_string()
}

#[derive(Debug, Serialize)]
pub struct CheckoutUrlResponse {
    pub url: String,
    pub order_reference: String,
}

/// Generates a WayForPay hosted checkout URL for a recurring monthly subscription ($16/mo).
pub async fn create_checkout_session(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateCheckoutRequest>,
) -> Result<Json<CheckoutUrlResponse>, (StatusCode, String)> {
    if !auth.role.can_manage_team() {
        return Err((
            StatusCode::FORBIDDEN,
            "Forbidden: Only team owners and administrators can manage subscriptions".to_string(),
        ));
    }

    let config = match &state.wayforpay {
        Some(c) => c,
        None => {
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                "WayForPay payment processing is not configured on this server".to_string(),
            ))
        }
    };

    let plan_upper = payload.plan.trim().to_uppercase();
    if plan_upper != "PRO" {
        return Err((StatusCode::BAD_REQUEST, "Only PRO plan can be subscribed to".to_string()));
    }

    let order_reference = build_order_reference(auth.user.team_id, &plan_upper);
    let order_date = Utc::now().timestamp();
    let amount = "16.00".to_string();
    let product_name = "ResPulse Pro".to_string();

    let date_next = format_wfp_date(date_after_months(1));
    let date_end = format_wfp_date(date_after_months(SUBSCRIPTION_MAX_MONTHS));

    // Signature formula:
    // merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;productName[];productCount[];productPrice[]
    let signature_base = format!(
        "{};{};{};{};{};{};{};1;{}",
        config.merchant_account,
        config.merchant_domain_name,
        order_reference,
        order_date,
        amount,
        config.currency,
        product_name,
        amount
    );
    let signature = hmac_md5_hex(&config.secret_key, &signature_base);

    let return_url = format!("{}/?checkout=success", config.app_url.trim_end_matches('/'));
    let service_url = format!("{}/api/billing/wayforpay/webhook", config.app_url.trim_end_matches('/'));

    let params: Vec<(&str, String)> = vec![
        ("merchantAccount", config.merchant_account.clone()),
        ("merchantDomainName", config.merchant_domain_name.clone()),
        ("merchantSignature", signature),
        ("merchantTransactionType", "SALE".to_string()),
        ("merchantTransactionSecureType", "AUTO".to_string()),
        ("orderReference", order_reference.clone()),
        ("orderDate", order_date.to_string()),
        ("amount", amount.clone()),
        ("currency", config.currency.clone()),
        ("productName[]", product_name),
        ("productPrice[]", amount.clone()),
        ("productCount[]", "1".to_string()),
        ("clientEmail", auth.user.email.clone()),
        ("regularMode", "monthly".to_string()),
        ("regularAmount", amount),
        ("dateNext", date_next),
        ("dateEnd", date_end),
        ("regularOn", "1".to_string()),
        ("returnUrl", return_url),
        ("serviceUrl", service_url),
    ];

    let client = reqwest::Client::new();
    let response = client
        .post(WAYFORPAY_PURCHASE_URL)
        .form(&params)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to reach WayForPay purchase gateway: {}", e)))?;

    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Invalid JSON response from WayForPay: {}", e)))?;

    if !status.is_success() {
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("WayForPay purchase request failed with HTTP {}: {}", status, body),
        ));
    }

    let url = body
        .get("url")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            let reason = body.get("reason").and_then(Value::as_str).unwrap_or("Missing redirect URL");
            (StatusCode::BAD_GATEWAY, format!("WayForPay did not return a checkout URL: {}", reason))
        })?
        .to_string();

    Ok(Json(CheckoutUrlResponse {
        url,
        order_reference,
    }))
}

#[derive(Debug, Deserialize, Serialize)]
pub struct WebhookPayload {
    #[serde(rename = "merchantAccount")]
    pub merchant_account: String,
    #[serde(rename = "orderReference")]
    pub order_reference: String,
    #[serde(rename = "merchantSignature")]
    pub merchant_signature: String,
    pub amount: Value,
    pub currency: String,
    #[serde(rename = "authCode", default)]
    pub auth_code: String,
    #[serde(rename = "cardPan", default)]
    pub card_pan: String,
    #[serde(rename = "transactionStatus")]
    pub transaction_status: String,
    #[serde(rename = "reasonCode", default)]
    pub reason_code: Value,
    #[serde(rename = "processingDate", default)]
    pub processing_date: Option<i64>,
    #[serde(rename = "email", default)]
    pub email: Option<String>,
}

/// Receives asynchronous notifications from WayForPay on order status changes and regular subscription rebills.
pub async fn billing_webhook(
    State(state): State<AppState>,
    body: Bytes,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let config = match &state.wayforpay {
        Some(c) => c,
        None => {
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                "WayForPay billing is not enabled on this server".to_string(),
            ))
        }
    };

    let payload: WebhookPayload = serde_json::from_slice(&body).map_err(|e| {
        warn!("Failed to deserialize WayForPay webhook body: {}", e);
        (StatusCode::BAD_REQUEST, "Malformed webhook JSON".to_string())
    })?;

    if payload.merchant_account != config.merchant_account {
        warn!("WayForPay webhook received for unknown merchantAccount '{}'", payload.merchant_account);
        return Err((StatusCode::FORBIDDEN, "Merchant account mismatch".to_string()));
    }

    let amount_str = match &payload.amount {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        other => other.to_string(),
    };
    let reason_code_str = match &payload.reason_code {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        other => other.to_string(),
    };

    // Signature formula:
    // merchantAccount;orderReference;amount;currency;authCode;cardPan;transactionStatus;reasonCode
    let signature_base = format!(
        "{};{};{};{};{};{};{};{}",
        payload.merchant_account,
        payload.order_reference,
        amount_str,
        payload.currency,
        payload.auth_code,
        payload.card_pan,
        payload.transaction_status,
        reason_code_str
    );
    let expected_signature = hmac_md5_hex(&config.secret_key, &signature_base);

    if expected_signature
        .as_bytes()
        .ct_eq(payload.merchant_signature.as_bytes())
        .unwrap_u8()
        != 1
    {
        warn!(
            "WayForPay signature mismatch: expected {}, got {}",
            expected_signature, payload.merchant_signature
        );
        return Err((StatusCode::BAD_REQUEST, "Invalid merchant signature".to_string()));
    }

    let ack_time = Utc::now().timestamp();
    let ack_sig_base = format!("{};accept;{}", payload.order_reference, ack_time);
    let ack_signature = hmac_md5_hex(&config.secret_key, &ack_sig_base);

    let ack = json!({
        "orderReference": payload.order_reference,
        "status": "accept",
        "time": ack_time,
        "signature": ack_signature
    });

    // Idempotency tracking
    let inserted = sqlx::query(
        "INSERT INTO wayforpay_events (signature, order_reference, status) VALUES ($1, $2, $3) ON CONFLICT (signature) DO NOTHING"
    )
    .bind(&payload.merchant_signature)
    .bind(&payload.order_reference)
    .bind(&payload.transaction_status)
    .execute(&state.pool)
    .await;

    if let Ok(res) = inserted {
        if res.rows_affected() == 0 {
            info!("Duplicate WayForPay webhook event for order '{}', returning accept ack", payload.order_reference);
            return Ok(Json(ack));
        }
    }

    if payload.transaction_status != "Approved" && payload.transaction_status != "Pending" {
        info!(
            "WayForPay webhook order '{}' with status '{}' does not grant plan access",
            payload.order_reference, payload.transaction_status
        );
        return Ok(Json(ack));
    }

    let Some((team_id, plan)) = parse_order_reference(&payload.order_reference) else {
        warn!("Could not parse team_id and plan from orderReference '{}'", payload.order_reference);
        return Ok(Json(ack));
    };

    let amount_num = amount_str.parse::<f64>().unwrap_or(16.0);
    let raw_payload = serde_json::to_value(&payload).unwrap_or_default();
    let payer_email = payload.email.as_deref().unwrap_or("customer@wayforpay.com");

    let update_res = sqlx::query(
        r#"
        UPDATE teams
        SET plan = $1,
            subscription_status = 'ACTIVE',
            subscription_id = $2,
            subscription_provider = 'WAYFORPAY',
            subscription_started_at = NOW()
        WHERE id = $3
        "#
    )
    .bind(&plan)
    .bind(&payload.order_reference)
    .bind(team_id)
    .execute(&state.pool)
    .await;

    if let Err(e) = update_res {
        warn!("Failed to update team plan for team {}: {:?}", team_id, e);
    } else {
        info!("WayForPay subscription activated for team {} (order {})", team_id, payload.order_reference);

        // Record in payment_transactions table for user visibility
        let _ = sqlx::query(
            r#"
            INSERT INTO payment_transactions (
                team_id, provider, transaction_id, payer_email, recipient_email,
                amount, currency, status, plan, billing_cycle, payload
            ) VALUES ($1, 'WAYFORPAY', $2, $3, 'WayForPay (respulse.online)', $4, $5, 'COMPLETED', $6, 'MONTHLY', $7)
            "#
        )
        .bind(team_id)
        .bind(&payload.order_reference)
        .bind(payer_email)
        .bind(amount_num)
        .bind(&payload.currency)
        .bind(&plan)
        .bind(raw_payload)
        .execute(&state.pool)
        .await;
    }

    Ok(Json(ack))
}

#[derive(Debug, Deserialize)]
struct RegularApiResponse {
    #[serde(rename = "reasonCode")]
    reason_code: i64,
    #[serde(default)]
    reason: String,
}

/// Cancels an active recurring subscription through WayForPay's regularApi.
pub async fn cancel_subscription(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, String)> {
    if !auth.role.can_manage_team() {
        return Err((
            StatusCode::FORBIDDEN,
            "Forbidden: Only team owners and administrators can manage subscriptions".to_string(),
        ));
    }

    let team: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT subscription_id, subscription_provider FROM teams WHERE id = $1"
    )
    .bind(auth.user.team_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (subscription_id, provider) = team;

    if let Some(config) = &state.wayforpay {
        if let Some(order_reference) = subscription_id.filter(|s| !s.trim().is_empty()) {
            if provider.as_deref() == Some("WAYFORPAY") && !config.merchant_password.is_empty() {
                let cancel_req = json!({
                    "requestType": "REMOVE",
                    "merchantAccount": config.merchant_account,
                    "merchantPassword": config.merchant_password,
                    "orderReference": order_reference,
                });

                let client = reqwest::Client::new();
                let res = client
                    .post(WAYFORPAY_REGULAR_API_URL)
                    .json(&cancel_req)
                    .send()
                    .await
                    .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Failed to reach WayForPay regularApi: {}", e)))?;

                let body: RegularApiResponse = res
                    .json()
                    .await
                    .map_err(|e| (StatusCode::BAD_GATEWAY, format!("Invalid regularApi JSON response: {}", e)))?;

                if body.reason_code != WAYFORPAY_REGULAR_API_OK && body.reason_code != WAYFORPAY_REGULAR_API_RULE_NOT_FOUND {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        format!("WayForPay regularApi rejected REMOVE: {} (code {})", body.reason, body.reason_code),
                    ));
                }
            }
        }
    }

    sqlx::query("UPDATE teams SET plan = 'FREE', subscription_status = 'CANCELED' WHERE id = $1")
        .bind(auth.user.team_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "status": "ok",
        "plan": "FREE",
        "message": "Subscription successfully canceled. Plan reverted to Free."
    })))
}

#[derive(Serialize)]
pub struct BillingStatusResponse {
    pub plan: String,
    pub subscription_status: String,
    pub subscription_id: Option<String>,
    pub subscription_provider: Option<String>,
    pub billing_enabled: bool,
    pub is_configured: bool,
}

pub async fn get_billing_status(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<BillingStatusResponse>, (StatusCode, String)> {
    let row: (String, String, Option<String>, Option<String>) = sqlx::query_as(
        "SELECT plan, subscription_status, subscription_id, subscription_provider FROM teams WHERE id = $1"
    )
    .bind(auth.user.team_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(BillingStatusResponse {
        plan: row.0,
        subscription_status: row.1,
        subscription_id: row.2,
        subscription_provider: row.3,
        billing_enabled: state.settings.billing_enabled,
        is_configured: state.wayforpay.is_some(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn order_reference_round_trip() {
        let team_id = Uuid::new_v4();
        let order_ref = build_order_reference(team_id, "PRO");
        let parsed = parse_order_reference(&order_ref);
        assert!(parsed.is_some());
        let (parsed_id, parsed_plan) = parsed.unwrap();
        assert_eq!(parsed_id, team_id);
        assert_eq!(parsed_plan, "PRO");
    }

    #[test]
    fn hmac_md5_calculates_correct_digest() {
        let digest = hmac_md5_hex("secret_key", "test_message");
        assert_eq!(digest.len(), 32);
        // Deterministic
        assert_eq!(digest, hmac_md5_hex("secret_key", "test_message"));
        assert_ne!(digest, hmac_md5_hex("other_key", "test_message"));
    }
}
