use reqwest::Client;
use serde_json::json;

pub async fn send_discord(
    client: &Client,
    config: &serde_json::Value,
    title: &str,
    description: &str,
    is_down: bool,
    fields: Vec<(&str, &str)>,
) -> Result<(), String> {
    let webhook_url = config
        .get("webhook_url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'webhook_url' in Discord channel config".to_string())?;

    let color = if is_down { 15548997 } else { 2278750 }; // Red vs Green in decimal

    let embed_fields: Vec<serde_json::Value> = fields
        .into_iter()
        .map(|(k, v)| {
            json!({
                "name": k,
                "value": v,
                "inline": true
            })
        })
        .collect();

    let payload = json!({
        "username": "ResPulse Monitor",
        "avatar_url": "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/activity.png",
        "embeds": [{
            "title": title,
            "description": description,
            "color": color,
            "fields": embed_fields,
            "footer": {
                "text": "ResPulse Synthetic Monitoring Network"
            },
            "timestamp": chrono::Utc::now().to_rfc3339()
        }]
    });

    let res = client
        .post(webhook_url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Discord network error: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let err_body = res.text().await.unwrap_or_default();
        return Err(format!("Discord webhook error ({}): {}", status, err_body));
    }

    Ok(())
}
