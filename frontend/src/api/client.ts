import {
  AddIncidentUpdatePayload,
  AdminReportData,
  AdminTeamItem,
  AdminUserItem,
  AdminSystemStatus,
  AppConfig,
  AlertLogWithDetails,
  AuthResponse,
  BulkActionPayload,
  BulkActionResponse,
  ConfirmFastSpringPaymentPayload,
  CreateChannelPayload,
  CreateManualIncidentPayload,
  CreateMonitorPayload,
  GlobalStats,
  Incident,
  IncidentUpdate,
  IncidentWithDetails,
  InviteMemberPayload,
  LoginPayload,
  Monitor,
  MonitorWithStats,
  NotificationChannel,
  FastSpringCheckoutConfig,
  PaymentTransaction,
  PublicStatusPage,
  RegisterPayload,
  ResPulseExport,
  ImportConfigPayload,
  ImportSummary,
  TeamMember,
  UpdateIncidentPayload,
  UpdateMonitorPayload,
  UserProfile,
  UserRole,
} from '../types';

const API_BASE = '/api';

const TOKEN_KEY = 'respulse_jwt_token';

let unauthorizedHandler: (() => void) | null = null;

/** Registers a callback fired when the API rejects the current session (missing or expired token). */
export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthSession(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  // Leftover from the removed x-user-email persona mechanism.
  localStorage.removeItem('respulse_active_email');
}

function authHeaders(custom: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...custom };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** fetch wrapper that drops the session and notifies the app when the API answers 401. */
async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    clearAuthSession();
    unauthorizedHandler?.();
  }
  return res;
}

// -----------------------------------------------------------------------------
// Auth & Identity API
// -----------------------------------------------------------------------------

/** Signups either get a session straight away or must confirm their email first. */
export type RegisterResult = AuthResponse | { status: 'verification_required'; email: string };

export async function registerUser(payload: RegisterPayload): Promise<RegisterResult> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(err.error || 'Registration failed');
  }
  const data: RegisterResult = await res.json();
  if ('token' in data) setAuthSession(data.token);
  return data;
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    // `code` lets the UI offer to resend the confirmation email.
    throw Object.assign(new Error(err.error || 'Invalid email or password'), { code: err.code as string | undefined });
  }
  const data: AuthResponse = await res.json();
  setAuthSession(data.token);
  return data;
}

export async function resendVerification(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.status === 429) throw new Error('Too many requests. Please wait a few minutes and try again.');
  if (!res.ok) throw new Error('Could not send the email. Please try again later.');
}

/** Redeems the emailed link and signs the user in. */
export async function verifyEmail(token: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'This confirmation link is invalid or has expired.');
  }
  const data: AuthResponse = await res.json();
  setAuthSession(data.token);
  return data;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const res = await apiFetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch current user profile');
  return res.json();
}

export async function fetchAvailableUsers(): Promise<UserProfile[]> {
  const res = await apiFetch(`${API_BASE}/auth/users`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch available demo users');
  return res.json();
}

// Mirrors the backend defaults so the UI still renders sensibly if the config request fails.
export const DEFAULT_APP_CONFIG: AppConfig = {
  demo_mode: false,
  billing_enabled: false,
  plans: {
    FREE: { max_monitors: 25, min_interval_seconds: 30, max_members: 1, retention_days: 30 },
    PRO: { max_monitors: 100, min_interval_seconds: 10, max_members: 10, retention_days: 90 },
  },
};

export async function fetchAuthConfig(): Promise<AppConfig> {
  try {
    const res = await fetch(`${API_BASE}/auth/config`);
    if (!res.ok) return DEFAULT_APP_CONFIG;
    return { ...DEFAULT_APP_CONFIG, ...(await res.json()) };
  } catch {
    return DEFAULT_APP_CONFIG;
  }
}

export async function fetchAdminAccess(): Promise<boolean> {
  const res = await apiFetch(`${API_BASE}/admin/access`, { headers: authHeaders() });
  if (!res.ok) return false;
  return !!(await res.json()).is_admin;
}

export async function fetchAdminReport(): Promise<AdminReportData> {
  const res = await apiFetch(`${API_BASE}/admin/report`, { headers: authHeaders() });
  if (!res.ok) throw new Error(res.status === 403 ? 'Operator access only' : 'Failed to load report');
  return res.json();
}

export async function fetchAdminTeams(): Promise<AdminTeamItem[]> {
  const res = await apiFetch(`${API_BASE}/admin/teams`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load teams');
  return res.json();
}

export async function updateAdminTeamPlan(teamId: string, plan: 'FREE' | 'PRO'): Promise<void> {
  const res = await apiFetch(`${API_BASE}/admin/teams/${teamId}/plan`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update team plan');
  }
}

export async function deleteAdminTeam(teamId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/admin/teams/${teamId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete team');
  }
}

export async function fetchAdminUsers(): Promise<AdminUserItem[]> {
  const res = await apiFetch(`${API_BASE}/admin/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

export async function updateAdminUserStatus(userId: string, isActive: boolean): Promise<void> {
  const res = await apiFetch(`${API_BASE}/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update user status');
  }
}

export async function fetchAdminSystemStatus(): Promise<AdminSystemStatus> {
  const res = await apiFetch(`${API_BASE}/admin/system/status`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load system status');
  return res.json();
}

export async function triggerAdminPrune(): Promise<{ deleted_rows: number; message: string }> {
  const res = await apiFetch(`${API_BASE}/admin/system/prune`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to run retention prune');
  }
  return res.json();
}

export async function triggerAdminBackupPing(): Promise<{ status: string; message: string }> {
  const res = await apiFetch(`${API_BASE}/admin/system/backup-ping`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to trigger backup heartbeat');
  }
  return res.json();
}

/** Passwordless login as a seeded demo persona; the server only allows it in demo mode. */
export async function switchUser(email: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/switch-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('Demo login is not available');
  const data: AuthResponse = await res.json();
  setAuthSession(data.token);
  return data.user;
}

// -----------------------------------------------------------------------------
// Team Management API
// -----------------------------------------------------------------------------

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await apiFetch(`${API_BASE}/team/members`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch team members');
  return res.json();
}

export async function inviteTeamMember(payload: InviteMemberPayload): Promise<TeamMember> {
  const res = await apiFetch(`${API_BASE}/team/members`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || 'Failed to invite team member');
  }
  return res.json();
}

export async function updateMemberRole(memberId: string, role: UserRole): Promise<TeamMember> {
  const res = await apiFetch(`${API_BASE}/team/members/${memberId}/role`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || 'Failed to update member role');
  }
  return res.json();
}

export async function deleteTeamMember(memberId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/team/members/${memberId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || 'Failed to remove team member');
  }
}

// -----------------------------------------------------------------------------
// Monitors API
// -----------------------------------------------------------------------------

export async function fetchMonitors(): Promise<MonitorWithStats[]> {
  const res = await apiFetch(`${API_BASE}/monitors`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch monitors');
  return res.json();
}

export async function fetchMonitor(id: string): Promise<MonitorWithStats> {
  const res = await apiFetch(`${API_BASE}/monitors/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch monitor details');
  return res.json();
}

export async function createMonitor(payload: CreateMonitorPayload): Promise<Monitor> {
  const res = await apiFetch(`${API_BASE}/monitors`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to create monitor');
  }
  return res.json();
}

export async function updateMonitor(id: string, payload: UpdateMonitorPayload): Promise<Monitor> {
  const res = await apiFetch(`${API_BASE}/monitors/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to update monitor');
  }
  return res.json();
}

export async function deleteMonitor(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/monitors/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to delete monitor');
  }
}

export async function pauseMonitor(id: string): Promise<Monitor> {
  const res = await apiFetch(`${API_BASE}/monitors/${id}/pause`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to pause monitor');
  }
  return res.json();
}

export async function resumeMonitor(id: string): Promise<Monitor> {
  const res = await apiFetch(`${API_BASE}/monitors/${id}/resume`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to resume monitor');
  }
  return res.json();
}

export async function triggerTest(id: string): Promise<Monitor> {
  const res = await apiFetch(`${API_BASE}/monitors/${id}/test`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to trigger monitor test');
  }
  return res.json();
}

export async function bulkAction(payload: BulkActionPayload): Promise<BulkActionResponse> {
  const res = await apiFetch(`${API_BASE}/monitors/bulk`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Bulk action failed');
  }
  return res.json();
}

export async function fetchStats(): Promise<GlobalStats> {
  const res = await apiFetch(`${API_BASE}/stats`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

// -----------------------------------------------------------------------------
// Incidents API
// -----------------------------------------------------------------------------

export async function fetchIncidents(): Promise<IncidentWithDetails[]> {
  const res = await apiFetch(`${API_BASE}/incidents`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function fetchIncident(id: string): Promise<IncidentWithDetails> {
  const res = await apiFetch(`${API_BASE}/incidents/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch incident details');
  return res.json();
}

export async function updateIncident(id: string, payload: UpdateIncidentPayload): Promise<Incident> {
  const res = await apiFetch(`${API_BASE}/incidents/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to update incident');
  }
  return res.json();
}

export async function addIncidentUpdate(id: string, payload: AddIncidentUpdatePayload): Promise<IncidentUpdate> {
  const res = await apiFetch(`${API_BASE}/incidents/${id}/updates`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to post incident update');
  }
  return res.json();
}

export async function createManualIncident(payload: CreateManualIncidentPayload): Promise<IncidentWithDetails> {
  const res = await apiFetch(`${API_BASE}/incidents`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to create manual incident');
  }
  return res.json();
}

export async function fetchStatusPage(): Promise<PublicStatusPage> {
  const res = await fetch(`${API_BASE}/status-page`);
  if (!res.ok) throw new Error('Failed to fetch status page data');
  return res.json();
}

// -----------------------------------------------------------------------------
// Notification Channels API
// -----------------------------------------------------------------------------

export async function fetchChannels(): Promise<NotificationChannel[]> {
  const res = await apiFetch(`${API_BASE}/notifications`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch notification channels');
  return res.json();
}

export async function createChannel(payload: CreateChannelPayload): Promise<NotificationChannel> {
  const res = await apiFetch(`${API_BASE}/notifications`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to create notification channel');
  }
  return res.json();
}

export async function updateChannel(
  id: string,
  payload: Partial<CreateChannelPayload>
): Promise<NotificationChannel> {
  const res = await apiFetch(`${API_BASE}/notifications/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to update notification channel');
  }
  return res.json();
}

export async function deleteChannel(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/notifications/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to delete notification channel');
  }
}

export async function testChannel(id: string): Promise<{ success: boolean; message: string; error?: string }> {
  const res = await apiFetch(`${API_BASE}/notifications/${id}/test`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function fetchAlertLogs(): Promise<AlertLogWithDetails[]> {
  const res = await apiFetch(`${API_BASE}/notifications/logs`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch alert delivery logs');
  return res.json();
}

// Payments & FastSpring
export async function fetchFastSpringConfig(): Promise<FastSpringCheckoutConfig> {
  const res = await apiFetch(`${API_BASE}/payments/fastspring/config`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch FastSpring configuration');
  return res.json();
}

export async function confirmFastSpringPayment(payload: ConfirmFastSpringPaymentPayload): Promise<any> {
  const res = await apiFetch(`${API_BASE}/payments/fastspring/confirm`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // 409 means the signed FastSpring webhook has not upgraded the plan yet, which callers can retry.
    throw Object.assign(new Error(err.error || 'Failed to confirm FastSpring payment'), { status: res.status });
  }
  return res.json();
}

export async function fetchPaymentHistory(): Promise<PaymentTransaction[]> {
  const res = await apiFetch(`${API_BASE}/payments/history`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch payment history');
  return res.json();
}

export function createWebSocketConnection(onMessage: (data: any) => void) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws`;
  // Server closes with 1008 (policy violation) when the token is rejected.
  const POLICY_VIOLATION = 1008;

  let ws: WebSocket | null = null;
  let retryTimer: any = null;
  let stopped = false;

  function scheduleReconnect() {
    if (!stopped) retryTimer = setTimeout(connect, 3000);
  }

  function connect() {
    const token = getAuthToken();
    if (!token) return;

    try {
      ws = new WebSocket(wsUrl);
      // The JWT is sent as the first frame rather than in the URL to keep it out of access logs.
      ws.onopen = () => ws?.send(JSON.stringify({ type: 'auth', token }));
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onMessage(parsed);
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      ws.onclose = (event) => {
        if (event.code !== POLICY_VIOLATION) scheduleReconnect();
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch (e) {
      scheduleReconnect();
    }
  }

  connect();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    ws?.close();
  };
}

// -----------------------------------------------------------------------------
// Configuration Export & Import API
// -----------------------------------------------------------------------------

export async function fetchExportConfig(includeSecrets: boolean = true): Promise<ResPulseExport> {
  const res = await apiFetch(`${API_BASE}/config/export?include_secrets=${includeSecrets}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to export configuration');
  }
  return res.json();
}

export async function importConfig(payload: ImportConfigPayload): Promise<ImportSummary> {
  const res = await apiFetch(`${API_BASE}/config/import`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to import configuration');
  }
  return res.json();
}
