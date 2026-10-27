use crate::models::Monitor;
use crate::probe::http::ProbeResult;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;

pub async fn check_tcp(monitor: &Monitor) -> ProbeResult {
    let port = monitor.port.unwrap_or(80);
    // Extract hostname from url (strip http:// or https:// if present)
    let host = monitor.url
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split('/')
        .next()
        .unwrap_or(&monitor.url)
        .split(':')
        .next()
        .unwrap_or(&monitor.url);

    let addr = format!("{}:{}", host, port);
    let to = Duration::from_secs(monitor.timeout_seconds.max(1) as u64);

    let start = Instant::now();
    match timeout(to, TcpStream::connect(&addr)).await {
        Ok(Ok(_stream)) => {
            let elapsed = start.elapsed().as_secs_f64() * 1000.0;
            ProbeResult {
                is_up: true,
                status_code: None,
                response_time_ms: elapsed,
                dns_time_ms: None,
                connect_time_ms: Some(elapsed),
                tls_time_ms: None,
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
                error: Some(format!("TCP connection failed to {}: {}", addr, e)),
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
                error: Some(format!("TCP connection to {} timed out after {}s", addr, monitor.timeout_seconds)),
            }
        }
    }
}
