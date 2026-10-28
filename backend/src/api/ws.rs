use crate::api::monitors::AppState;
use crate::auth::user_from_token;
use axum::extract::ws::{close_code, CloseFrame, Message, WebSocket};
use axum::extract::{State, WebSocketUpgrade};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use std::time::Duration;
use tokio::sync::broadcast::error::RecvError;
use tracing::info;
use uuid::Uuid;

/// Browsers cannot set headers on a WebSocket handshake and URLs end up in access logs,
/// so the JWT travels in the first frame instead.
const AUTH_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Deserialize)]
struct AuthFrame {
    #[serde(rename = "type")]
    kind: String,
    token: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn authenticate(socket: &mut WebSocket, state: &AppState) -> Option<Uuid> {
    let frame = tokio::time::timeout(AUTH_TIMEOUT, socket.recv()).await.ok()??.ok()?;
    let Message::Text(text) = frame else {
        return None;
    };
    let auth: AuthFrame = serde_json::from_str(&text).ok()?;
    if auth.kind != "auth" {
        return None;
    }
    user_from_token(&state.auth, &state.pool, &auth.token)
        .await
        .map(|user| user.team_id)
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let Some(team_id) = authenticate(&mut socket, &state).await else {
        let _ = socket
            .send(Message::Close(Some(CloseFrame {
                code: close_code::POLICY,
                reason: "Unauthorized".into(),
            })))
            .await;
        return;
    };

    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    info!("New WebSocket client connected");

    let mut send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                // The hub is shared by all tenants; never forward another team's events.
                Ok(msg) if msg.team_id() == team_id => {
                    if let Ok(json_str) = serde_json::to_string(&msg) {
                        if sender.send(Message::Text(json_str)).await.is_err() {
                            break;
                        }
                    }
                }
                Ok(_) | Err(RecvError::Lagged(_)) => continue,
                Err(RecvError::Closed) => break,
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Close(_) = msg {
                break;
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    info!("WebSocket client disconnected");
}
