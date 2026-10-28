use reqwest::Client;
use serde_json::json;

pub async fn send_telegram(
    client: &Client,
    config: &serde_json::Value,
    title: &str,
    text: &str,
) -> Result<(), String> {
    let bot_token = config
        .get("bot_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'bot_token' in Telegram channel config".to_string())?;

    let chat_id = config
        .get("chat_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'chat_id' in Telegram channel config".to_string())?;

    let url = format!("https://api.telegram.org/bot{}/sendMessage", bot_token);
    let message = format!("<b>{}</b>\n\n{}", title, text);

    let payload = json!({
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": true
    });

    let res = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Telegram network error: {}", e))?;

    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return Err(format!("Telegram API error: {}", err_body));
    }

    Ok(())
}
