use reqwest::Client;
use serde_json::json;

pub async fn send_slack(
    client: &Client,
    config: &serde_json::Value,
    title: &str,
    text: &str,
    is_down: bool,
) -> Result<(), String> {
    let webhook_url = config
        .get("webhook_url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'webhook_url' in Slack channel config".to_string())?;

    let color = if is_down { "#ef4444" } else { "#22c55e" };

    let payload = json!({
        "attachments": [{
            "color": color,
            "title": title,
            "text": text,
            "ts": chrono::Utc::now().timestamp(),
            "footer": "ResPulse Alerting Engine"
        }]
    });

    let res = client
        .post(webhook_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Slack network error: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let err_body = res.text().await.unwrap_or_default();
        return Err(format!("Slack webhook error ({}): {}", status, err_body));
    }

    Ok(())
}
