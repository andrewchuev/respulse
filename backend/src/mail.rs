//! Outgoing email over plain SMTP, so any provider (Brevo, SES, Resend, Postmark, a mail server) works.

use lettre::message::{header::ContentType, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use std::time::Duration;

pub struct Mailer {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
}

fn non_empty_env(name: &str) -> Option<String> {
    std::env::var(name).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

impl Mailer {
    /// `Ok(None)` when `SMTP_HOST` is unset; an error for a half-configured or invalid setup.
    pub fn from_env() -> Result<Option<Self>, String> {
        let Some(host) = non_empty_env("SMTP_HOST") else {
            return Ok(None);
        };
        let from: Mailbox = non_empty_env("SMTP_FROM")
            .ok_or("SMTP_FROM must be set when SMTP_HOST is set")?
            .parse()
            .map_err(|e| format!("invalid SMTP_FROM: {e}"))?;

        // starttls: port 587 (default), tls: implicit TLS on 465, none: local test servers only.
        let mode = non_empty_env("SMTP_TLS").unwrap_or_else(|| "starttls".to_string());
        let builder = match mode.as_str() {
            "starttls" => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host).map_err(|e| e.to_string())?,
            "tls" => AsyncSmtpTransport::<Tokio1Executor>::relay(&host).map_err(|e| e.to_string())?,
            "none" => AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&host),
            other => return Err(format!("SMTP_TLS must be starttls, tls or none, got '{other}'")),
        };

        let builder = match non_empty_env("SMTP_PORT") {
            Some(port) => builder.port(port.parse().map_err(|_| format!("invalid SMTP_PORT '{port}'"))?),
            None => builder,
        };
        let builder = match (non_empty_env("SMTP_USERNAME"), non_empty_env("SMTP_PASSWORD")) {
            (Some(user), Some(pass)) => builder.credentials(Credentials::new(user, pass)),
            _ => builder,
        };

        Ok(Some(Self {
            transport: builder.timeout(Some(Duration::from_secs(15))).build(),
            from,
        }))
    }

    pub async fn send(&self, to: &str, subject: &str, text: String, html: String) -> Result<(), String> {
        let to: Mailbox = to.parse().map_err(|e| format!("invalid recipient: {e}"))?;
        let message = Message::builder()
            .from(self.from.clone())
            .to(to)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(text))
                    .singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(html)),
            )
            .map_err(|e| e.to_string())?;

        self.transport.send(message).await.map(|_| ()).map_err(|e| e.to_string())
    }
}
