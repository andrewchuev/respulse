use crate::models::Monitor;
use crate::probe::http::ProbeResult;
use rustls::pki_types::ServerName;
use rustls::ClientConfig;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_rustls::TlsConnector;
use x509_parser::prelude::*;

pub async fn check_ssl(monitor: &Monitor) -> ProbeResult {
    let host = crate::net_guard::extract_host(&monitor.url);
    let host = host.as_str();

    let port = monitor.port.unwrap_or(443);
    let addr = format!("{}:{}", host, port);
    let to = Duration::from_secs(monitor.timeout_seconds.max(1) as u64);

    let mut root_store = rustls::RootCertStore::empty();
    root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());

    let config = ClientConfig::builder()
        .with_root_certificates(root_store)
        .with_no_client_auth();

    let connector = TlsConnector::from(Arc::new(config));

    let server_name = match ServerName::try_from(host.to_string()) {
        Ok(name) => name,
        Err(_) => {
            return ProbeResult {
                is_up: false,
                status_code: None,
                response_time_ms: 0.0,
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: None,
                error: Some(format!("Invalid hostname for SSL check: {}", host)),
            };
        }
    };

    // Connect to the vetted addresses instead of the hostname so DNS cannot change in between.
    let targets = match crate::net_guard::policy().resolve_allowed(host, port as u16).await {
        Ok(targets) => targets,
        Err(e) => {
            return ProbeResult {
                is_up: false,
                status_code: None,
                response_time_ms: 0.0,
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: None,
                error: Some(format!("SSL check to {}: {}", addr, e)),
            };
        }
    };

    let start = Instant::now();
    let stream_res = timeout(to, TcpStream::connect(&targets[..])).await;
    let stream = match stream_res {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            return ProbeResult {
                is_up: false,
                status_code: None,
                response_time_ms: start.elapsed().as_secs_f64() * 1000.0,
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: None,
                error: Some(format!("Failed to connect to {}: {}", addr, e)),
            };
        }
        Err(_) => {
            return ProbeResult {
                is_up: false,
                status_code: None,
                response_time_ms: start.elapsed().as_secs_f64() * 1000.0,
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: None,
                error: Some(format!("Timeout connecting to {}", addr)),
            };
        }
    };

    let tls_stream_res = timeout(to, connector.connect(server_name, stream)).await;
    match tls_stream_res {
        Ok(Ok(tls_stream)) => {
            let elapsed = start.elapsed().as_secs_f64() * 1000.0;
            let (_, session) = tls_stream.get_ref();
            if let Some(certs) = session.peer_certificates() {
                if let Some(first_cert) = certs.first() {
                    if let Ok((_, x509)) = parse_x509_certificate(first_cert.as_ref()) {
                        let not_after = x509.validity().not_after.timestamp();
                        let now = chrono::Utc::now().timestamp();
                        let days_left = (not_after - now) / 86400;

                        if days_left <= 0 {
                            return ProbeResult {
                                is_up: false,
                                status_code: None,
                                response_time_ms: elapsed,
                                dns_time_ms: None,
                                connect_time_ms: None,
                                tls_time_ms: Some(elapsed),
                                error: Some("SSL Certificate has EXPIRED".to_string()),
                            };
                        } else if days_left <= 7 {
                            return ProbeResult {
                                is_up: true,
                                status_code: None,
                                response_time_ms: elapsed,
                                dns_time_ms: None,
                                connect_time_ms: None,
                                tls_time_ms: Some(elapsed),
                                error: Some(format!("SSL Certificate expires soon: {} days remaining", days_left)),
                            };
                        }
                    }
                }
            }

            ProbeResult {
                is_up: true,
                status_code: None,
                response_time_ms: elapsed,
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: Some(elapsed),
                error: None,
            }
        }
        Ok(Err(e)) => {
            let elapsed = start.elapsed().as_secs_f64() * 1000.0;
            ProbeResult {
                is_up: false,
                status_code: None,
                response_time_ms: elapsed,
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: None,
                error: Some(format!("TLS handshake error: {}", e)),
            }
        }
        Err(_) => {
            let elapsed = start.elapsed().as_secs_f64() * 1000.0;
            ProbeResult {
                is_up: false,
                status_code: None,
                response_time_ms: elapsed,
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: None,
                error: Some("TLS handshake timeout".to_string()),
            }
        }
    }
}
