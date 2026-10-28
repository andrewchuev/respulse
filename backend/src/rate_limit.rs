//! Per-IP throttling for the unauthenticated auth endpoints.
//!
//! Registration is open to the internet and every login attempt costs a bcrypt verification,
//! so both are limited per client address to blunt brute force and CPU/signup abuse.

use crate::net_guard::is_forbidden_ip;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use governor::clock::{Clock, DefaultClock};
use governor::{DefaultKeyedRateLimiter, Quota, RateLimiter};
use serde_json::json;
use std::net::{IpAddr, SocketAddr};
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;

pub struct RateLimits {
    login: DefaultKeyedRateLimiter<IpAddr>,
    register: DefaultKeyedRateLimiter<IpAddr>,
    resend: DefaultKeyedRateLimiter<IpAddr>,
}

fn quota(replenish_every: Duration, burst: u32) -> Quota {
    Quota::with_period(replenish_every)
        .expect("non-zero period")
        .allow_burst(NonZeroU32::new(burst).expect("non-zero burst"))
}

impl RateLimits {
    pub fn new() -> Self {
        Self {
            // 10 attempts up front, then one every 6 seconds.
            login: RateLimiter::keyed(quota(Duration::from_secs(6), 10)),
            // 3 signups up front, then one every 20 minutes.
            register: RateLimiter::keyed(quota(Duration::from_secs(20 * 60), 3)),
            // 3 confirmation resends up front, then one every 10 minutes.
            resend: RateLimiter::keyed(quota(Duration::from_secs(10 * 60), 3)),
        }
    }

    pub fn check_login(&self, ip: IpAddr) -> Result<(), Duration> {
        Self::check(&self.login, ip)
    }

    pub fn check_register(&self, ip: IpAddr) -> Result<(), Duration> {
        Self::check(&self.register, ip)
    }

    pub fn check_resend(&self, ip: IpAddr) -> Result<(), Duration> {
        Self::check(&self.resend, ip)
    }

    fn check(limiter: &DefaultKeyedRateLimiter<IpAddr>, ip: IpAddr) -> Result<(), Duration> {
        limiter
            .check_key(&ip)
            .map_err(|not_until| not_until.wait_time_from(DefaultClock::default().now()))
    }

    /// Drops state of addresses that have fully recovered so the maps cannot grow unbounded.
    pub fn spawn_cleanup(self: &Arc<Self>) {
        let limits = Arc::clone(self);
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(600));
            loop {
                tick.tick().await;
                limits.login.retain_recent();
                limits.login.shrink_to_fit();
                limits.register.retain_recent();
                limits.register.shrink_to_fit();
                limits.resend.retain_recent();
                limits.resend.shrink_to_fit();
            }
        });
    }
}

/// The real client address. Behind the reverse proxy the TCP peer is an internal address, so the
/// last `X-Forwarded-For` entry (appended by the proxy itself, never by the client) is used;
/// from any public peer the header is ignored because it could be forged.
pub fn client_ip(headers: &HeaderMap, peer: SocketAddr) -> IpAddr {
    let peer_ip = peer.ip();
    if !is_forbidden_ip(peer_ip) {
        return peer_ip;
    }
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.rsplit(',').next())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(peer_ip)
}

pub fn too_many_requests(retry_after: Duration) -> (StatusCode, Response) {
    let secs = retry_after.as_secs().max(1);
    let mut response = Json(json!({
        "error": "Too many attempts. Please try again later.",
        "retry_after_seconds": secs
    }))
    .into_response();
    response.headers_mut().insert(header::RETRY_AFTER, secs.into());
    (StatusCode::TOO_MANY_REQUESTS, response)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn login_allows_burst_then_throttles_per_ip() {
        let limits = RateLimits::new();
        for _ in 0..10 {
            assert!(limits.check_login(ip("203.0.113.9")).is_ok());
        }
        assert!(limits.check_login(ip("203.0.113.9")).is_err());
        assert!(limits.check_login(ip("198.51.100.7")).is_ok());
    }

    #[test]
    fn register_allows_three_signups() {
        let limits = RateLimits::new();
        for _ in 0..3 {
            assert!(limits.check_register(ip("203.0.113.9")).is_ok());
        }
        assert!(limits.check_register(ip("203.0.113.9")).is_err());
    }

    #[test]
    fn forwarded_header_is_trusted_only_from_internal_peers() {
        let mut headers = HeaderMap::new();
        headers.insert("x-forwarded-for", "6.6.6.6, 203.0.113.9".parse().unwrap());

        let proxy: SocketAddr = "172.18.0.5:40000".parse().unwrap();
        assert_eq!(client_ip(&headers, proxy), ip("203.0.113.9"));

        let public_peer: SocketAddr = "8.8.4.4:40000".parse().unwrap();
        assert_eq!(client_ip(&headers, public_peer), ip("8.8.4.4"));

        assert_eq!(client_ip(&HeaderMap::new(), proxy), ip("172.18.0.5"));
    }
}
