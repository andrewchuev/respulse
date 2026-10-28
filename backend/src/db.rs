use sqlx::postgres::PgPoolOptions;
use sqlx::{Pool, Postgres};
use std::time::Duration;
use tracing::info;

pub type DbPool = Pool<Postgres>;

/// Masks the password in a connection URL so it never reaches the logs.
fn redact_password(url: &str) -> String {
    let Some(scheme_end) = url.find("://") else {
        return url.to_string();
    };
    let creds_start = scheme_end + 3;
    // The last '@' separates credentials from the host, even if the password contains one.
    let Some(at) = url.rfind('@').filter(|at| *at > creds_start) else {
        return url.to_string();
    };
    match url[creds_start..at].split_once(':') {
        Some((user, _)) => format!("{}{}:***{}", &url[..creds_start], user, &url[at..]),
        None => url.to_string(),
    }
}

pub async fn init_db(database_url: &str) -> Result<DbPool, sqlx::Error> {
    info!("Connecting to PostgreSQL at {}", redact_password(database_url));
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(10))
        .connect(database_url)
        .await?;

    info!("Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await?;
    info!("Database migrations applied successfully.");

    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::redact_password;

    #[test]
    fn masks_password() {
        assert_eq!(
            redact_password("postgres://respulse:s3cret@respulse-db:5432/respulse"),
            "postgres://respulse:***@respulse-db:5432/respulse"
        );
    }

    #[test]
    fn masks_password_containing_at_sign() {
        assert_eq!(
            redact_password("postgres://u:p@ss@db:5432/x"),
            "postgres://u:***@db:5432/x"
        );
    }

    #[test]
    fn leaves_urls_without_password_untouched() {
        assert_eq!(redact_password("postgres://db:5432/x"), "postgres://db:5432/x");
        assert_eq!(redact_password("postgres://user@db:5432/x"), "postgres://user@db:5432/x");
    }
}
