//! FastSpring webhook events: parsing and billing state transitions.
//!
//! Payload shapes follow https://developer.fastspring.com/reference/webhooks-overview (with
//! webhook expansion enabled). The fields used here differ per event type, so everything is
//! looked up defensively and an event that cannot be tied to our product and a team is ignored
//! (and recorded) instead of guessed at.

use crate::db::DbPool;
use serde_json::Value;
use uuid::Uuid;

pub const PRODUCT_PATH: &str = "respulse-pro-plan";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    /// Purchase or renewal: the team is (still) on Pro.
    Upgrade,
    /// Cancellation requested; access continues until the period ends.
    Canceled,
    /// Subscription ended: the team drops back to Free.
    Deactivated,
    /// A refund was issued for an earlier order.
    Return,
    Other,
}

/// What a `return.created` event says about the refund.
#[derive(Debug, Default)]
pub struct Refund {
    pub return_id: Option<String>,
    pub original_order_id: Option<String>,
    pub original_reference: Option<String>,
    pub total: Option<f64>,
    /// Every returned item is marked "Full Refund".
    pub all_items_full: bool,
    /// The refund is still being processed; it is applied once FastSpring reports it completed.
    pub completed: bool,
}

#[derive(Debug)]
pub struct FsEvent {
    pub id: Option<String>,
    pub event_type: String,
    pub kind: Kind,
    pub live: Option<bool>,
    pub order_id: Option<String>,
    pub subscription_id: Option<String>,
    pub products: Vec<String>,
    pub email: Option<String>,
    pub team_hint: Option<Uuid>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    /// Events that carry a charge and belong in the payment history.
    pub records_payment: bool,
    pub refund: Option<Refund>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    Applied(Uuid),
    Ignored(&'static str),
}

fn str_at<'a>(v: &'a Value, path: &[&str]) -> Option<&'a str> {
    let mut cur = v;
    for key in path {
        cur = cur.get(*key)?;
    }
    cur.as_str().filter(|s| !s.trim().is_empty())
}

/// An id that is either an expanded object (`{"id": ...}`) or, without webhook expansion, a bare string.
fn id_of(v: Option<&Value>) -> Option<String> {
    match v? {
        Value::String(s) if !s.trim().is_empty() => Some(s.clone()),
        Value::Object(_) => str_at(v?, &["id"]).map(str::to_string),
        _ => None,
    }
}

/// A product path that is either a plain string or `{"product": "<path>"}`.
fn product_of(v: Option<&Value>, out: &mut Vec<String>) {
    match v {
        Some(Value::String(s)) => out.push(s.clone()),
        Some(obj @ Value::Object(_)) => {
            if let Some(p) = str_at(obj, &["product"]) {
                out.push(p.to_string());
            }
        }
        _ => {}
    }
}

fn items_products(items: Option<&Value>, out: &mut Vec<String>) {
    if let Some(Value::Array(items)) = items {
        for item in items {
            product_of(item.get("product"), out);
        }
    }
}

fn team_hint(data: &Value) -> Option<Uuid> {
    let candidates = [
        data.get("tags"),
        data.get("order").and_then(|o| o.get("tags")),
        data.get("subscription").and_then(|s| s.get("tags")),
    ];
    for tags in candidates.into_iter().flatten() {
        if let Some(id) = str_at(tags, &["team_id"]).and_then(|s| Uuid::parse_str(s).ok()) {
            return Some(id);
        }
    }
    [str_at(data, &["referrer"]), str_at(data, &["order", "referrer"])]
        .into_iter()
        .flatten()
        .find_map(|s| Uuid::parse_str(s).ok())
}

pub fn parse_event(event: &Value) -> FsEvent {
    let data = event.get("data").unwrap_or(event);
    let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("").to_string();

    let kind = match event_type.as_str() {
        "order.completed" | "subscription.activated" | "subscription.charge.completed" => Kind::Upgrade,
        "subscription.canceled" => Kind::Canceled,
        "subscription.deactivated" => Kind::Deactivated,
        "return.created" => Kind::Return,
        _ => Kind::Other,
    };

    // `live` sits on the event envelope; some payloads repeat it inside the order.
    let live = event
        .get("live")
        .and_then(|v| v.as_bool())
        .or_else(|| data.get("live").and_then(|v| v.as_bool()))
        .or_else(|| data.get("order").and_then(|o| o.get("live")).and_then(|v| v.as_bool()));

    let order_id = if event_type == "order.completed" {
        str_at(data, &["id"]).map(str::to_string)
    } else {
        id_of(data.get("order"))
    };

    let subscription_id = match event_type.as_str() {
        "subscription.activated" | "subscription.canceled" | "subscription.deactivated" => {
            str_at(data, &["id"]).map(str::to_string).or_else(|| id_of(data.get("subscription")))
        }
        _ => id_of(data.get("subscription")),
    };

    let mut products = Vec::new();
    items_products(data.get("items"), &mut products);
    product_of(data.get("product"), &mut products);
    items_products(data.get("order").and_then(|o| o.get("items")), &mut products);
    product_of(data.get("subscription").and_then(|s| s.get("product")), &mut products);

    let email = str_at(data, &["account", "contact", "email"])
        .or_else(|| str_at(data, &["customer", "email"]))
        .or_else(|| str_at(data, &["order", "customer", "email"]))
        .map(str::to_string);

    let amount = data
        .get("total")
        .and_then(|v| v.as_f64())
        .or_else(|| data.get("order").and_then(|o| o.get("total")).and_then(|v| v.as_f64()));
    let currency = str_at(data, &["currency"])
        .or_else(|| str_at(data, &["order", "currency"]))
        .map(str::to_string);

    let refund = (kind == Kind::Return).then(|| parse_refund(data));

    FsEvent {
        id: event.get("id").and_then(|v| v.as_str()).map(str::to_string),
        records_payment: matches!(event_type.as_str(), "order.completed" | "subscription.charge.completed"),
        event_type,
        kind,
        live,
        order_id,
        subscription_id,
        products,
        email,
        team_hint: team_hint(data),
        amount,
        currency,
        refund,
    }
}

fn parse_refund(data: &Value) -> Refund {
    let items = data.get("items").and_then(|i| i.as_array());
    let all_items_full = items.is_some_and(|items| {
        !items.is_empty()
            && items.iter().all(|item| {
                item.get("refundType")
                    .and_then(|t| t.as_str())
                    .is_some_and(|t| t.eq_ignore_ascii_case("Full Refund"))
            })
    });

    Refund {
        return_id: str_at(data, &["return"]).map(str::to_string),
        // `original.order` duplicates `original.id` for backward compatibility.
        original_order_id: str_at(data, &["original", "id"])
            .or_else(|| str_at(data, &["original", "order"]))
            .map(str::to_string),
        original_reference: str_at(data, &["original", "reference"]).map(str::to_string),
        total: data.get("totalReturn").and_then(|v| v.as_f64()),
        all_items_full,
        // Absent means a payload shape we have not seen; only an explicit false is held back.
        completed: data.get("completed").and_then(|v| v.as_bool()).unwrap_or(true),
    }
}

/// Finds the team an event belongs to: the subscription we stored on activation, then the team id
/// attached at checkout (when FastSpring echoes it), then the buyer's email among owners/admins.
async fn resolve_team(pool: &DbPool, ev: &FsEvent) -> Result<Option<Uuid>, sqlx::Error> {
    if let Some(sub) = ev.subscription_id.as_deref() {
        let found: Option<Uuid> = sqlx::query_scalar(
            "SELECT id FROM teams WHERE subscription_id = $1 AND subscription_provider = 'FASTSPRING'",
        )
        .bind(sub)
        .fetch_optional(pool)
        .await?;
        if found.is_some() {
            return Ok(found);
        }
    }

    if let Some(hint) = ev.team_hint {
        let found: Option<Uuid> = sqlx::query_scalar("SELECT id FROM teams WHERE id = $1")
            .bind(hint)
            .fetch_optional(pool)
            .await?;
        if found.is_some() {
            return Ok(found);
        }
    }

    if let Some(email) = ev.email.as_deref() {
        return sqlx::query_scalar(
            "SELECT team_id FROM users
             WHERE lower(email) = lower($1) AND is_active = TRUE AND role IN ('OWNER', 'ADMIN')",
        )
        .bind(email)
        .fetch_optional(pool)
        .await;
    }

    Ok(None)
}

pub async fn process_event(
    pool: &DbPool,
    ev: &FsEvent,
    raw: &Value,
    live_mode: bool,
    store_label: &str,
) -> Result<Outcome, sqlx::Error> {
    if ev.kind == Kind::Other {
        return Ok(Outcome::Ignored("unhandled event type"));
    }
    // A test-store order must never grant Pro on a live deployment.
    if live_mode && ev.live == Some(false) {
        return Ok(Outcome::Ignored("test event in live mode"));
    }
    if ev.kind == Kind::Return {
        return process_return(pool, ev).await;
    }
    if !ev.products.iter().any(|p| p == PRODUCT_PATH) {
        return Ok(Outcome::Ignored("event is not for the Pro product"));
    }

    let Some(team_id) = resolve_team(pool, ev).await? else {
        return Ok(Outcome::Ignored("no matching team"));
    };

    match ev.kind {
        Kind::Upgrade => {
            let mut tx = pool.begin().await?;

            sqlx::query(
                r#"
                UPDATE teams
                SET subscription_started_at = CASE WHEN plan <> 'PRO' THEN NOW() ELSE subscription_started_at END,
                    plan = 'PRO',
                    subscription_status = 'ACTIVE',
                    subscription_provider = 'FASTSPRING',
                    subscription_id = COALESCE($1, subscription_id, $2)
                WHERE id = $3
                "#,
            )
            .bind(ev.subscription_id.as_deref())
            .bind(ev.order_id.as_deref())
            .bind(team_id)
            .execute(&mut *tx)
            .await?;

            if let (true, Some(order_id)) = (ev.records_payment, ev.order_id.as_deref()) {
                // Manual resends carry new event ids, so the order id is the real duplicate key.
                sqlx::query(
                    r#"
                    INSERT INTO payment_transactions (
                        team_id, provider, transaction_id, payer_email, recipient_email,
                        amount, currency, status, plan, billing_cycle, payload
                    )
                    SELECT $1, 'FASTSPRING', $2, $3, $4, $5, $6, 'COMPLETED', 'PRO', 'MONTHLY', $7
                    WHERE NOT EXISTS (
                        SELECT 1 FROM payment_transactions
                        WHERE provider = 'FASTSPRING' AND transaction_id = $2
                    )
                    "#,
                )
                .bind(team_id)
                .bind(order_id)
                .bind(ev.email.as_deref().unwrap_or(""))
                .bind(store_label)
                .bind(ev.amount.unwrap_or(0.0))
                .bind(ev.currency.as_deref().unwrap_or("USD"))
                .bind(raw)
                .execute(&mut *tx)
                .await?;
            }

            tx.commit().await?;
            Ok(Outcome::Applied(team_id))
        }
        Kind::Canceled | Kind::Deactivated => {
            let (plan_sql, status) = if ev.kind == Kind::Canceled {
                ("plan", "CANCELED")
            } else {
                ("'FREE'", "DEACTIVATED")
            };
            // An old subscription ending must not downgrade a team that has since bought a new one.
            let query = format!(
                "UPDATE teams SET plan = {plan_sql}, subscription_status = $1
                 WHERE id = $2 AND ($3::text IS NULL OR subscription_id IS NULL OR subscription_id = $3)"
            );
            let affected = sqlx::query(&query)
                .bind(status)
                .bind(team_id)
                .bind(ev.subscription_id.as_deref())
                .execute(pool)
                .await?
                .rows_affected();

            if affected == 0 {
                Ok(Outcome::Ignored("event is for a superseded subscription"))
            } else {
                Ok(Outcome::Applied(team_id))
            }
        }
        Kind::Return | Kind::Other => Ok(Outcome::Ignored("unhandled event type")),
    }
}

/// Marks the original payment as (partially) refunded. The plan is untouched on purpose: a refund
/// that also ends the subscription is followed by `subscription.deactivated`.
async fn process_return(pool: &DbPool, ev: &FsEvent) -> Result<Outcome, sqlx::Error> {
    let Some(refund) = ev.refund.as_ref() else {
        return Ok(Outcome::Ignored("return without details"));
    };
    if !refund.completed {
        return Ok(Outcome::Ignored("return is not completed yet"));
    }
    let Some(total) = refund.total.filter(|t| *t > 0.0) else {
        return Ok(Outcome::Ignored("return without an amount"));
    };
    if refund.original_order_id.is_none() && refund.original_reference.is_none() {
        return Ok(Outcome::Ignored("return does not reference an order"));
    }

    // The original order is stored under its id; its customer-facing reference sits in the raw payload.
    let tx: Option<(Uuid, Uuid, f64, Vec<String>)> = sqlx::query_as(
        r#"
        SELECT id, team_id, amount, refund_ids FROM payment_transactions
        WHERE provider = 'FASTSPRING'
          AND (transaction_id = $1
               OR payload->'data'->>'reference' = $2
               OR payload->'data'->'order'->>'reference' = $2)
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(refund.original_order_id.as_deref())
    .bind(refund.original_reference.as_deref())
    .fetch_optional(pool)
    .await?;

    let Some((tx_id, team_id, amount, refund_ids)) = tx else {
        return Ok(Outcome::Ignored("no matching payment for the return"));
    };

    // A manual resend carries a new event id but the same return id.
    if let Some(return_id) = refund.return_id.as_deref() {
        if refund_ids.iter().any(|id| id == return_id) {
            return Ok(Outcome::Ignored("return already recorded"));
        }
    }

    let fully_refunded = refund.all_items_full || total >= amount - 0.01;
    sqlx::query(
        r#"
        UPDATE payment_transactions
        SET refunded_amount = LEAST(amount, refunded_amount + $2),
            refunded_at = NOW(),
            refund_ids = CASE WHEN $3::text IS NULL THEN refund_ids ELSE array_append(refund_ids, $3) END,
            status = CASE WHEN $4 OR refunded_amount + $2 >= amount - 0.01 THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END
        WHERE id = $1
        "#,
    )
    .bind(tx_id)
    .bind(if fully_refunded { amount.max(total) } else { total })
    .bind(refund.return_id.as_deref())
    .bind(fully_refunded)
    .execute(pool)
    .await?;

    Ok(Outcome::Applied(team_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const TEAM: &str = "11111111-2222-3333-4444-555555555555";

    #[test]
    fn parses_order_completed() {
        let ev = parse_event(&json!({
            "id": "evt1", "live": false, "type": "order.completed",
            "data": {
                "id": "ord_1", "reference": "ABC-1", "total": 8.0, "currency": "USD",
                "customer": {"email": "buyer@example.com"},
                "items": [{"product": "respulse-pro-plan"}],
                "tags": {"team_id": TEAM}
            }
        }));
        assert_eq!(ev.kind, Kind::Upgrade);
        assert_eq!(ev.id.as_deref(), Some("evt1"));
        assert_eq!(ev.live, Some(false));
        assert_eq!(ev.order_id.as_deref(), Some("ord_1"));
        assert_eq!(ev.products, vec!["respulse-pro-plan"]);
        assert_eq!(ev.email.as_deref(), Some("buyer@example.com"));
        assert_eq!(ev.team_hint, Some(Uuid::parse_str(TEAM).unwrap()));
        assert_eq!(ev.amount, Some(8.0));
        assert!(ev.records_payment);
    }

    #[test]
    fn parses_subscription_activated_with_object_product() {
        let ev = parse_event(&json!({
            "id": "evt2", "live": true, "type": "subscription.activated",
            "data": {
                "id": "sub_1", "subscription": "sub_1",
                "account": {"contact": {"email": "owner@example.com"}},
                "product": {"product": "respulse-pro-plan"}
            }
        }));
        assert_eq!(ev.subscription_id.as_deref(), Some("sub_1"));
        assert_eq!(ev.products, vec!["respulse-pro-plan"]);
        assert_eq!(ev.email.as_deref(), Some("owner@example.com"));
        assert!(!ev.records_payment);
    }

    #[test]
    fn parses_charge_completed_with_nested_order() {
        let ev = parse_event(&json!({
            "id": "evt3", "live": true, "type": "subscription.charge.completed",
            "data": {
                "total": 8, "currency": "USD",
                "subscription": {"id": "sub_1", "product": "respulse-pro-plan"},
                "order": {"id": "ord_2", "items": [{"product": "respulse-pro-plan", "subscription": "sub_1"}]}
            }
        }));
        assert_eq!(ev.order_id.as_deref(), Some("ord_2"));
        assert_eq!(ev.subscription_id.as_deref(), Some("sub_1"));
        assert!(ev.products.iter().all(|p| p == "respulse-pro-plan"));
        assert_eq!(ev.amount, Some(8.0));
        assert!(ev.records_payment);
    }

    #[test]
    fn parses_unexpanded_references_and_exponent_totals() {
        let ev = parse_event(&json!({
            "id": "evt4", "live": true, "type": "subscription.charge.completed",
            "data": {"order": "ord_3", "subscription": "sub_9", "total": 4E+1}
        }));
        assert_eq!(ev.order_id.as_deref(), Some("ord_3"));
        assert_eq!(ev.subscription_id.as_deref(), Some("sub_9"));
        assert_eq!(ev.amount, Some(40.0));
        assert!(ev.products.is_empty());
    }

    #[test]
    fn classifies_lifecycle_events() {
        let kind = |t: &str| parse_event(&json!({"type": t, "data": {}})).kind;
        assert_eq!(kind("subscription.canceled"), Kind::Canceled);
        assert_eq!(kind("subscription.deactivated"), Kind::Deactivated);
        assert_eq!(kind("order.completed"), Kind::Upgrade);
        assert_eq!(kind("mailingListEntry.updated"), Kind::Other);
    }

    #[test]
    fn live_flag_is_read_from_the_envelope_first() {
        let ev = parse_event(&json!({"live": false, "type": "order.completed", "data": {"live": true}}));
        assert_eq!(ev.live, Some(false));
        let ev = parse_event(&json!({"type": "subscription.charge.completed", "data": {"order": {"live": true}}}));
        assert_eq!(ev.live, Some(true));
    }

    #[test]
    fn referrer_is_a_team_hint() {
        let ev = parse_event(&json!({"type": "order.completed", "data": {"referrer": TEAM}}));
        assert_eq!(ev.team_hint, Some(Uuid::parse_str(TEAM).unwrap()));
        let ev = parse_event(&json!({"type": "order.completed", "data": {"referrer": "not-a-uuid"}}));
        assert_eq!(ev.team_hint, None);
    }

    #[test]
    fn parses_return_created() {
        let ev = parse_event(&json!({
            "id": "evr1", "live": false, "type": "return.created",
            "data": {
                "return": "ret_1", "reference": "ABC-1", "completed": true, "currency": "USD",
                "totalReturn": 9.6, "type": "RETURN",
                "original": {"id": "ord_1", "order": "ord_1", "reference": "ABC-1"},
                "items": [{"product": "respulse-pro-plan", "refundType": "Full Refund"}]
            }
        }));
        assert_eq!(ev.kind, Kind::Return);
        let r = ev.refund.expect("refund details");
        assert_eq!(r.return_id.as_deref(), Some("ret_1"));
        assert_eq!(r.original_order_id.as_deref(), Some("ord_1"));
        assert_eq!(r.original_reference.as_deref(), Some("ABC-1"));
        assert_eq!(r.total, Some(9.6));
        assert!(r.all_items_full && r.completed);
    }

    #[test]
    fn return_defaults_and_partial_detection() {
        let ev = parse_event(&json!({
            "type": "return.created",
            "data": {
                "return": "ret_2", "totalReturn": 3.0, "original": {"order": "ord_2"},
                "items": [{"refundType": "Full Refund"}, {"refundType": "Partial Refund"}]
            }
        }));
        let r = ev.refund.unwrap();
        assert_eq!(r.original_order_id.as_deref(), Some("ord_2"));
        assert!(!r.all_items_full);
        assert!(r.completed, "a missing completed flag is not held back");

        let held = parse_event(&json!({"type": "return.created", "data": {"completed": false}}));
        assert!(!held.refund.unwrap().completed);
    }
}
