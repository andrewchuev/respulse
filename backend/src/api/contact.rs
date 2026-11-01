//! Public contact form of the landing page: validated, throttled per IP and relayed by email to the operator.

use crate::api::monitors::AppState;
use crate::email_verification::escape_html;
use crate::rate_limit::{client_ip, too_many_requests};
use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::json;
use std::net::SocketAddr;
use tracing::error;

const MAX_NAME_CHARS: usize = 100;
const MAX_EMAIL_CHARS: usize = 254;
const MIN_MESSAGE_CHARS: usize = 10;
const MAX_MESSAGE_CHARS: usize = 5000;

#[derive(Deserialize)]
pub struct ContactRequest {
    pub name: String,
    pub email: String,
    pub kind: String,
    pub message: String,
    /// Honeypot: hidden from people, so only bots fill it in.
    #[serde(default)]
    pub website: String,
}

struct ValidContact {
    name: String,
    email: String,
    kind_label: &'static str,
    message: String,
}

fn bad_request(msg: &str) -> (StatusCode, Response) {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": msg })).into_response())
}

fn error_response(status: StatusCode, msg: &str) -> (StatusCode, Response) {
    (status, Json(json!({ "error": msg })).into_response())
}

fn kind_label(kind: &str) -> Option<&'static str> {
    match kind {
        "bug" => Some("Bug report"),
        "question" => Some("Question"),
        "suggestion" => Some("Suggestion"),
        _ => None,
    }
}

/// Deliberately loose: the address is only used for replies, and a typo is caught by the sender's own mail client.
fn looks_like_email(email: &str) -> bool {
    if email.is_empty() || email.chars().count() > MAX_EMAIL_CHARS {
        return false;
    }
    if email.chars().any(|c| c.is_whitespace() || c.is_control() || matches!(c, '<' | '>' | ',' | ';' | '"')) {
        return false;
    }
    match email.split_once('@') {
        Some((local, domain)) => {
            !local.is_empty()
                && !domain.contains('@')
                && domain.contains('.')
                && !domain.starts_with('.')
                && !domain.ends_with('.')
                && !domain.contains("..")
        }
        None => false,
    }
}

fn validate(req: &ContactRequest) -> Result<ValidContact, &'static str> {
    let name = req.name.trim();
    if name.is_empty() {
        return Err("Name is required");
    }
    if name.chars().count() > MAX_NAME_CHARS {
        return Err("Name must be at most 100 characters");
    }
    if name.chars().any(|c| c.is_control()) {
        return Err("Name contains invalid characters");
    }

    let email = req.email.trim();
    if !looks_like_email(email) {
        return Err("Enter a valid email address");
    }

    let kind_label = kind_label(req.kind.trim()).ok_or("Choose a message type")?;

    let message = req.message.trim();
    let chars = message.chars().count();
    if chars < MIN_MESSAGE_CHARS {
        return Err("Message must be at least 10 characters");
    }
    if chars > MAX_MESSAGE_CHARS {
        return Err("Message must be at most 5000 characters");
    }

    Ok(ValidContact {
        name: name.to_string(),
        email: email.to_string(),
        kind_label,
        message: message.to_string(),
    })
}

/// `(subject, plain text, html)`. User input only appears in the bodies, never in headers.
fn build_email(contact: &ValidContact) -> (String, String, String) {
    let subject = format!("[ResPulse contact] {}", contact.kind_label);
    let text = format!(
        "Type: {}\nFrom: {} <{}>\n\n{}\n",
        contact.kind_label, contact.name, contact.email, contact.message
    );
    let html = format!(
        "<p><strong>Type:</strong> {}<br><strong>From:</strong> {} &lt;{}&gt;</p><p style=\"white-space:pre-wrap\">{}</p>",
        contact.kind_label,
        escape_html(&contact.name),
        escape_html(&contact.email),
        escape_html(&contact.message),
    );
    (subject, text, html)
}

pub async fn submit(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(payload): Json<ContactRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Response)> {
    let (Some(mailer), Some(recipient)) = (state.mailer.as_ref(), state.settings.contact_email.as_deref()) else {
        return Err(error_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "The contact form is not available right now. Please try again later.",
        ));
    };

    state
        .limits
        .check_contact(client_ip(&headers, peer))
        .map_err(too_many_requests)?;

    // Pretend success so bots get no signal to adapt to.
    if !payload.website.trim().is_empty() {
        return Ok(Json(json!({ "status": "ok" })));
    }

    let contact = validate(&payload).map_err(bad_request)?;
    let (subject, text, html) = build_email(&contact);

    mailer
        .send_with_reply_to(recipient, Some(&contact.email), &subject, text, html)
        .await
        .map_err(|e| {
            error!("Failed to deliver contact form message: {}", e);
            error_response(
                StatusCode::BAD_GATEWAY,
                "Could not deliver your message. Please try again later.",
            )
        })?;

    Ok(Json(json!({ "status": "ok" })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> ContactRequest {
        ContactRequest {
            name: "Eve".to_string(),
            email: "eve@example.com".to_string(),
            kind: "bug".to_string(),
            message: "The status page shows the wrong uptime.".to_string(),
            website: String::new(),
        }
    }

    #[test]
    fn accepts_a_well_formed_request_and_trims_it() {
        let mut req = request();
        req.name = "  Eve  ".to_string();
        req.email = " eve@example.com ".to_string();
        let ok = validate(&req).unwrap();
        assert_eq!(ok.name, "Eve");
        assert_eq!(ok.email, "eve@example.com");
        assert_eq!(ok.kind_label, "Bug report");
    }

    #[test]
    fn rejects_bad_names() {
        let mut req = request();
        req.name = "   ".to_string();
        assert!(validate(&req).is_err());
        req.name = "x".repeat(101);
        assert!(validate(&req).is_err());
        req.name = "Eve\r\nBcc: a@b.co".to_string();
        assert!(validate(&req).is_err());
    }

    #[test]
    fn rejects_malformed_emails() {
        for bad in ["", "eve", "eve@", "@example.com", "eve@example", "a b@example.com", "a@b@example.com", "eve@.com", "eve@example.com\nBcc: x@y.zz", "<eve@example.com>"] {
            let mut req = request();
            req.email = bad.to_string();
            assert!(validate(&req).is_err(), "{bad:?} should be rejected");
        }
    }

    #[test]
    fn rejects_unknown_kind() {
        let mut req = request();
        req.kind = "spam".to_string();
        assert!(validate(&req).is_err());
        for kind in ["bug", "question", "suggestion"] {
            req.kind = kind.to_string();
            assert!(validate(&req).is_ok());
        }
    }

    #[test]
    fn enforces_message_length_in_characters() {
        let mut req = request();
        req.message = "short".to_string();
        assert!(validate(&req).is_err());
        req.message = "я".repeat(5000);
        assert!(validate(&req).is_ok());
        req.message = "я".repeat(5001);
        assert!(validate(&req).is_err());
    }

    #[test]
    fn email_body_escapes_markup_and_keeps_headers_clean() {
        let mut req = request();
        req.name = "<b>Eve</b>".to_string();
        req.message = "<script>alert(1)</script> hello there".to_string();
        let (subject, text, html) = build_email(&validate(&req).unwrap());
        assert_eq!(subject, "[ResPulse contact] Bug report");
        assert!(text.contains("<script>"));
        assert!(html.contains("&lt;script&gt;"));
        assert!(!html.contains("<script>"));
        assert!(!html.contains("<b>Eve</b>"));
    }
}
