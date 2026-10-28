export type MonitorType = 'HTTP' | 'KEYWORD' | 'PORT' | 'SSL' | 'HEARTBEAT';
export type MonitorStatus = 'UP' | 'DOWN' | 'PENDING' | 'PAUSED';
export type ChannelType = 'TELEGRAM' | 'DISCORD' | 'SLACK' | 'WEBHOOK';

export interface Monitor {
  id: string;
  name: string;
  url: string;
  monitor_type: MonitorType;
  interval_seconds: number;
  timeout_seconds: number;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  expected_status_code: number | null;
  keyword: string | null;
  port: number | null;
  status: MonitorStatus;
  is_paused: boolean;
  last_checked_at: string | null;
  last_status_change_at: string | null;
  last_response_time_ms: number | null;
  last_status_code: number | null;
  last_error: string | null;
  heartbeat_token: string | null;
  auth_username?: string | null;
  auth_password?: string | null;
  tags?: string[];
  group_name?: string;
  grace_seconds?: number;
  last_start_at?: string | null;
  last_duration_ms?: number | null;
  last_payload?: string | null;
  slug?: string | null;
  cron_expression?: string | null;
  timezone?: string;
  next_expected_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UptimeBarPoint {
  timestamp: string;
  is_up: boolean;
  response_time_ms: number;
  status_code: number | null;
}

export interface LatencyPoint {
  time: string;
  latency: number;
  status: number;
}

export interface MonitorWithStats extends Monitor {
  uptime_24h: number;
  uptime_7d: number;
  uptime_30d: number;
  recent_history: UptimeBarPoint[];
  latency_history: LatencyPoint[];
}

export type IncidentStage = 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';
export type IncidentSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL' | 'MAINTENANCE';

export interface Incident {
  id: string;
  monitor_id: string;
  monitor_name?: string;
  monitor_url?: string;
  status: 'ONGOING' | 'RESOLVED';
  started_at: string;
  resolved_at: string | null;
  duration_seconds: number | null;
  root_cause: string | null;
  title?: string | null;
  severity: IncidentSeverity;
  stage: IncidentStage;
  summary?: string | null;
  post_mortem?: string | null;
  is_published: boolean;
}

export interface IncidentUpdate {
  id: number;
  incident_id: string;
  stage: IncidentStage;
  message: string;
  author: string;
  created_at: string;
}

export interface IncidentWithDetails extends Incident {
  monitor_name: string;
  monitor_url: string;
  updates: IncidentUpdate[];
}

export interface UpdateIncidentPayload {
  title?: string;
  severity?: IncidentSeverity;
  stage?: IncidentStage;
  summary?: string;
  post_mortem?: string;
  is_published?: boolean;
}

export interface AddIncidentUpdatePayload {
  stage: IncidentStage;
  message: string;
  author?: string;
}

export interface CreateManualIncidentPayload {
  monitor_id: string;
  title: string;
  severity?: IncidentSeverity;
  stage?: IncidentStage;
  summary?: string;
  message?: string;
}

export interface GlobalStats {
  total_monitors: number;
  up_monitors: number;
  down_monitors: number;
  paused_monitors: number;
  overall_uptime_24h: number;
  avg_response_time_ms: number;
}

export interface PublicStatusPage {
  title: string;
  description: string;
  all_systems_operational: boolean;
  overall_uptime_90d: number;
  active_incidents: IncidentWithDetails[];
  resolved_incidents: IncidentWithDetails[];
  services: MonitorWithStats[];
}

export interface CreateMonitorPayload {
  name: string;
  url: string;
  monitor_type: MonitorType;
  interval_seconds: number;
  timeout_seconds: number;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  expected_status_code?: number;
  keyword?: string;
  port?: number;
  auth_username?: string;
  auth_password?: string;
  tags?: string[];
  group_name?: string;
  grace_seconds?: number;
  slug?: string;
  cron_expression?: string;
  timezone?: string;
}

export interface UpdateMonitorPayload {
  name?: string;
  url?: string;
  interval_seconds?: number;
  timeout_seconds?: number;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  expected_status_code?: number;
  keyword?: string;
  port?: number;
  auth_username?: string;
  auth_password?: string;
  tags?: string[];
  group_name?: string;
  grace_seconds?: number;
  slug?: string;
  cron_expression?: string;
  timezone?: string;
}

export interface BulkActionPayload {
  ids: string[];
  action: 'pause' | 'resume' | 'test' | 'delete' | 'set_group' | 'add_tag';
  value?: string;
}

export interface BulkActionResponse {
  success: boolean;
  affected: number;
  message: string;
}

export interface NotificationChannel {
  id: string;
  name: string;
  channel_type: ChannelType;
  config: Record<string, any>;
  is_active: boolean;
  filter_tags?: string[];
  total_alerts_24h?: number;
  last_alert_at?: string | null;
  last_status?: string | null;
  created_at: string;
}

export interface CreateChannelPayload {
  name: string;
  channel_type: ChannelType;
  config: Record<string, any>;
  is_active?: boolean;
  filter_tags?: string[];
}

export interface AlertLogWithDetails {
  id: number;
  channel_id: string;
  channel_name: string;
  channel_type: string;
  monitor_id?: string | null;
  monitor_name?: string | null;
  event_type: string;
  status: string;
  error_message?: string | null;
  sent_at: string;
}

// -----------------------------------------------------------------------------
// Role-Based Access Control (RBAC) & Team Management
// -----------------------------------------------------------------------------

export type UserRole = 'OWNER' | 'ADMIN' | 'ENGINEER' | 'VIEWER';

export interface UserProfile {
  id: string;
  team_id: string;
  team_name: string;
  team_ping_key?: string | null;
  team_plan?: 'FREE' | 'PRO';
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string | null;
  is_active: boolean;
  permissions: string[];
}

export interface FastSpringCheckoutConfig {
  store_id: string;
  is_test: boolean;
  storefront: string;
  product_path: string;
  plan_name: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  checkout_url: string;
  team_id: string;
  user_email: string;
}

export interface PaymentTransaction {
  id: string;
  team_id: string;
  provider: string;
  transaction_id?: string | null;
  payer_email?: string | null;
  recipient_email: string;
  amount: number;
  currency: string;
  status: string;
  plan: string;
  billing_cycle: string;
  payload?: any;
  created_at: string;
}

export interface ConfirmFastSpringPaymentPayload {
  order_id?: string;
  reference?: string;
  subscription_id?: string;
  payer_email?: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface InviteMemberPayload {
  email: string;
  name: string;
  role: UserRole;
}

export interface RegisterPayload {
  company_name: string;
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}
