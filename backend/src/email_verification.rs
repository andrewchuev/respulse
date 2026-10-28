//! Email confirmation for self-service signups: single-use, expiring links.

use crate::api::monitors::AppState;
use crate::db::DbPool;
use crate::models::User;
use sha2::{Digest, Sha256};
use uuid::Uuid;

const TOKEN_TTL_HOURS: i32 = 24;
/// A new link is not sent again within this window, which also stops resend from being used to spam an inbox.
const RESEND_COOLDOWN_SECS: i32 = 60;

/// 64 hex characters from two random UUIDs (OS randomness); returns `(raw token, stored hash)`.
pub fn new_token() -> (String, String) {
    let raw = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let hash = hash_token(&raw);
    (raw, hash)
}

pub fn hash_token(raw: &str) -> String {
    Sha256::digest(raw.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// `(subject, plain text, html)` for the confirmation email.
pub fn build_email(app_url: &str, token: &str, name: &str) -> (String, String, String) {
    let link = format!("{}/verify-email?token={}", app_url.trim_end_matches('/'), token);
    let subject = "Confirm your ResPulse email".to_string();
    let text = format!(
        "Hi {name},\n\nConfirm your email address to finish creating your ResPulse account:\n\n{link}\n\n\
         The link works once and expires in {TOKEN_TTL_HOURS} hours. If you did not sign up, ignore this email.\n"
    );
    let html = format!(
        "<p>Hi {name},</p><p>Confirm your email address to finish creating your ResPulse account:</p>\
         <p><a href=\"{link}\">Confirm my email</a></p><p style=\"color:#666;font-size:12px\">\
         Or open this link: {link}<br>It works once and expires in {TOKEN_TTL_HOURS} hours. \
         If you did not sign up, ignore this email.</p>",
        name = escape_html(name),
    );
    (subject, text, html)
}

/// Stores a fresh token and emails the link. Returns `Ok(())` without sending during the cooldown.
pub async fn issue_and_send(state: &AppState, user: &User) -> Result<(), String> {
    let mailer = state.mailer.as_ref().ok_or("email sending is not configured")?;

    let recent: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM email_verifications
                        WHERE user_id = $1 AND created_at > NOW() - make_interval(secs => $2))",
    )
    .bind(user.id)
    .bind(RESEND_COOLDOWN_SECS as f64)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| e.to_string())?;
    if recent {
        return Ok(());
    }

    let (raw, hash) = new_token();
    sqlx::query(
        "INSERT INTO email_verifications (token_hash, user_id, expires_at)
         VALUES ($1, $2, NOW() + make_interval(hours => $3))",
    )
    .bind(&hash)
    .bind(user.id)
    .bind(TOKEN_TTL_HOURS)
    .execute(&state.pool)
    .await
    .map_err(|e| e.to_string())?;

    let (subject, text, html) = build_email(&state.settings.app_url, &raw, &user.name);
    mailer.send(&user.email, &subject, text, html).await
}

/// Consumes a token (single use) and marks its user verified. `None` for unknown or expired tokens.
pub async fn consume(pool: &DbPool, raw: &str) -> Result<Option<User>, sqlx::Error> {
    sqlx::query("DELETE FROM email_verifications WHERE expires_at < NOW()").execute(pool).await?;

    let user_id: Option<Uuid> = sqlx::query_scalar(
        "DELETE FROM email_verifications WHERE token_hash = $1 AND expires_at > NOW() RETURNING user_id",
    )
    .bind(hash_token(raw.trim()))
    .fetch_optional(pool)
    .await?;
    let Some(user_id) = user_id else {
        return Ok(None);
    };

    // Older links of the same user are obsolete once one has been used.
    sqlx::query("DELETE FROM email_verifications WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;

    sqlx::query_as::<_, User>(
        "UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW())
         WHERE id = $1 AND is_active = TRUE RETURNING *",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_are_long_random_and_hashed() {
        let (raw_a, hash_a) = new_token();
        let (raw_b, _) = new_token();
        assert_eq!(raw_a.len(), 64);
        assert_ne!(raw_a, raw_b);
        assert_eq!(hash_token(&raw_a), hash_a);
        assert_ne!(raw_a, hash_a);
        assert_eq!(hash_a.len(), 64);
    }

    #[test]
    fn email_contains_the_link_and_escapes_the_name() {
        let (subject, text, html) = build_email("https://respulse.online/", "abc123", "<b>Eve</b>");
        assert!(subject.contains("Confirm"));
        assert!(text.contains("https://respulse.online/verify-email?token=abc123"));
        assert!(html.contains("&lt;b&gt;Eve&lt;/b&gt;"));
        assert!(!html.contains("<b>Eve</b>"));
    }
}
