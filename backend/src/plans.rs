//! Plan limits and operator-level settings.
//!
//! The service currently runs as a free open beta: the Free limits below are what every new team
//! gets, and paid checkout stays off (`BILLING_ENABLED`) until a payment provider is chosen.

use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct PlanLimits {
    pub max_monitors: i64,
    pub min_interval_seconds: i32,
    pub max_members: i64,
    pub retention_days: i32,
}

pub const FREE: PlanLimits = PlanLimits {
    max_monitors: 20,
    min_interval_seconds: 60,
    max_members: 1,
    retention_days: 30,
};

pub const PRO: PlanLimits = PlanLimits {
    max_monitors: 100,
    min_interval_seconds: 10,
    max_members: 10,
    retention_days: 90,
};

pub fn limits(plan: &str) -> PlanLimits {
    if plan == "PRO" {
        PRO
    } else {
        FREE
    }
}

pub struct AppSettings {
    /// Shows the paywall (upgrade buttons, checkout) when true.
    pub billing_enabled: bool,
    /// Lower-cased emails allowed to open the operator report.
    pub admin_emails: Vec<String>,
    /// Signups must confirm their email before they can sign in.
    pub require_email_verification: bool,
    /// Public base URL used in emailed links.
    pub app_url: String,
}

impl AppSettings {
    pub fn from_env() -> Self {
        let billing_enabled = std::env::var("BILLING_ENABLED")
            .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
            .unwrap_or(false);
        let admin_emails: Vec<String> = std::env::var("ADMIN_EMAILS")
            .unwrap_or_default()
            .split(',')
            .map(|e| e.trim().to_lowercase())
            .filter(|e| !e.is_empty())
            .collect();
        let require_email_verification = std::env::var("REQUIRE_EMAIL_VERIFICATION")
            .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
            .unwrap_or(false);
        let app_url = std::env::var("APP_URL")
            .ok()
            .filter(|u| !u.trim().is_empty())
            .unwrap_or_else(|| "http://localhost:8080".to_string());
        Self { billing_enabled, admin_emails, require_email_verification, app_url }
    }

    pub fn is_admin(&self, email: &str) -> bool {
        let email = email.trim().to_lowercase();
        self.admin_emails.iter().any(|a| *a == email)
    }

    /// Appended to limit errors only when there is actually something to upgrade to.
    pub fn upgrade_hint(&self) -> &'static str {
        if self.billing_enabled {
            " Upgrade to Pro for higher limits."
        } else {
            ""
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn free_limits_apply_unless_pro() {
        assert_eq!(limits("FREE").max_monitors, 20);
        assert_eq!(limits("FREE").min_interval_seconds, 60);
        assert_eq!(limits("PRO").min_interval_seconds, 10);
        assert_eq!(limits("anything-else").max_members, 1);
    }

    #[test]
    fn admin_match_is_case_insensitive() {
        let settings = AppSettings {
            billing_enabled: false,
            admin_emails: vec!["boss@example.com".to_string()],
            require_email_verification: false,
            app_url: String::new(),
        };
        assert!(settings.is_admin(" Boss@Example.com "));
        assert!(!settings.is_admin("other@example.com"));
        let empty = AppSettings {
            billing_enabled: false,
            admin_emails: vec![],
            require_email_verification: false,
            app_url: String::new(),
        };
        assert!(!empty.is_admin(""));
    }
}
