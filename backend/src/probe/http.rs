use crate::models::Monitor;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method};
use std::str::FromStr;
use std::time::{Duration, Instant};

pub struct ProbeResult {
    pub is_up: bool,
    pub status_code: Option<i32>,
    pub response_time_ms: f64,
    pub dns_time_ms: Option<f64>,
    pub connect_time_ms: Option<f64>,
    pub tls_time_ms: Option<f64>,
    pub error: Option<String>,
}

pub async fn check_http(client: &Client, monitor: &Monitor) -> ProbeResult {
    let timeout = Duration::from_secs(monitor.timeout_seconds.max(1) as u64);
    let method = Method::from_str(&monitor.method).unwrap_or(Method::GET);

    let mut request_builder = client.request(method, &monitor.url).timeout(timeout);

    // Add custom headers if specified
    if let Some(headers_obj) = monitor.headers.as_object() {
        let mut header_map = HeaderMap::new();
        for (k, v) in headers_obj {
            if let Some(val_str) = v.as_str() {
                if let (Ok(h_name), Ok(h_val)) = (HeaderName::from_str(k), HeaderValue::from_str(val_str)) {
                    header_map.insert(h_name, h_val);
                }
            }
        }
        request_builder = request_builder.headers(header_map);
    }

    // Add body if specified
    if let Some(ref body_text) = monitor.body {
        if !body_text.is_empty() {
            request_builder = request_builder.body(body_text.clone());
        }
    }

    let start = Instant::now();
    match request_builder.send().await {
        Ok(response) => {
            let status = response.status().as_u16() as i32;
            let elapsed = start.elapsed().as_secs_f64() * 1000.0;

            let expected_match = if let Some(expected) = monitor.expected_status_code {
                status == expected
            } else {
                (200..=399).contains(&status)
            };

            if !expected_match {
                return ProbeResult {
                    is_up: false,
                    status_code: Some(status),
                    response_time_ms: elapsed,
                    dns_time_ms: None,
                    connect_time_ms: None,
                    tls_time_ms: None,
                    error: Some(format!("Unexpected HTTP status code: {}", status)),
                };
            }

            // Keyword check if specified
            if let Some(ref keyword) = monitor.keyword {
                if !keyword.is_empty() {
                    match response.text().await {
                        Ok(body) => {
                            if !body.contains(keyword) {
                                return ProbeResult {
                                    is_up: false,
                                    status_code: Some(status),
                                    response_time_ms: elapsed,
                                    dns_time_ms: None,
                                    connect_time_ms: None,
                                    tls_time_ms: None,
                                    error: Some(format!("Keyword '{}' not found in response body", keyword)),
                                };
                            }
                        }
                        Err(e) => {
                            return ProbeResult {
                                is_up: false,
                                status_code: Some(status),
                                response_time_ms: elapsed,
                                dns_time_ms: None,
                                connect_time_ms: None,
                                tls_time_ms: None,
                                error: Some(format!("Failed to read response body: {}", e)),
                            };
                        }
                    }
                }
            }

            ProbeResult {
                is_up: true,
                status_code: Some(status),
                response_time_ms: elapsed,
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: None,
                error: None,
            }
        }
        Err(err) => {
            let elapsed = start.elapsed().as_secs_f64() * 1000.0;
            let error_msg = if err.is_timeout() {
                format!("Request timed out after {}s", monitor.timeout_seconds)
            } else if err.is_connect() {
                format!("Connection error: {}", err)
            } else {
                format!("HTTP error: {}", err)
            };

            ProbeResult {
                is_up: false,
                status_code: err.status().map(|s| s.as_u16() as i32),
                response_time_ms: elapsed,
                dns_time_ms: None,
                connect_time_ms: None,
                tls_time_ms: None,
                error: Some(error_msg),
            }
        }
    }
}
