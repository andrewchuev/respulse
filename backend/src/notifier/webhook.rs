use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::Client;
use std::str::FromStr;

pub async fn send_generic_webhook(
    client: &Client,
    config: &serde_json::Value,
    payload: &serde_json::Value,
) -> Result<(), String> {
    let webhook_url = config
        .get("webhook_url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'webhook_url' in Webhook channel config".to_string())?;

    let mut req = client.post(webhook_url);

    // Optional custom headers
    if let Some(headers_obj) = config.get("headers").and_then(|h| h.as_object()) {
        let mut header_map = HeaderMap::new();
        for (k, v) in headers_obj {
            if let Some(val_str) = v.as_str() {
                if let (Ok(h_name), Ok(h_val)) = (HeaderName::from_str(k), HeaderValue::from_str(val_str)) {
                    header_map.insert(h_name, h_val);
                }
            }
        }
        req = req.headers(header_map);
    }

    let res = req
        .json(payload)
        .send()
        .await
        .map_err(|e| format!("Webhook dispatch error: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let err_body = res.text().await.unwrap_or_default();
        return Err(format!("Webhook returned status {}: {}", status, err_body));
    }

    Ok(())
}
