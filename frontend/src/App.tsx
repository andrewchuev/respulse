import { useEffect, useState } from 'react';
import { CreateMonitorPayload, GlobalStats, MonitorWithStats, UserProfile } from './types';
import {
  createMonitor,
  createWebSocketConnection,
  deleteMonitor,
  fetchAvailableUsers,
  fetchCurrentUser,
  fetchMonitors,
  fetchStats,
  pauseMonitor,
  resumeMonitor,
  switchUser,
  triggerTest,
} from './api/client';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { MonitorList } from './components/MonitorList';
import { AddMonitorModal } from './components/AddMonitorModal';
import { MonitorDetailModal } from './components/MonitorDetailModal';
import { StatusPage } from './components/StatusPage';
import { NotificationChannels } from './components/NotificationChannels';
import { IncidentManagement } from './components/IncidentManagement';
import { TeamManagement } from './components/TeamManagement';
import { SkeletonDashboard } from './components/SkeletonDashboard';

export function App() {
  const [monitors, setMonitors] = useState<MonitorWithStats[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [selectedMonitor, setSelectedMonitor] = useState<MonitorWithStats | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'channels' | 'incidents' | 'team' | 'status-page'>('dashboard');
  const [loading, setLoading] = useState(true);

  // RBAC State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);

  const loadUserData = async () => {
    try {
      const [user, users] = await Promise.all([
        fetchCurrentUser(),
        fetchAvailableUsers(),
      ]);
      setCurrentUser(user);
      setAvailableUsers(users);
    } catch (e) {
      console.error('Failed to load user info', e);
    }
  };

  const loadData = async () => {
    try {
      const [m, s] = await Promise.all([fetchMonitors(), fetchStats()]);
      setMonitors(m);
      setStats(s);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
    loadData();

    // Setup live WebSocket stream
    const unsubscribe = createWebSocketConnection((event) => {
      if (event.type === 'MonitorUpdated') {
        setMonitors((prev) =>
          prev.map((m) =>
            m.id === event.data.id
              ? {
                  ...m,
                  ...event.data,
                }
              : m
          )
        );
        fetchStats().then(setStats).catch(() => {});
      } else if (event.type === 'CheckCompleted') {
        const { monitor_id, is_up, response_time_ms, status_code } = event.data;
        setMonitors((prev) =>
          prev.map((m) => {
            if (m.id !== monitor_id) return m;
            const newHistory = [
              ...m.recent_history,
              {
                timestamp: new Date().toISOString(),
                is_up,
                response_time_ms,
                status_code,
              },
            ].slice(-30);

            return {
              ...m,
              status: is_up ? 'UP' : 'DOWN',
              last_checked_at: new Date().toISOString(),
              last_response_time_ms: response_time_ms,
              last_status_code: status_code,
              recent_history: newHistory,
            };
          })
        );
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSwitchUser = async (email: string) => {
    try {
      const switched = await switchUser(email);
      setCurrentUser(switched);
      await loadData();
    } catch (e) {
      console.error('Failed to switch user:', e);
    }
  };

  const handlePause = async (id: string) => {
    try {
      const updated = await pauseMonitor(id);
      setMonitors((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updated } : m))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleResume = async (id: string) => {
    try {
      const updated = await resumeMonitor(id);
      setMonitors((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updated } : m))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this monitor?')) return;
    try {
      await deleteMonitor(id);
      setMonitors((prev) => prev.filter((m) => m.id !== id));
      if (selectedMonitor?.id === id) setSelectedMonitor(null);
      fetchStats().then(setStats).catch(() => {});
    } catch (e) {
      console.error(e);
    }
  };

  const handleTest = async (id: string) => {
    try {
      const updated = await triggerTest(id);
      setMonitors((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updated } : m))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (payload: CreateMonitorPayload) => {
    await createMonitor(payload);
    await loadData();
    setIsAddModalOpen(false);
  };

  if (currentView === 'status-page') {
    return <StatusPage onBack={() => setCurrentView('dashboard')} />;
  }

  const isViewer = currentUser?.role === 'VIEWER';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-hidden">
      {/* Ambient Brand Glow Mesh in Background */}
      <div className="pointer-events-none fixed top-0 left-1/4 -z-10 h-[450px] w-[550px] rounded-full bg-emerald-500/5 blur-[140px]" />
      <div className="pointer-events-none fixed top-10 right-1/4 -z-10 h-[400px] w-[500px] rounded-full bg-cyan-500/5 blur-[150px]" />

      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        totalActive={monitors.filter((m) => !m.is_paused).length}
        currentUser={currentUser}
        availableUsers={availableUsers}
        onSwitchUser={handleSwitchUser}
      />

      {/* Viewer Mode Banner */}
      {isViewer && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
          <span className="font-semibold font-mono">👁️ VIEWER MODE (READ-ONLY):</span>
          <span>You have stakeholder audit access. Modifying targets, running probes, altering alerts, and declaring outages are restricted.</span>
        </div>
      )}

      <main className="flex-1 container mx-auto px-4 py-8">
        {loading ? (
          <SkeletonDashboard />
        ) : currentView === 'channels' ? (
          <NotificationChannels currentUser={currentUser} />
        ) : currentView === 'incidents' ? (
          <IncidentManagement currentUser={currentUser} />
        ) : currentView === 'team' ? (
          <TeamManagement currentUser={currentUser} onUserRefreshed={loadUserData} />
        ) : (
          <>
            <StatsOverview stats={stats} />

            <MonitorList
              monitors={monitors}
              onPause={handlePause}
              onResume={handleResume}
              onDelete={handleDelete}
              onTest={handleTest}
              onSelect={setSelectedMonitor}
              onAddClick={() => setIsAddModalOpen(true)}
              onRefreshData={loadData}
              isViewer={isViewer}
            />
          </>
        )}
      </main>

      <AddMonitorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreate}
      />

      <MonitorDetailModal
        monitor={selectedMonitor}
        onClose={() => setSelectedMonitor(null)}
      />

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <p className="font-mono">ResPulse v1.0 — High-performance Synthetic Monitoring Engine in Rust</p>
      </footer>
    </div>
  );
}

export default App;
