export type MonitorType = 'HTTP' | 'KEYWORD' | 'PORT' | 'SSL' | 'HEARTBEAT';
export type MonitorStatus = 'UP' | 'DOWN' | 'PENDING' | 'PAUSED';

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
  active_incidents: Incident[];
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
}
