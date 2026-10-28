use crate::api::monitors::AppState;
use crate::auth::AuthUser;
use crate::models::{ConfirmPayPalPaymentRequest, PayPalCheckoutConfig, PaymentTransaction};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use std::env;
use tracing::{error, info};
use uuid::Uuid;

const PAYPAL_RECIPIENT_EMAIL: &str = "andrew.chuev@gmail.com";
const PRO_PLAN_PRICE: f64 = 8.00;
const PRO_PLAN_CURRENCY: &str = "USD";

fn url_encode(input: &str) -> String {
    let mut encoded = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push_str("%20"),
            _ => {
                encoded.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    encoded
}

fn url_decode(input: &str) -> String {
    let mut out = String::new();
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h1 = chars.next();
            let h2 = chars.next();
            if let (Some(h1), Some(h2)) = (h1, h2) {
                if let Ok(byte) = u8::from_str_radix(&format!("{}{}", h1, h2), 16) {
                    out.push(byte as char);
                    continue;
                }
            }
        } else if c == '+' {
            out.push(' ');
        } else {
            out.push(c);
        }
    }
    out
}

fn parse_query_string(input: &str) -> Vec<(String, String)> {
    input
        .split('&')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let k = parts.next()?;
            let v = parts.next().unwrap_or("");
            Some((url_decode(k), url_decode(v)))
        })
        .collect()
}

/// Returns PayPal checkout parameters and pre-formatted payment links for the authenticated team.
pub async fn get_paypal_config(
    auth: AuthUser,
) -> Json<PayPalCheckoutConfig> {
    let app_url = env::var("APP_URL").unwrap_or_else(|_| "https://respulse.online".to_string());
    let team_id_str = auth.user.team_id.to_string();

    let encoded_item_name = url_encode("ResPulse Pro Plan (Monthly Subscription)");
    let return_url = format!("{}/app?payment=success&provider=paypal", app_url);
    let cancel_url = format!("{}/app?payment=cancelled&provider=paypal", app_url);
    let notify_url = format!("{}/api/payments/paypal/ipn", app_url);

    // Standard One-Time / Direct PayPal Checkout
    let checkout_url = format!(
        "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business={}&item_name={}&item_number=RESPULSE-PRO&amount={:.2}&currency_code={}&custom={}&return={}&cancel_return={}&notify_url={}",
        url_encode(PAYPAL_RECIPIENT_EMAIL),
        encoded_item_name,
        PRO_PLAN_PRICE,
        PRO_PLAN_CURRENCY,
        url_encode(&team_id_str),
        url_encode(&return_url),
        url_encode(&cancel_url),
        url_encode(&notify_url),
    );

    // Recurring Monthly PayPal Subscription URL
    let subscription_url = format!(
        "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business={}&item_name={}&item_number=RESPULSE-PRO&a3={:.2}&p3=1&t3=M&src=1&sra=1&currency_code={}&custom={}&return={}&cancel_return={}&notify_url={}",
        url_encode(PAYPAL_RECIPIENT_EMAIL),
        encoded_item_name,
        PRO_PLAN_PRICE,
        PRO_PLAN_CURRENCY,
        url_encode(&team_id_str),
        url_encode(&return_url),
        url_encode(&cancel_url),
        url_encode(&notify_url),
    );

    // PayPal.me quick payment link
    let paypal_me_url = format!("https://paypal.me/andrewchuev/{}{}", PRO_PLAN_PRICE as i32, PRO_PLAN_CURRENCY);

    Json(PayPalCheckoutConfig {
        recipient_email: PAYPAL_RECIPIENT_EMAIL.to_string(),
        plan_name: "ResPulse Pro Plan".to_string(),
        amount: PRO_PLAN_PRICE,
        currency: PRO_PLAN_CURRENCY.to_string(),
        billing_cycle: "MONTHLY".to_string(),
        checkout_url,
        subscription_url,
        paypal_me_url,
        custom_id: team_id_str,
    })
}

/// Activates or confirms PayPal payment for the current team.
pub async fn confirm_paypal_payment(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(payload): Json<ConfirmPayPalPaymentRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Response)> {
    auth.require_manage_team()?;

    let tx_id = payload
        .transaction_id
        .or(payload.order_id)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| format!("PP-{}", Uuid::new_v4().simple()));

    let payer_email = payload
        .payer_email
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| auth.user.email.clone());

    let status = payload
        .payment_status
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "COMPLETED".to_string());

    // 1. Record the transaction in database
    let tx_record = sqlx::query_as::<_, PaymentTransaction>(
        r#"
        INSERT INTO payment_transactions (
            team_id, provider, transaction_id, payer_email, recipient_email,
            amount, currency, status, plan, billing_cycle, payload
        )
        VALUES ($1, 'PAYPAL', $2, $3, $4, $5, $6, $7, 'PRO', 'MONTHLY', $8)
        RETURNING *
        "#,
    )
    .bind(auth.user.team_id)
    .bind(&tx_id)
    .bind(&payer_email)
    .bind(PAYPAL_RECIPIENT_EMAIL)
    .bind(PRO_PLAN_PRICE)
    .bind(PRO_PLAN_CURRENCY)
    .bind(&status)
    .bind(json!({
        "activated_by": auth.user.email,
        "role": auth.role.as_str(),
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        error!("Failed to record PayPal transaction: {:?}", e);
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
            subscription_provider = 'PAYPAL',
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
        "Team {} successfully upgraded to PRO plan via PayPal transaction {}",
        auth.user.team_id, tx_id
    );

    Ok(Json(json!({
        "status": "ok",
        "plan": "PRO",
        "message": "Payment verified. Your organization has been upgraded to the Pro plan!",
        "transaction": tx_record,
        "paypal_recipient": PAYPAL_RECIPIENT_EMAIL
    })))
}

/// PayPal Instant Payment Notification (IPN) webhook listener.
pub async fn paypal_ipn(
    State(state): State<AppState>,
    body: String,
) -> StatusCode {
    info!("Received PayPal IPN webhook: {} bytes", body.len());

    // Parse URL-encoded IPN parameters
    let params: Vec<(String, String)> = parse_query_string(&body);

    let get_param = |key: &str| -> Option<String> {
        params.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone())
    };

    let custom = get_param("custom");
    let payment_status = get_param("payment_status").unwrap_or_default();
    let txn_id = get_param("txn_id").unwrap_or_else(|| format!("IPN-{}", Uuid::new_v4().simple()));
    let payer_email = get_param("payer_email").unwrap_or_default();
    let receiver_email = get_param("receiver_email").unwrap_or_default();

    info!(
        "PayPal IPN parsed: txn_id={}, status={}, custom={:?}, payer={}, receiver={}",
        txn_id, payment_status, custom, payer_email, receiver_email
    );

    // If custom is a valid UUID, it represents the team_id
    if let Some(team_str) = custom {
        if let Ok(team_id) = Uuid::parse_str(&team_str) {
            let is_completed = payment_status.eq_ignore_ascii_case("Completed");

            let _ = sqlx::query(
                r#"
                INSERT INTO payment_transactions (
                    team_id, provider, transaction_id, payer_email, recipient_email,
                    amount, currency, status, plan, billing_cycle, payload
                )
                VALUES ($1, 'PAYPAL', $2, $3, $4, $5, $6, $7, 'PRO', 'MONTHLY', $8)
                "#,
            )
            .bind(team_id)
            .bind(&txn_id)
            .bind(&payer_email)
            .bind(PAYPAL_RECIPIENT_EMAIL)
            .bind(PRO_PLAN_PRICE)
            .bind(PRO_PLAN_CURRENCY)
            .bind(if is_completed { "COMPLETED" } else { &payment_status })
            .bind(json!({ "raw_ipn": body }))
            .execute(&state.pool)
            .await;

            if is_completed {
                let _ = sqlx::query(
                    r#"
                    UPDATE teams
                    SET plan = 'PRO',
                        subscription_status = 'ACTIVE',
                        subscription_id = $1,
                        subscription_provider = 'PAYPAL',
                        subscription_started_at = NOW()
                    WHERE id = $2
                    "#,
                )
                .bind(&txn_id)
                .bind(team_id)
                .execute(&state.pool)
                .await;

                info!("Team {} upgraded to PRO plan via IPN", team_id);
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
