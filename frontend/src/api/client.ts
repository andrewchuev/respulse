import {
  AddIncidentUpdatePayload,
  AlertLogWithDetails,
  AuthResponse,
  BulkActionPayload,
  BulkActionResponse,
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
  PublicStatusPage,
  RegisterPayload,
  TeamMember,
  UpdateIncidentPayload,
  UpdateMonitorPayload,
  UserProfile,
  UserRole,
} from '../types';

const API_BASE = '/api';

// RBAC user context & JWT token stored in localStorage
let jwtToken: string | null = localStorage.getItem('respulse_jwt_token');
let activeUserEmail: string = localStorage.getItem('respulse_active_email') || 'alice@respulse.internal';

export function getAuthToken(): string | null {
  return localStorage.getItem('respulse_jwt_token');
}

export function getActiveUserEmail(): string {
  return activeUserEmail;
}

export function setAuthSession(token: string, email: string) {
  jwtToken = token;
  activeUserEmail = email;
  localStorage.setItem('respulse_jwt_token', token);
  localStorage.setItem('respulse_active_email', email);
}

export function clearAuthSession() {
  jwtToken = null;
  activeUserEmail = '';
  localStorage.removeItem('respulse_jwt_token');
  localStorage.removeItem('respulse_active_email');
}

export function setActiveUserEmail(email: string) {
  activeUserEmail = email;
  localStorage.setItem('respulse_active_email', email);
}

function authHeaders(custom: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    ...custom,
  };
  const token = localStorage.getItem('respulse_jwt_token') || jwtToken;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const email = localStorage.getItem('respulse_active_email') || activeUserEmail;
  if (email) {
    headers['x-user-email'] = email;
  }
  return headers;
}

// -----------------------------------------------------------------------------
// Auth & Identity API
// -----------------------------------------------------------------------------

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(err.error || 'Registration failed');
  }
  const data: AuthResponse = await res.json();
  setAuthSession(data.token, data.user.email);
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
    throw new Error(err.error || 'Invalid email or password');
  }
  const data: AuthResponse = await res.json();
  setAuthSession(data.token, data.user.email);
  return data;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch current user profile');
  return res.json();
}

export async function fetchAvailableUsers(): Promise<UserProfile[]> {
  const res = await fetch(`${API_BASE}/auth/users`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch available demo users');
  return res.json();
}

export async function switchUser(email: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/switch-user`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('Failed to switch user');
  const data = await res.json();
  if (data.token && data.user) {
    setAuthSession(data.token, data.user.email);
    return data.user;
  }
  setActiveUserEmail(email);
  return data;
}

// -----------------------------------------------------------------------------
// Team Management API
// -----------------------------------------------------------------------------

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const res = await fetch(`${API_BASE}/team/members`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch team members');
  return res.json();
}

export async function inviteTeamMember(payload: InviteMemberPayload): Promise<TeamMember> {
  const res = await fetch(`${API_BASE}/team/members`, {
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
  const res = await fetch(`${API_BASE}/team/members/${memberId}/role`, {
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
  const res = await fetch(`${API_BASE}/team/members/${memberId}`, {
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
  const res = await fetch(`${API_BASE}/monitors`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch monitors');
  return res.json();
}

export async function fetchMonitor(id: string): Promise<MonitorWithStats> {
  const res = await fetch(`${API_BASE}/monitors/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch monitor details');
  return res.json();
}

export async function createMonitor(payload: CreateMonitorPayload): Promise<Monitor> {
  const res = await fetch(`${API_BASE}/monitors`, {
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
  const res = await fetch(`${API_BASE}/monitors/${id}`, {
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
  const res = await fetch(`${API_BASE}/monitors/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to delete monitor');
  }
}

export async function pauseMonitor(id: string): Promise<Monitor> {
  const res = await fetch(`${API_BASE}/monitors/${id}/pause`, {
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
  const res = await fetch(`${API_BASE}/monitors/${id}/resume`, {
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
  const res = await fetch(`${API_BASE}/monitors/${id}/test`, {
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
  const res = await fetch(`${API_BASE}/monitors/bulk`, {
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
  const res = await fetch(`${API_BASE}/stats`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

// -----------------------------------------------------------------------------
// Incidents API
// -----------------------------------------------------------------------------

export async function fetchIncidents(): Promise<IncidentWithDetails[]> {
  const res = await fetch(`${API_BASE}/incidents`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function fetchIncident(id: string): Promise<IncidentWithDetails> {
  const res = await fetch(`${API_BASE}/incidents/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch incident details');
  return res.json();
}

export async function updateIncident(id: string, payload: UpdateIncidentPayload): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}`, {
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
  const res = await fetch(`${API_BASE}/incidents/${id}/updates`, {
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
  const res = await fetch(`${API_BASE}/incidents`, {
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
  const res = await fetch(`${API_BASE}/notifications`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch notification channels');
  return res.json();
}

export async function createChannel(payload: CreateChannelPayload): Promise<NotificationChannel> {
  const res = await fetch(`${API_BASE}/notifications`, {
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
  const res = await fetch(`${API_BASE}/notifications/${id}`, {
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
  const res = await fetch(`${API_BASE}/notifications/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to delete notification channel');
  }
}

export async function testChannel(id: string): Promise<{ success: boolean; message: string; error?: string }> {
  const res = await fetch(`${API_BASE}/notifications/${id}/test`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}

export async function fetchAlertLogs(): Promise<AlertLogWithDetails[]> {
  const res = await fetch(`${API_BASE}/notifications/logs`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch alert delivery logs');
  return res.json();
}

export function createWebSocketConnection(onMessage: (data: any) => void) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws`;

  let ws: WebSocket | null = null;
  let retryTimer: any = null;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onMessage(parsed);
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      ws.onclose = () => {
        retryTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch (e) {
      retryTimer = setTimeout(connect, 3000);
    }
  }

  connect();

  return () => {
    clearTimeout(retryTimer);
    ws?.close();
  };
}
