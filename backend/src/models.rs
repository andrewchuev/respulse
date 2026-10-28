use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Monitor {
    pub id: Uuid,
    pub team_id: Uuid,
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
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_group_name")]
    pub group_name: String,
    #[serde(default)]
    pub grace_seconds: i32,
    pub last_start_at: Option<DateTime<Utc>>,
    pub last_duration_ms: Option<f64>,
    pub last_payload: Option<String>,
    pub slug: Option<String>,
    pub cron_expression: Option<String>,
    #[serde(default = "default_timezone")]
    pub timezone: String,
    pub next_expected_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn default_group_name() -> String {
    "Default".to_string()
}

fn default_timezone() -> String {
    "UTC".to_string()
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
    pub tags: Option<Vec<String>>,
    pub group_name: Option<String>,
    #[serde(default)]
    pub grace_seconds: Option<i32>,
    pub slug: Option<String>,
    pub cron_expression: Option<String>,
    pub timezone: Option<String>,
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
    pub tags: Option<Vec<String>>,
    pub group_name: Option<String>,
    #[serde(default)]
    pub grace_seconds: Option<i32>,
    pub slug: Option<String>,
    pub cron_expression: Option<String>,
    pub timezone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkActionRequest {
    pub ids: Vec<Uuid>,
    pub action: String, // "pause", "resume", "test", "delete", "set_group", "add_tag", "remove_tag"
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkActionResponse {
    pub success: bool,
    pub affected: usize,
    pub message: String,
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
    pub payload: Option<String>,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Incident {
    pub id: Uuid,
    pub team_id: Uuid,
    pub monitor_id: Uuid,
    pub status: String, // 'ONGOING', 'RESOLVED'
    pub started_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i32>,
    pub root_cause: Option<String>,
    pub title: Option<String>,
    #[serde(default = "default_severity")]
    pub severity: String,
    #[serde(default = "default_stage")]
    pub stage: String,
    pub summary: Option<String>,
    pub post_mortem: Option<String>,
    #[serde(default = "default_true")]
    pub is_published: bool,
}

fn default_severity() -> String { "MAJOR".to_string() }
fn default_stage() -> String { "INVESTIGATING".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct IncidentUpdate {
    pub id: i64,
    pub incident_id: Uuid,
    pub stage: String,
    pub message: String,
    pub author: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncidentWithDetails {
    #[serde(flatten)]
    pub incident: Incident,
    pub monitor_name: String,
    pub monitor_url: String,
    pub updates: Vec<IncidentUpdate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateIncidentRequest {
    pub title: Option<String>,
    pub severity: Option<String>,
    pub stage: Option<String>,
    pub summary: Option<String>,
    pub post_mortem: Option<String>,
    pub is_published: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddIncidentUpdateRequest {
    pub stage: String,
    pub message: String,
    pub author: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateManualIncidentRequest {
    pub monitor_id: Uuid,
    pub title: String,
    pub severity: Option<String>,
    pub stage: Option<String>,
    pub summary: Option<String>,
    pub message: Option<String>,
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
    pub team_id: Uuid,
    pub name: String,
    pub channel_type: String,
    pub config: serde_json::Value,
    pub is_active: bool,
    #[serde(default)]
    pub filter_tags: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
    pub channel_type: String,
    pub config: serde_json::Value,
    #[serde(default = "default_true")]
    pub is_active: bool,
    #[serde(default)]
    pub filter_tags: Option<Vec<String>>,
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

// -----------------------------------------------------------------------------
// Role-Based Access Control (RBAC) & Multi-User Teams
// -----------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserRole {
    Owner,
    Admin,
    Engineer,
    Viewer,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Owner => "OWNER",
            UserRole::Admin => "ADMIN",
            UserRole::Engineer => "ENGINEER",
            UserRole::Viewer => "VIEWER",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "OWNER" => UserRole::Owner,
            "ADMIN" => UserRole::Admin,
            "VIEWER" => UserRole::Viewer,
            _ => UserRole::Engineer,
        }
    }

    pub fn can_mutate_monitors(&self) -> bool {
        matches!(self, UserRole::Owner | UserRole::Admin | UserRole::Engineer)
    }

    pub fn can_manage_incidents(&self) -> bool {
        matches!(self, UserRole::Owner | UserRole::Admin | UserRole::Engineer)
    }

    pub fn can_manage_channels(&self) -> bool {
        matches!(self, UserRole::Owner | UserRole::Admin | UserRole::Engineer)
    }

    pub fn can_manage_team(&self) -> bool {
        matches!(self, UserRole::Owner | UserRole::Admin)
    }

    pub fn can_manage_billing(&self) -> bool {
        matches!(self, UserRole::Owner)
    }

    pub fn permissions(&self) -> Vec<String> {
        let mut perms = vec![
            "view_dashboard".to_string(),
            "view_monitors".to_string(),
            "view_incidents".to_string(),
            "view_channels".to_string(),
        ];
        if self.can_mutate_monitors() {
            perms.push("mutate_monitors".to_string());
            perms.push("probe_monitors".to_string());
        }
        if self.can_manage_incidents() {
            perms.push("manage_incidents".to_string());
            perms.push("publish_rca".to_string());
        }
        if self.can_manage_channels() {
            perms.push("manage_channels".to_string());
        }
        if self.can_manage_team() {
            perms.push("manage_team".to_string());
        }
        if self.can_manage_billing() {
            perms.push("manage_billing".to_string());
        }
        perms
    }
}

fn default_plan() -> String {
    "FREE".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Team {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub ping_key: String,
    #[serde(default = "default_plan")]
    pub plan: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub team_id: Uuid,
    pub email: String,
    pub name: String,
    pub password_hash: String,
    pub role: String,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub team_id: Uuid,
    pub team_name: String,
    pub team_ping_key: Option<String>,
    pub team_plan: String,
    pub email: String,
    pub name: String,
    pub role: UserRole,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TeamMember {
    pub id: Uuid,
    pub team_id: Uuid,
    pub email: String,
    pub name: String,
    pub role: String,
    pub avatar_url: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InviteMemberRequest {
    pub email: String,
    pub name: String,
    pub role: UserRole,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMemberRoleRequest {
    pub role: UserRole,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchUserRequest {
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub company_name: String,
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserProfile,
}
