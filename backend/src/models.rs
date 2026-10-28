use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Monitor {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub monitor_type: String, // 'HTTP', 'KEYWORD', 'PORT', 'SSL', 'HEARTBEAT'
    pub interval_seconds: i32,
    pub timeout_seconds: i32,
    pub method: String,
    pub headers: serde_json::Value,
    pub body: Option<String>,
    pub expected_status_code: Option<i32>,
    pub keyword: Option<String>,
    pub port: Option<i32>,
    pub status: String, // 'UP', 'DOWN', 'PENDING', 'PAUSED'
    pub is_paused: bool,
    pub last_checked_at: Option<DateTime<Utc>>,
    pub last_status_change_at: Option<DateTime<Utc>>,
    pub last_response_time_ms: Option<f64>,
    pub last_status_code: Option<i32>,
    pub last_error: Option<String>,
    pub heartbeat_token: Option<String>,
    pub auth_username: Option<String>,
    pub auth_password: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMonitorRequest {
    pub name: String,
    pub url: String,
    #[serde(default = "default_monitor_type")]
    pub monitor_type: String,
    #[serde(default = "default_interval")]
    pub interval_seconds: i32,
    #[serde(default = "default_timeout")]
    pub timeout_seconds: i32,
    #[serde(default = "default_method")]
    pub method: String,
    pub headers: Option<serde_json::Value>,
    pub body: Option<String>,
    pub expected_status_code: Option<i32>,
    pub keyword: Option<String>,
    pub port: Option<i32>,
    pub auth_username: Option<String>,
    pub auth_password: Option<String>,
}

fn default_monitor_type() -> String { "HTTP".to_string() }
fn default_interval() -> i32 { 60 }
fn default_timeout() -> i32 { 10 }
fn default_method() -> String { "GET".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMonitorRequest {
    pub name: Option<String>,
    pub url: Option<String>,
    pub interval_seconds: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub method: Option<String>,
    pub headers: Option<serde_json::Value>,
    pub body: Option<String>,
    pub expected_status_code: Option<i32>,
    pub keyword: Option<String>,
    pub port: Option<i32>,
    pub auth_username: Option<String>,
    pub auth_password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CheckResult {
    pub id: i64,
    pub monitor_id: Uuid,
    pub is_up: bool,
    pub status_code: Option<i32>,
    pub response_time_ms: f64,
    pub dns_time_ms: Option<f64>,
    pub connect_time_ms: Option<f64>,
    pub tls_time_ms: Option<f64>,
    pub error: Option<String>,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Incident {
    pub id: Uuid,
    pub monitor_id: Uuid,
    pub status: String, // 'ONGOING', 'RESOLVED'
    pub started_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub root_cause: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorWithStats {
    #[serde(flatten)]
    pub monitor: Monitor,
    pub uptime_24h: f64,
    pub uptime_7d: f64,
    pub uptime_30d: f64,
    pub recent_history: Vec<UptimeBarPoint>,
    pub latency_history: Vec<LatencyPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UptimeBarPoint {
    pub timestamp: DateTime<Utc>,
    pub is_up: bool,
    pub response_time_ms: f64,
    pub status_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyPoint {
    pub time: String,
    pub latency: f64,
    pub status: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalStats {
    pub total_monitors: usize,
    pub up_monitors: usize,
    pub down_monitors: usize,
    pub paused_monitors: usize,
    pub overall_uptime_24h: f64,
    pub avg_response_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    MonitorUpdated(Monitor),
    CheckCompleted {
        monitor_id: Uuid,
        is_up: bool,
        response_time_ms: f64,
        status_code: Option<i32>,
        error: Option<String>,
    },
    IncidentCreated(Incident),
    IncidentResolved(Incident),
    AlertDispatched {
        channel_name: String,
        status: String,
        event_type: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NotificationChannel {
    pub id: Uuid,
    pub name: String,
    pub channel_type: String,
    pub config: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
    pub channel_type: String,
    pub config: serde_json::Value,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AlertLog {
    pub id: i64,
    pub channel_id: Uuid,
    pub incident_id: Option<Uuid>,
    pub monitor_id: Option<Uuid>,
    pub event_type: String,
    pub status: String,
    pub error_message: Option<String>,
    pub sent_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertLogWithDetails {
    pub id: i64,
    pub channel_id: Uuid,
    pub channel_name: String,
    pub channel_type: String,
    pub monitor_id: Option<Uuid>,
    pub monitor_name: Option<String>,
    pub event_type: String,
    pub status: String,
    pub error_message: Option<String>,
    pub sent_at: DateTime<Utc>,
}
