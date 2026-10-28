use crate::models::Monitor;
use crate::probe::http::ProbeResult;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;

pub async fn check_tcp(monitor: &Monitor) -> ProbeResult {
    let port = monitor.port.unwrap_or(80);
    let host = crate::net_guard::extract_host(&monitor.url);

    let addr = format!("{}:{}", host, port);
    let to = Duration::from_secs(monitor.timeout_seconds.max(1) as u64);

    // Connect to the vetted addresses instead of the hostname so DNS cannot change in between.
    let targets = match crate::net_guard::policy().resolve_allowed(&host, port as u16).await {
        Ok(targets) => targets,
        Err(e) => {
            return ProbeResult {
            is_up: false,
            status_code: None,
            response_time_ms: 0.0,
            dns_time_ms: None,
            connect_time_ms: None,
            tls_time_ms: None,
            error: Some(format!("TCP check to {}: {}", addr, e)),
        };
        }
    };

    let start = Instant::now();
    match timeout(to, TcpStream::connect(&targets[..])).await {
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
