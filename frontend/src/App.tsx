import { useEffect, useState } from 'react';
import { CreateMonitorPayload, GlobalStats, MonitorWithStats } from './types';
import {
  createMonitor,
  createWebSocketConnection,
  deleteMonitor,
  fetchMonitors,
  fetchStats,
  pauseMonitor,
  resumeMonitor,
  triggerTest,
} from './api/client';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { MonitorList } from './components/MonitorList';
import { AddMonitorModal } from './components/AddMonitorModal';
import { MonitorDetailModal } from './components/MonitorDetailModal';
import { StatusPage } from './components/StatusPage';
import { NotificationChannels } from './components/NotificationChannels';

export function App() {
  const [monitors, setMonitors] = useState<MonitorWithStats[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [selectedMonitor, setSelectedMonitor] = useState<MonitorWithStats | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'channels' | 'status-page'>('dashboard');
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        totalActive={monitors.filter((m) => !m.is_paused).length}
      />

      <main className="flex-1 container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            <p className="text-xs text-muted-foreground font-mono">Connecting to probe engine...</p>
          </div>
        ) : currentView === 'channels' ? (
          <NotificationChannels />
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
