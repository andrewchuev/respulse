//! Outbound request policy: keeps probes and notifications away from internal networks (SSRF).
//!
//! Any user can point a monitor or a webhook at an arbitrary host, so by default the server only
//! talks to public addresses. Hostnames are checked at connect time (not just on save) to defeat
//! DNS rebinding; IP literals and redirect targets are checked explicitly because the DNS
//! resolver never sees them.

use reqwest::dns::{Addrs, Name, Resolve, Resolving};
use reqwest::{redirect, Client, Url};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::sync::{Arc, OnceLock};

const MAX_REDIRECTS: usize = 10;
const FORBIDDEN_MSG: &str = "target resolves to a private or reserved address, which is not allowed";

#[derive(Clone, Copy, Debug)]
pub struct TargetPolicy {
    allow_private: bool,
}

static POLICY: OnceLock<TargetPolicy> = OnceLock::new();

/// Installs the process-wide policy from `ALLOW_PRIVATE_TARGETS`; call once at startup.
pub fn init_from_env() -> TargetPolicy {
    let allow_private = std::env::var("ALLOW_PRIVATE_TARGETS")
        .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
        .unwrap_or(false);
    *POLICY.get_or_init(|| TargetPolicy { allow_private })
}

/// Strict unless `init_from_env` opted in, so a forgotten init can never open the network.
pub fn policy() -> TargetPolicy {
    POLICY.get().copied().unwrap_or(TargetPolicy { allow_private: false })
}

impl TargetPolicy {
    #[cfg(test)]
    fn new(allow_private: bool) -> Self {
        Self { allow_private }
    }

    pub fn allow_private(&self) -> bool {
        self.allow_private
    }

    /// Checks IP-literal hosts of a URL. Domain names are left to the resolver at connect time.
    pub fn check_url(&self, url: &str) -> Result<(), String> {
        if self.allow_private {
            return Ok(());
        }
        let parsed = Url::parse(url).map_err(|e| format!("invalid URL: {}", e))?;
        match parsed.host() {
            Some(url::Host::Ipv4(ip)) if is_forbidden_ip(IpAddr::V4(ip)) => Err(FORBIDDEN_MSG.to_string()),
            Some(url::Host::Ipv6(ip)) if is_forbidden_ip(IpAddr::V6(ip)) => Err(FORBIDDEN_MSG.to_string()),
            Some(_) => Ok(()),
            None => Err("URL has no host".to_string()),
        }
    }

    /// Resolves `host` and keeps only public addresses; connecting to the returned
    /// `SocketAddr`s (not the hostname) closes the check-then-connect race.
    pub async fn resolve_allowed(&self, host: &str, port: u16) -> Result<Vec<SocketAddr>, String> {
        let addrs: Vec<SocketAddr> = tokio::net::lookup_host((host, port))
            .await
            .map_err(|e| format!("DNS lookup failed for {}: {}", host, e))?
            .collect();

        if self.allow_private {
            return Ok(addrs);
        }

        let allowed: Vec<SocketAddr> = addrs
            .into_iter()
            .filter(|addr| !is_forbidden_ip(addr.ip()))
            .collect();
        if allowed.is_empty() {
            return Err(FORBIDDEN_MSG.to_string());
        }
        Ok(allowed)
    }

    /// Save-time validation for fast feedback: rejects a host if any of its addresses is internal.
    /// Unresolvable names pass, the monitor simply reports DOWN.
    pub async fn validate_host(&self, host: &str) -> Result<(), String> {
        if self.allow_private {
            return Ok(());
        }
        let Ok(addrs) = tokio::net::lookup_host((host, 0)).await else {
            return Ok(());
        };
        if addrs.into_iter().any(|addr| is_forbidden_ip(addr.ip())) {
            return Err(FORBIDDEN_MSG.to_string());
        }
        Ok(())
    }

    /// Save-time validation of a full URL (monitor target, webhook endpoint).
    pub async fn validate_url(&self, url: &str) -> Result<(), String> {
        self.check_url(url)?;
        let parsed = Url::parse(url).map_err(|e| format!("invalid URL: {}", e))?;
        match parsed.host() {
            Some(url::Host::Domain(domain)) => self.validate_host(domain).await,
            _ => Ok(()),
        }
    }

    /// Builds the shared HTTP client: guarded DNS resolver plus redirect targets checked per hop.
    pub fn build_client(&self, user_agent: String) -> Client {
        let policy = *self;
        Client::builder()
            .user_agent(user_agent)
            .danger_accept_invalid_certs(true)
            .dns_resolver(Arc::new(GuardedResolver { policy }))
            .redirect(redirect::Policy::custom(move |attempt| {
                if attempt.previous().len() >= MAX_REDIRECTS {
                    return attempt.error("too many redirects");
                }
                match policy.check_url(attempt.url().as_str()) {
                    Ok(()) => attempt.follow(),
                    Err(e) => attempt.error(e),
                }
            }))
            .build()
            .expect("Failed to build reqwest client")
    }
}

struct GuardedResolver {
    policy: TargetPolicy,
}

impl Resolve for GuardedResolver {
    fn resolve(&self, name: Name) -> Resolving {
        let policy = self.policy;
        Box::pin(async move {
            let addrs = policy.resolve_allowed(name.as_str(), 0).await?;
            Ok(Box::new(addrs.into_iter()) as Addrs)
        })
    }
}

/// Extracts the bare host from a monitor target such as `https://user@host:8443/path`, `host:53`
/// or `[::1]:80`.
pub fn extract_host(target: &str) -> String {
    let without_scheme = target.split_once("://").map_or(target, |(_, rest)| rest);
    let authority = without_scheme
        .split(['/', '?', '#'])
        .next()
        .unwrap_or(without_scheme);
    let host_port = authority.rsplit_once('@').map_or(authority, |(_, h)| h);
    if let Some(rest) = host_port.strip_prefix('[') {
        return rest.split(']').next().unwrap_or(rest).to_string();
    }
    host_port.split(':').next().unwrap_or(host_port).to_string()
}

/// True for loopback, private, link-local, CGNAT, multicast, reserved and documentation ranges,
/// including IPv6 forms that embed an IPv4 address.
pub fn is_forbidden_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_forbidden_v4(v4),
        IpAddr::V6(v6) => is_forbidden_v6(v6),
    }
}

fn is_forbidden_v4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_multicast()
        || ip.is_documentation()
        || a == 0                                  // 0.0.0.0/8 "this network"
        || (a == 100 && (64..=127).contains(&b))   // 100.64.0.0/10 CGNAT
        || (a == 192 && b == 0 && c == 0)          // 192.0.0.0/24 IETF protocol assignments
        || (a == 198 && (b == 18 || b == 19))      // 198.18.0.0/15 benchmarking
        || a >= 240                                // 240.0.0.0/4 reserved
}

fn is_forbidden_v6(ip: Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4_mapped() {
        return is_forbidden_v4(v4);
    }

    let s = ip.segments();
    let embedded_v4 = |hi: u16, lo: u16| Ipv4Addr::new((hi >> 8) as u8, hi as u8, (lo >> 8) as u8, lo as u8);

    ip.is_unspecified()
        || ip.is_loopback()
        || ip.is_multicast()
        || (s[0] & 0xfe00) == 0xfc00                         // fc00::/7 unique local
        || (s[0] & 0xffc0) == 0xfe80                         // fe80::/10 link-local
        || (s[0] & 0xffc0) == 0xfec0                         // fec0::/10 deprecated site-local
        || (s[0] == 0x2001 && s[1] == 0x0db8)                // 2001:db8::/32 documentation
        || (s[0] == 0x2001 && s[1] == 0)                     // 2001::/32 Teredo
        || (s[0] == 0x0100 && s[1] == 0 && s[2] == 0 && s[3] == 0) // 100::/64 discard-only
        // IPv4-compatible ::a.b.c.d (deprecated)
        || (s[..6].iter().all(|x| *x == 0) && is_forbidden_v4(embedded_v4(s[6], s[7])))
        // NAT64 64:ff9b::/96 and 6to4 2002::/16 carry an IPv4 address
        || (s[0] == 0x0064 && s[1] == 0xff9b && s[2..6].iter().all(|x| *x == 0) && is_forbidden_v4(embedded_v4(s[6], s[7])))
        || (s[0] == 0x2002 && is_forbidden_v4(embedded_v4(s[1], s[2])))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn forbidden(ip: &str) -> bool {
        is_forbidden_ip(ip.parse().unwrap())
    }

    #[test]
    fn blocks_internal_ipv4_ranges() {
        for ip in [
            "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
            "100.64.0.1", "0.0.0.0", "0.1.2.3", "224.0.0.1", "255.255.255.255", "240.0.0.1",
            "198.18.0.1", "192.0.0.8", "192.0.2.1",
        ] {
            assert!(forbidden(ip), "{ip} should be forbidden");
        }
    }

    #[test]
    fn allows_public_ipv4() {
        for ip in ["1.1.1.1", "8.8.8.8", "93.184.216.34", "172.32.0.1", "100.63.255.255", "198.20.0.1"] {
            assert!(!forbidden(ip), "{ip} should be allowed");
        }
    }

    #[test]
    fn blocks_internal_ipv6_and_embedded_ipv4() {
        for ip in [
            "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "2001:db8::1",
            "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:169.254.169.254", "::127.0.0.1",
            "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "2002:7f00:1::1", "2002:a9fe:a9fe::1",
        ] {
            assert!(forbidden(ip), "{ip} should be forbidden");
        }
    }

    #[test]
    fn allows_public_ipv6() {
        for ip in ["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "64:ff9b::808:808"] {
            assert!(!forbidden(ip), "{ip} should be allowed");
        }
    }

    #[test]
    fn check_url_normalizes_numeric_hosts() {
        let strict = TargetPolicy::new(false);
        for url in [
            "http://127.0.0.1/", "http://2130706433/", "http://0x7f.0.0.1/", "http://[::1]:8080/",
            "http://169.254.169.254/latest/meta-data", "http://[::ffff:10.0.0.1]/", "http://0/",
        ] {
            assert!(strict.check_url(url).is_err(), "{url} should be rejected");
        }
        assert!(strict.check_url("https://example.com/").is_ok());
        assert!(strict.check_url("http://8.8.8.8/").is_ok());
        assert!(TargetPolicy::new(true).check_url("http://127.0.0.1/").is_ok());
    }

    #[test]
    fn extracts_hosts() {
        assert_eq!(extract_host("https://user:pw@example.com:8443/a?b=1"), "example.com");
        assert_eq!(extract_host("db.internal:5432"), "db.internal");
        assert_eq!(extract_host("1.1.1.1"), "1.1.1.1");
        assert_eq!(extract_host("[::1]:80"), "::1");
        assert_eq!(extract_host("http://host/path"), "host");
    }

    #[tokio::test]
    async fn resolver_filters_localhost() {
        let strict = TargetPolicy::new(false);
        assert!(strict.resolve_allowed("localhost", 80).await.is_err());
        assert!(strict.validate_host("localhost").await.is_err());
        assert!(TargetPolicy::new(true).resolve_allowed("localhost", 80).await.is_ok());
    }

    #[tokio::test]
    async fn redirect_to_internal_address_is_blocked() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        // The first hop is an IP literal, which only the probe-level check (not the client) vets;
        // the point here is that the redirect target gets rejected by the client's policy.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            loop {
                let (mut sock, _) = listener.accept().await.unwrap();
                let mut buf = [0u8; 1024];
                let _ = sock.read(&mut buf).await;
                let reply = "HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                let _ = sock.write_all(reply.as_bytes()).await;
            }
        });

        let client = TargetPolicy::new(false).build_client("test".to_string());
        let err = client.get(format!("http://127.0.0.1:{port}/")).send().await.unwrap_err();
        assert!(err.is_redirect(), "expected a redirect error, got: {err:?}");
        assert!(format!("{err:?}").contains("not allowed"), "unexpected error: {err:?}");
    }

    #[tokio::test]
    async fn guarded_client_refuses_localhost() {
        let client = TargetPolicy::new(false).build_client("test".to_string());
        let err = client.get("http://localhost:9/").send().await.unwrap_err();
        assert!(format!("{err:?}").contains("not allowed"), "unexpected error: {err:?}");
    }
}
