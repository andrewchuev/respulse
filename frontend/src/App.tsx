import { useEffect, useState } from 'react';
import { AppConfig, CreateMonitorPayload, GlobalStats, MonitorWithStats, UserProfile } from './types';
import {
  clearAuthSession,
  createMonitor,
  createWebSocketConnection,
  deleteMonitor,
  DEFAULT_APP_CONFIG,
  fetchAdminAccess,
  fetchAuthConfig,
  fetchCurrentUser,
  fetchMonitors,
  fetchStats,
  getAuthToken,
  onUnauthorized,
  pauseMonitor,
  resumeMonitor,
  triggerTest,
} from './api/client';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { MonitorList } from './components/MonitorList';
import { AddMonitorModal } from './components/AddMonitorModal';
import { EditMonitorModal } from './components/EditMonitorModal';
import { MonitorDetailModal } from './components/MonitorDetailModal';
import { StatusPage } from './components/StatusPage';
import { NotificationChannels } from './components/NotificationChannels';
import { IncidentManagement } from './components/IncidentManagement';
import { TeamManagement } from './components/TeamManagement';
import { SkeletonDashboard } from './components/SkeletonDashboard';
import { PromoLandingPage } from './components/PromoLandingPage';
import { AuthModal } from './components/AuthModal';
import { LegalPage } from './components/LegalPage';
import { AdminPanel } from './components/AdminPanel';
import { VerifyEmailPage } from './components/VerifyEmailPage';
import { WayForPayCheckoutModal } from './components/WayForPayCheckoutModal';
import { ManageSubscriptionModal } from './components/ManageSubscriptionModal';
import { ExportImportModal } from './components/ExportImportModal';
import { MobileAuthScreen } from './components/MobileAuthScreen';
import { isTauri } from './lib/sshClient';
import { isBiometricEnabledLocally, promptBiometricAuth } from './lib/biometrics';

type View = 'dashboard' | 'channels' | 'incidents' | 'team' | 'status-page' | 'promo' | 'terms' | 'privacy' | 'refund' | 'admin' | 'verify-email' | 'login';

export function App() {
  const [monitors, setMonitors] = useState<MonitorWithStats[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [selectedMonitor, setSelectedMonitor] = useState<MonitorWithStats | null>(null);
  const [editingMonitor, setEditingMonitor] = useState<MonitorWithStats | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isManageSubscriptionModalOpen, setIsManageSubscriptionModalOpen] = useState(false);
  const [isExportImportModalOpen, setIsExportImportModalOpen] = useState(false);
  const [exportImportDefaultTab, setExportImportDefaultTab] = useState<'export' | 'import'>('export');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('checkout') === 'success' || params.get('payment') === 'success') {
        const url = new URL(window.location.href);
        url.searchParams.delete('checkout');
        url.searchParams.delete('payment');
        window.history.replaceState({}, '', url.toString());
        loadUserData();
        loadData();
      }
      if (params.get('upgrade') === '1') {
        setIsUpgradeModalOpen(true);
      }
    } catch {}
  }, []);
  const getViewFromLocation = (): View => {
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const path = window.location.pathname.toLowerCase();

      // In Tauri / mobile application flow, bypass promo completely
      if (isTauri()) {
        const token = getAuthToken();
        if (token) {
          if (view === 'channels' || path === '/channels') return 'channels';
          if (view === 'incidents' || path === '/incidents') return 'incidents';
          if (view === 'team' || path === '/team') return 'team';
          if (view === 'status' || view === 'status-page' || path === '/status' || path === '/status-page') return 'status-page';
          return 'dashboard';
        }
        return 'login';
      }

      if (view === 'dashboard' || view === 'app' || path === '/app' || path === '/dashboard') return 'dashboard';
      if (view === 'channels' || path === '/channels') return 'channels';
      if (view === 'incidents' || path === '/incidents') return 'incidents';
      if (view === 'team' || path === '/team') return 'team';
      if (view === 'status' || view === 'status-page' || path === '/status' || path === '/status-page') return 'status-page';
      if (path === '/admin') return 'admin';
      if (path === '/verify-email') return 'verify-email';
      if (path === '/terms') return 'terms';
      if (path === '/privacy') return 'privacy';
      if (path === '/refund') return 'refund';
      if (view === 'promo' || path === '/promo') return 'promo';
      if (path === '/' || path === '') return 'promo';
    } catch {}
    return isTauri() ? (getAuthToken() ? 'dashboard' : 'login') : 'promo';
  };

  const [currentView, setCurrentView] = useState<View>(getViewFromLocation);

  const requiresAuth = (view: string) =>
    view === 'dashboard' || view === 'channels' || view === 'incidents' || view === 'team' || view === 'admin';

  const changeView = (requested: View) => {
    let newView = requested;
    if (requiresAuth(newView) && !getAuthToken()) {
      if (isTauri()) {
        newView = 'login';
      } else {
        openAuth('login');
        newView = 'promo';
      }
    }
    setCurrentView(newView);
    try {
      let targetPath = '/';
      if (newView === 'login') targetPath = '/login';
      else if (newView === 'promo') targetPath = '/';
      else if (newView === 'dashboard') targetPath = '/app';
      else if (newView === 'status-page') targetPath = '/status';
      else targetPath = `/${newView}`;

      if (window.location.pathname !== targetPath) {
        window.history.pushState({ view: newView }, '', targetPath);
      }
    } catch {}
  };

  useEffect(() => {
    const handlePopState = () => {
      const view = getViewFromLocation();
      if (requiresAuth(view) && !getAuthToken()) {
        setCurrentView(isTauri() ? 'login' : 'promo');
      } else {
        setCurrentView(view);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [loading, setLoading] = useState(true);

  // Auth & RBAC State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [pendingUpgradeAfterAuth, setPendingUpgradeAfterAuth] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [isAdmin, setIsAdmin] = useState(false);
  const billingEnabled = appConfig.billing_enabled;
  const planKey = currentUser?.team_plan === 'PRO' ? 'PRO' : 'FREE';
  // Checkout is hidden while the service is a free beta.
  const openUpgrade = billingEnabled
    ? () => {
        if (!currentUser) {
          setPendingUpgradeAfterAuth(true);
          openAuth('register');
        } else if (currentUser.team_plan === 'PRO') {
          setIsManageSubscriptionModalOpen(true);
        } else {
          setIsUpgradeModalOpen(true);
        }
      }
    : undefined;

  const openManageSubscription = () => {
    setIsManageSubscriptionModalOpen(true);
  };

  const openExportImport = (tab: 'export' | 'import' = 'export') => {
    setExportImportDefaultTab(tab);
    setIsExportImportModalOpen(true);
  };

  const openAuth = (mode: 'login' | 'register') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleAuthClose = () => {
    setIsAuthModalOpen(false);
    setPendingUpgradeAfterAuth(false);
  };

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    loadData();
    loadUserData();
    changeView('dashboard');
    if (pendingUpgradeAfterAuth) {
      setPendingUpgradeAfterAuth(false);
      setIsUpgradeModalOpen(true);
    }
  };

  useEffect(() => {
    try {
      const path = window.location.pathname.toLowerCase();
      if (path === '/login') {
        openAuth('login');
      } else if (path === '/register' || path === '/signup') {
        openAuth('register');
      }
    } catch {}
  }, []);

  const handleSignOut = () => {
    clearAuthSession();
    setCurrentUser(null);
    changeView(isTauri() ? 'login' : 'promo');
  };

  const loadUserData = async () => {
    try {
      setCurrentUser(await fetchCurrentUser());
    } catch (e) {
      console.warn('Failed to load user info', e);
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
    fetchAuthConfig().then(setAppConfig);

    // Any 401 from the API means the session is gone
    const unsubscribe = onUnauthorized(() => {
      setCurrentUser(null);
      if (isTauri()) {
        changeView('login');
      } else {
        changeView('promo');
        openAuth('login');
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      if (isTauri()) {
        setCurrentView('login');
      } else if (requiresAuth(currentView)) {
        changeView(currentView);
      }
      return;
    }

    // In mobile, if biometric lock is turned on, ask for fingerprint verification on app launch
    if (isTauri() && isBiometricEnabledLocally()) {
      promptBiometricAuth('Confirm fingerprint to sign in to ResPulse').then((verified) => {
        if (verified) {
          loadUserData();
          loadData();
          setCurrentView('dashboard');
        } else {
          setLoading(false);
          setCurrentView('login');
        }
      });
      return;
    }

    loadUserData();
    loadData();
    if (isTauri()) {
      setCurrentView('dashboard');
    }
  }, []);

  // The operator link only appears for emails the server lists in ADMIN_EMAILS.
  useEffect(() => {
    if (!currentUser) {
      setIsAdmin(false);
      return;
    }
    fetchAdminAccess().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [currentUser?.id]);

  // Reconnect the live stream whenever the signed-in user changes, so it carries the right tenant.
  useEffect(() => {
    if (!currentUser) return;

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
  }, [currentUser?.id]);

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

  if (currentView === 'verify-email') {
    return <VerifyEmailPage />;
  }

  if (currentView === 'terms' || currentView === 'privacy' || currentView === 'refund') {
    return <LegalPage kind={currentView} />;
  }

  if (currentView === 'login' || (isTauri() && (currentView === 'promo' || !getAuthToken()))) {
    return (
      <MobileAuthScreen
        onSuccess={handleAuthSuccess}
      />
    );
  }

  if (currentView === 'status-page') {
    return (
      <>
        <StatusPage
          onBack={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              changeView('promo');
            }
          }}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={handleAuthClose}
          initialMode={authModalMode}
          subtitle={
            pendingUpgradeAfterAuth
              ? authModalMode === 'login'
                ? 'Sign in to your account to upgrade to ResPulse Pro ($16/mo)'
                : 'Create your workspace account to activate ResPulse Pro ($16/mo)'
              : undefined
          }
          onSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  if (currentView === 'promo') {
    return (
      <>
        <PromoLandingPage
          onOpenDashboard={() => changeView('dashboard')}
          onOpenStatusPage={() => changeView('status-page')}
          onOpenAddModal={() => {
            changeView('dashboard');
            setIsAddModalOpen(true);
          }}
          onOpenAuth={openAuth}
          onOpenUpgradeModal={openUpgrade}
          billingEnabled={billingEnabled}
          plans={appConfig.plans}
        />
        <WayForPayCheckoutModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={handleAuthClose}
          initialMode={authModalMode}
          subtitle={
            pendingUpgradeAfterAuth
              ? authModalMode === 'login'
                ? 'Sign in to your account to upgrade to ResPulse Pro ($16/mo)'
                : 'Create your workspace account to activate ResPulse Pro ($16/mo)'
              : undefined
          }
          onSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  const isViewer = currentUser?.role === 'VIEWER';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans relative overflow-x-hidden">
      {/* Ambient Brand Glow Mesh in Background */}
      <div className="pointer-events-none fixed top-0 left-1/4 -z-10 h-[450px] w-[550px] rounded-full bg-emerald-500/5 blur-[140px]" />
      <div className="pointer-events-none fixed top-10 right-1/4 -z-10 h-[400px] w-[500px] rounded-full bg-cyan-500/5 blur-[150px]" />

      <Header
        currentView={currentView}
        setCurrentView={changeView}
        onOpenAddModal={() => setIsAddModalOpen(true)}
        totalActive={monitors.filter((m) => !m.is_paused).length}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onOpenAuth={openAuth}
        onSignOut={handleSignOut}
        onOpenUpgradeModal={openUpgrade}
        onOpenManageSubscription={openManageSubscription}
        onOpenExportImport={openExportImport}
      />

      {/* Viewer Mode Banner */}
      {isViewer && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
          <span className="font-semibold font-mono">👁️ VIEWER MODE (READ-ONLY):</span>
          <span>You have stakeholder audit access. Modifying targets, running probes, altering alerts, and declaring outages are restricted.</span>
        </div>
      )}

      <main className="flex-1 container mx-auto px-2.5 sm:px-4 py-4 sm:py-8">
        {loading ? (
          <SkeletonDashboard />
        ) : currentView === 'channels' ? (
          <NotificationChannels currentUser={currentUser} />
        ) : currentView === 'incidents' ? (
          <IncidentManagement currentUser={currentUser} />
        ) : currentView === 'admin' ? (
          <AdminPanel />
        ) : currentView === 'team' ? (
          <TeamManagement
            currentUser={currentUser}
            onUserRefreshed={loadUserData}
            onOpenUpgradeModal={openUpgrade}
            onOpenManageSubscription={openManageSubscription}
            billingEnabled={billingEnabled}
            planLimits={appConfig.plans[planKey]}
          />
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
              onEdit={(m) => setEditingMonitor(m)}
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
        minInterval={appConfig.plans[planKey].min_interval_seconds}
        isPro={planKey === 'PRO'}
      />

      <EditMonitorModal
        monitor={editingMonitor}
        isOpen={!!editingMonitor}
        minInterval={appConfig.plans[planKey].min_interval_seconds}
        isPro={planKey === 'PRO'}
        onClose={() => setEditingMonitor(null)}
        onUpdated={(updated) => {
          loadData();
          setEditingMonitor(null);
          if (selectedMonitor && selectedMonitor.id === updated.id) {
            setSelectedMonitor((prev) => (prev ? { ...prev, ...updated } : null));
          }
        }}
      />

      <MonitorDetailModal
        monitor={selectedMonitor}
        onClose={() => setSelectedMonitor(null)}
        onEdit={(m) => setEditingMonitor(m)}
        isViewer={isViewer}
      />

      <WayForPayCheckoutModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      <ManageSubscriptionModal
        isOpen={isManageSubscriptionModalOpen}
        onClose={() => setIsManageSubscriptionModalOpen(false)}
        currentUser={currentUser}
        onSubscriptionCanceled={() => {
          loadUserData();
          loadData();
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleAuthClose}
        initialMode={authModalMode}
        subtitle={
          pendingUpgradeAfterAuth
            ? authModalMode === 'login'
              ? 'Sign in to your account to upgrade to ResPulse Pro ($16/mo)'
              : 'Create your workspace account to activate ResPulse Pro ($16/mo)'
            : undefined
        }
        onSuccess={handleAuthSuccess}
      />

      <ExportImportModal
        isOpen={isExportImportModalOpen}
        onClose={() => setIsExportImportModalOpen(false)}
        currentUser={currentUser}
        defaultTab={exportImportDefaultTab}
        onImportSuccess={() => {
          loadData();
        }}
      />

      {!isTauri() && (
        <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
          <p className="font-mono">ResPulse v{__APP_VERSION__} — High-performance Synthetic Monitoring Engine in Rust</p>
          <p className="font-mono mt-2 space-x-3 text-[11px]">
            <a href="/terms" className="hover:text-emerald-400 transition-colors">Terms of Service</a>
            <span>·</span>
            <a href="/privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</a>
            <span>·</span>
            <a href="/refund" className="hover:text-emerald-400 transition-colors">Refund & Cancellation</a>
          </p>
        </footer>
      )}
    </div>
  );
}

export default App;
