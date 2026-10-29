import React, { useEffect, useState } from 'react';
import {
  Shield,
  BarChart3,
  Building2,
  Users,
  Server,
  Activity,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Database,
  Send,
  ExternalLink,
} from 'lucide-react';
import {
  AdminReportData,
  AdminTeamItem,
  AdminUserItem,
  AdminSystemStatus,
} from '../types';
import {
  fetchAdminReport,
  fetchAdminTeams,
  updateAdminTeamPlan,
  deleteAdminTeam,
  fetchAdminUsers,
  updateAdminUserStatus,
  fetchAdminSystemStatus,
  triggerAdminPrune,
  triggerAdminBackupPing,
} from '../api/client';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

type AdminTab = 'analytics' | 'teams' | 'users' | 'status_page' | 'infrastructure';

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–');

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '–');

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('teams');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Data states
  const [report, setReport] = useState<AdminReportData | null>(null);
  const [teams, setTeams] = useState<AdminTeamItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [systemStatus, setSystemStatus] = useState<AdminSystemStatus | null>(null);

  // Search filters
  const [teamSearch, setTeamSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Action states
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, t, u, s] = await Promise.all([
        fetchAdminReport().catch(() => null),
        fetchAdminTeams().catch(() => []),
        fetchAdminUsers().catch(() => []),
        fetchAdminSystemStatus().catch(() => null),
      ]);
      setReport(r);
      setTeams(t);
      setUsers(u);
      setSystemStatus(s);
    } catch (err: any) {
      setError(err?.message || 'Failed to load super-admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleTogglePlan = async (team: AdminTeamItem) => {
    const newPlan = team.plan === 'PRO' ? 'FREE' : 'PRO';
    setActionInProgress(`plan-${team.id}`);
    try {
      await updateAdminTeamPlan(team.id, newPlan);
      setTeams((prev) =>
        prev.map((t) => (t.id === team.id ? { ...t, plan: newPlan } : t))
      );
      setNotice(`Updated organization "${team.name}" plan to ${newPlan}`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update plan');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteTeam = async (team: AdminTeamItem) => {
    if (team.id === '00000000-0000-0000-0000-000000000001') {
      alert('The primary system demo organization cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete organization "${team.name}" and all its monitors?`)) {
      return;
    }
    setActionInProgress(`delete-team-${team.id}`);
    try {
      await deleteAdminTeam(team.id);
      setTeams((prev) => prev.filter((t) => t.id !== team.id));
      setNotice(`Deleted organization "${team.name}"`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete team');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleUserStatus = async (user: AdminUserItem) => {
    const newStatus = !user.is_active;
    setActionInProgress(`user-status-${user.id}`);
    try {
      await updateAdminUserStatus(user.id, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: newStatus } : u))
      );
      setNotice(`User "${user.email}" ${newStatus ? 'activated' : 'suspended'}`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleTriggerPrune = async () => {
    if (!confirm('Run database retention pass now? Old check history exceeding plan retention will be deleted.')) {
      return;
    }
    setActionInProgress('prune');
    try {
      const res = await triggerAdminPrune();
      setNotice(res.message);
      // Reload system status to reflect new size
      fetchAdminSystemStatus().then(setSystemStatus).catch(console.error);
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Pruning failed');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleTriggerBackupPing = async () => {
    setActionInProgress('backup-ping');
    try {
      const res = await triggerAdminBackupPing();
      setNotice(`Heartbeat ping sent: ${res.message}`);
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger backup heartbeat');
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredTeams = teams.filter(
    (t) =>
      t.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
      t.slug.toLowerCase().includes(teamSearch.toLowerCase())
  );

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.team_name.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Plane Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-mono font-medium mb-2">
            <Shield className="h-3.5 w-3.5" />
            Platform Control Plane
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            Super-Administrator Console
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Global management of organizations, user accounts, platform self-monitoring, and infrastructure telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={loadAll}
            disabled={loading}
            className="gap-1.5 text-xs border-border/80"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <a
            href="/status"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-mono bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Activity className="h-3.5 w-3.5" />
            Live /status
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Alert Notices */}
      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/60 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('teams')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'teams'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-muted-foreground hover:text-white'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Organizations ({teams.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-muted-foreground hover:text-white'
          }`}
        >
          <Users className="h-4 w-4" />
          Platform Users ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('status_page')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'status_page'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-muted-foreground hover:text-white'
          }`}
        >
          <Activity className="h-4 w-4" />
          Platform Self-Monitoring
        </button>

        <button
          onClick={() => setActiveTab('infrastructure')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'infrastructure'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-muted-foreground hover:text-white'
          }`}
        >
          <Server className="h-4 w-4" />
          Infrastructure & DB
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-muted-foreground hover:text-white'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Operator Funnel & Analytics
        </button>
      </div>

      {/* TAB 1: ORGANIZATIONS (TENANTS) */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search organizations by name or slug..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-card/60 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Showing {filteredTeams.length} of {teams.length} organizations
            </div>
          </div>

          <div className="border border-border/70 rounded-xl bg-card/40 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 text-muted-foreground font-mono text-[11px] border-b border-border/60">
                <tr>
                  <th className="p-3">Organization</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Monitors</th>
                  <th className="p-3">Members</th>
                  <th className="p-3">Active Outages</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No organizations found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((t) => (
                    <tr key={t.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3">
                        <div className="font-sans font-bold text-white text-sm">{t.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                          <span>slug: {t.slug}</span>
                          {t.id === '00000000-0000-0000-0000-000000000001' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              System Primary
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.plan === 'PRO'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-secondary text-muted-foreground border border-border/60'
                          }`}
                        >
                          {t.plan}
                        </span>
                      </td>
                      <td className="p-3 text-foreground">{t.monitors_count}</td>
                      <td className="p-3 text-foreground">{t.users_count}</td>
                      <td className="p-3">
                        {t.active_incidents_count > 0 ? (
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />
                            {t.active_incidents_count} active
                          </span>
                        ) : (
                          <span className="text-emerald-400">0</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{day(t.created_at)}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTogglePlan(t)}
                            disabled={actionInProgress === `plan-${t.id}`}
                            className="h-7 text-[11px] px-2.5 border-border/80 hover:bg-secondary"
                            title={`Switch to ${t.plan === 'PRO' ? 'FREE' : 'PRO'}`}
                          >
                            Set {t.plan === 'PRO' ? 'FREE' : 'PRO'}
                          </Button>
                          {t.id !== '00000000-0000-0000-0000-000000000001' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTeam(t)}
                              disabled={actionInProgress === `delete-team-${t.id}`}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-950/20"
                              title="Delete Organization"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PLATFORM USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search users by name, email or team..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-card/60 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>

          <div className="border border-border/70 rounded-xl bg-card/40 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 text-muted-foreground font-mono text-[11px] border-b border-border/60">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Organization</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Email Verified</th>
                  <th className="p-3">Last Login</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3">
                        <div className="font-sans font-bold text-white text-sm">{u.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{u.email}</div>
                      </td>
                      <td className="p-3 text-foreground font-sans">{u.team_name}</td>
                      <td className="p-3">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-secondary/80 text-muted-foreground font-bold">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
                            <XCircle className="h-3 w-3" />
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {u.email_verified_at ? 'Verified' : 'Pending'}
                      </td>
                      <td className="p-3 text-muted-foreground">{day(u.last_login_at)}</td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleUserStatus(u)}
                          disabled={actionInProgress === `user-status-${u.id}`}
                          className={`h-7 text-[11px] px-2.5 border-border/80 ${
                            u.is_active
                              ? 'hover:bg-red-950/30 hover:text-red-300'
                              : 'hover:bg-emerald-950/30 hover:text-emerald-300'
                          }`}
                        >
                          {u.is_active ? 'Suspend' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PLATFORM SELF-MONITORING & STATUS PAGE */}
      {activeTab === 'status_page' && (
        <div className="space-y-6">
          <Card className="border-border/70 bg-card/40 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    Public Status Page & Platform Health
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Controls the 5 authoritative platform self-monitoring components rendered on https://respulse.online/status.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleTriggerBackupPing}
                  disabled={actionInProgress === 'backup-ping'}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  <Send className="h-3.5 w-3.5" />
                  Trigger Backup Heartbeat Ping
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border/60 bg-background/40 space-y-2">
                  <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Zone of Responsibility
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong>Platform Scope:</strong> These 5 monitors are owned by the primary platform team.
                    Regular tenants cannot modify them. They guarantee continuous synthetic transparency for all customers.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border/60 bg-background/40 space-y-2">
                  <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Automated Backup Heartbeat
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Configured as a Daily Cron check (<code className="text-emerald-400">17 3 * * *</code>).
                    The night cron runs <code className="text-slate-300">deploy/backup.sh</code> and signals completion.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: INFRASTRUCTURE & MAINTENANCE */}
      {activeTab === 'infrastructure' && systemStatus && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-border/70 bg-card/40">
              <CardContent className="p-4">
                <div className="text-[11px] font-mono uppercase text-muted-foreground">Database Status</div>
                <div className="mt-1 text-xl font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-5 w-5" />
                  Connected
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">PostgreSQL 16 Engine</div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/40">
              <CardContent className="p-4">
                <div className="text-[11px] font-mono uppercase text-muted-foreground">Check Results Total</div>
                <div className="mt-1 text-xl font-bold text-white font-mono">
                  {systemStatus.total_check_results.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Table size: {formatBytes(systemStatus.check_results_bytes)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/40">
              <CardContent className="p-4">
                <div className="text-[11px] font-mono uppercase text-muted-foreground">Total Database Size</div>
                <div className="mt-1 text-xl font-bold text-white font-mono">
                  {formatBytes(systemStatus.database_bytes)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">All tables & indexes</div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/40">
              <CardContent className="p-4">
                <div className="text-[11px] font-mono uppercase text-muted-foreground">Active Probes</div>
                <div className="mt-1 text-xl font-bold text-white font-mono">
                  {systemStatus.active_monitors} / {systemStatus.total_monitors}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Across {systemStatus.total_teams} teams</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/70 bg-card/40 backdrop-blur">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Database className="h-4 w-4 text-purple-400" />
                    Storage Retention & Table Maintenance
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Batched deletion of expired check results older than team plan limits (14 days for Free, 90 days for Pro).
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTriggerPrune}
                  disabled={actionInProgress === 'prune'}
                  className="gap-2 border-border/80 text-xs font-semibold hover:bg-secondary"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${actionInProgress === 'prune' ? 'animate-spin' : ''}`} />
                  Run Retention Pass Now
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg border border-border/60 bg-background/40">
                  <div className="text-muted-foreground">Private Targets (SSRF guard):</div>
                  <div className="text-white font-bold mt-1">
                    {systemStatus.allow_private_targets ? 'ALLOWED (Local Dev)' : 'BLOCKED (Production)'}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-border/60 bg-background/40">
                  <div className="text-muted-foreground">Demo Mode:</div>
                  <div className="text-white font-bold mt-1">
                    {systemStatus.demo_mode ? 'ENABLED (Persona Switch)' : 'DISABLED'}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-border/60 bg-background/40">
                  <div className="text-muted-foreground">SMTP Outbound Mailer:</div>
                  <div className="text-white font-bold mt-1">
                    {systemStatus.smtp_configured ? 'CONFIGURED' : 'NOT CONFIGURED'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: OPERATOR FUNNEL & ANALYTICS */}
      {activeTab === 'analytics' && report && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border border-border/70 rounded-xl bg-card/40 p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Teams</div>
              <div className="mt-1 text-2xl font-bold text-white">{report.totals.teams}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{report.totals.users} users</div>
            </div>
            <div className="border border-border/70 rounded-xl bg-card/40 p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Active 7d</div>
              <div className="mt-1 text-2xl font-bold text-white">{report.totals.active_teams_7d}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{pct(report.totals.active_teams_7d, report.totals.teams)} of teams</div>
            </div>
            <div className="border border-border/70 rounded-xl bg-card/40 p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Signups, 30d</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {report.signups_daily.reduce((sum, d) => sum + d.teams, 0)}
              </div>
            </div>
            <div className="border border-border/70 rounded-xl bg-card/40 p-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Pro Teams</div>
              <div className="mt-1 text-2xl font-bold text-emerald-400">{report.totals.pro_teams}</div>
            </div>
          </div>

          {/* Activation Funnel */}
          <div className="border border-border/70 rounded-xl bg-card/40 p-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              User Activation Funnel
            </div>
            <div className="space-y-2">
              {[
                { label: 'Signed up', value: report.totals.teams },
                { label: 'Created a monitor', value: report.totals.activated_teams },
                { label: 'Connected an alert channel', value: report.totals.teams_with_alert_channel },
                { label: 'Active in the last 7 days', value: report.totals.active_teams_7d },
              ].map((step) => (
                <div key={step.label}>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{step.label}</span>
                    <span className="font-mono">
                      {step.value} · {pct(step.value, report.totals.teams)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-slate-800">
                    <div
                      className="h-2 rounded bg-emerald-500"
                      style={{
                        width: `${report.totals.teams > 0 ? (step.value / report.totals.teams) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
