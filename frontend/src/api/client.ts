import {
  AddIncidentUpdatePayload,
  AlertLogWithDetails,
  BulkActionPayload,
  BulkActionResponse,
  CreateChannelPayload,
  CreateManualIncidentPayload,
  CreateMonitorPayload,
  GlobalStats,
  Incident,
  IncidentUpdate,
  IncidentWithDetails,
  Monitor,
  MonitorWithStats,
  NotificationChannel,
  PublicStatusPage,
  UpdateIncidentPayload,
} from '../types';

const API_BASE = '/api';

export async function fetchMonitors(): Promise<MonitorWithStats[]> {
  const res = await fetch(`${API_BASE}/monitors`);
  if (!res.ok) throw new Error('Failed to fetch monitors');
  return res.json();
}

export async function fetchMonitor(id: string): Promise<MonitorWithStats> {
  const res = await fetch(`${API_BASE}/monitors/${id}`);
  if (!res.ok) throw new Error('Failed to fetch monitor details');
  return res.json();
}

export async function createMonitor(payload: CreateMonitorPayload): Promise<Monitor> {
  const res = await fetch(`${API_BASE}/monitors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Failed to create monitor');
  }
  return res.json();
}

export async function deleteMonitor(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/monitors/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete monitor');
}

export async function pauseMonitor(id: string): Promise<Monitor> {
  const res = await fetch(`${API_BASE}/monitors/${id}/pause`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to pause monitor');
  return res.json();
}

export async function resumeMonitor(id: string): Promise<Monitor> {
  const res = await fetch(`${API_BASE}/monitors/${id}/resume`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to resume monitor');
  return res.json();
}

export async function triggerTest(id: string): Promise<Monitor> {
  const res = await fetch(`${API_BASE}/monitors/${id}/test`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger monitor test');
  return res.json();
}

export async function bulkAction(payload: BulkActionPayload): Promise<BulkActionResponse> {
  const res = await fetch(`${API_BASE}/monitors/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Bulk action failed');
  return res.json();
}

export async function fetchStats(): Promise<GlobalStats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchIncidents(): Promise<IncidentWithDetails[]> {
  const res = await fetch(`${API_BASE}/incidents`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export async function fetchIncident(id: string): Promise<IncidentWithDetails> {
  const res = await fetch(`${API_BASE}/incidents/${id}`);
  if (!res.ok) throw new Error('Failed to fetch incident details');
  return res.json();
}

export async function updateIncident(id: string, payload: UpdateIncidentPayload): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update incident');
  return res.json();
}

export async function addIncidentUpdate(id: string, payload: AddIncidentUpdatePayload): Promise<IncidentUpdate> {
  const res = await fetch(`${API_BASE}/incidents/${id}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to post incident update');
  return res.json();
}

export async function createManualIncident(payload: CreateManualIncidentPayload): Promise<IncidentWithDetails> {
  const res = await fetch(`${API_BASE}/incidents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create manual incident');
  return res.json();
}

export async function fetchStatusPage(): Promise<PublicStatusPage> {
  const res = await fetch(`${API_BASE}/status-page`);
  if (!res.ok) throw new Error('Failed to fetch status page data');
  return res.json();
}

// Notification Channels API
export async function fetchChannels(): Promise<NotificationChannel[]> {
  const res = await fetch(`${API_BASE}/notifications`);
  if (!res.ok) throw new Error('Failed to fetch notification channels');
  return res.json();
}

export async function createChannel(payload: CreateChannelPayload): Promise<NotificationChannel> {
  const res = await fetch(`${API_BASE}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update notification channel');
  return res.json();
}

export async function deleteChannel(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/notifications/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete notification channel');
}

export async function testChannel(id: string): Promise<{ success: boolean; message: string; error?: string }> {
  const res = await fetch(`${API_BASE}/notifications/${id}/test`, { method: 'POST' });
  return res.json();
}

export async function fetchAlertLogs(): Promise<AlertLogWithDetails[]> {
  const res = await fetch(`${API_BASE}/notifications/logs`);
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
