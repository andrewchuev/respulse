import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AdminReportData } from '../types';
import { fetchAdminReport } from '../api/client';
import { Button } from './ui/button';

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–');

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '–');

const Card: React.FC<{ title: string; value: React.ReactNode; hint?: string }> = ({ title, value, hint }) => (
  <div className="border border-border/70 rounded-xl bg-card/40 p-4">
    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{title}</div>
    <div className="mt-1 text-2xl font-bold text-white">{value}</div>
    {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
  </div>
);

const Section: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <section className="space-y-3">
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {note && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{note}</p>}
    </div>
    {children}
  </section>
);

export const AdminReport: React.FC = () => {
  const [report, setReport] = useState<AdminReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAdminReport()
      .then(setReport)
      .catch((e) => setError(e.message || 'Failed to load report'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (error) {
    return <div className="p-4 rounded-lg bg-red-950/50 border border-red-500/30 text-sm text-red-200">{error}</div>;
  }
  if (!report) {
    return <div className="text-sm text-muted-foreground">{loading ? 'Loading report…' : 'No data'}</div>;
  }

  const t = report.totals;
  const maxSignups = Math.max(1, ...report.signups_daily.map((d) => d.teams));
  const signups30 = report.signups_daily.reduce((sum, d) => sum + d.teams, 0);
  const funnel = [
    { label: 'Signed up', value: t.teams },
    { label: 'Created a monitor', value: t.activated_teams },
    { label: 'Connected an alert channel', value: t.teams_with_alert_channel },
    { label: 'Active in the last 7 days', value: t.active_teams_7d },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Operator report</h2>
          <p className="text-xs text-muted-foreground">
            Aggregates only, demo organization excluded. Generated {new Date(report.generated_at).toLocaleString()}.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card title="Teams" value={t.teams} hint={`${t.users} users`} />
        <Card title="Active 7d" value={t.active_teams_7d} hint={`${pct(t.active_teams_7d, t.teams)} of teams`} />
        <Card title="Active 30d" value={t.active_teams_30d} hint={`${pct(t.active_teams_30d, t.teams)} of teams`} />
        <Card title="Signups, 30d" value={signups30} />
        <Card title="Monitors" value={t.monitors} hint={`${t.avg_monitors_per_active_team.toFixed(1)} per team with monitors`} />
        <Card title="Use heartbeats" value={t.teams_with_heartbeat} hint={`${pct(t.teams_with_heartbeat, t.teams)} of teams`} />
        <Card title="Pro teams" value={t.pro_teams} />
        <Card title="Incidents" value={report.incidents.total} hint={`${report.incidents.open} open`} />
      </div>

      <Section title="Activation funnel" note="Where new teams drop off between signing up and getting value.">
        <div className="space-y-2">
          {funnel.map((step) => (
            <div key={step.label}>
              <div className="flex justify-between text-xs text-slate-300">
                <span>{step.label}</span>
                <span className="font-mono">
                  {step.value} · {pct(step.value, t.teams)}
                </span>
              </div>
              <div className="mt-1 h-2 rounded bg-slate-800">
                <div
                  className="h-2 rounded bg-emerald-500"
                  style={{ width: `${t.teams > 0 ? (step.value / t.teams) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Signups per day, last 30 days">
        <div className="flex h-24 items-end gap-0.5">
          {report.signups_daily.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.teams}`}
              className="flex-1 rounded-t bg-emerald-500/70"
              style={{ height: `${Math.max(d.teams > 0 ? 6 : 1, (d.teams / maxSignups) * 100)}%` }}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Weekly cohorts"
        note="Teams by signup week: how many created a monitor and how many logged in during the last 14 days."
      >
        <div className="border border-border/60 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 text-muted-foreground font-mono text-[11px]">
              <tr>
                <th className="p-2">Week of</th>
                <th className="p-2">Teams</th>
                <th className="p-2">Created a monitor</th>
                <th className="p-2">Active (14d)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px]">
              {report.cohorts.length === 0 && (
                <tr>
                  <td className="p-2 text-muted-foreground" colSpan={4}>
                    No signups yet
                  </td>
                </tr>
              )}
              {report.cohorts.map((c) => (
                <tr key={c.week}>
                  <td className="p-2 text-muted-foreground">{day(c.week)}</td>
                  <td className="p-2 text-white">{c.teams}</td>
                  <td className="p-2">
                    {c.activated} <span className="text-muted-foreground">({pct(c.activated, c.teams)})</span>
                  </td>
                  <td className="p-2">
                    {c.active_14d} <span className="text-muted-foreground">({pct(c.active_14d, c.teams)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Demand signals" note="Teams pushing against the free limits are the likeliest buyers of a paid plan.">
          <div className="grid grid-cols-3 gap-3">
            <Card title="Near limit" value={report.limit_pressure.near_limit} hint="≥ 80% of monitors" />
            <Card title="At limit" value={report.limit_pressure.at_limit} />
            <Card title="Fast probes" value={report.limit_pressure.fast_interval_teams} hint="interval < 60s" />
          </div>
        </Section>

        <Section title="Monitors by type">
          <div className="space-y-1 text-xs">
            {report.monitors_by_type.length === 0 && <span className="text-muted-foreground">None yet</span>}
            {report.monitors_by_type.map((m) => (
              <div key={m.type} className="flex justify-between border-b border-border/40 py-1 font-mono">
                <span className="text-slate-300">{m.type}</span>
                <span className="text-white">{m.count}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Load and cost" note="What the servers carry right now. Watch this as users arrive.">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card title="Checks, 24h" value={report.load.checks_24h.toLocaleString()} />
          <Card
            title="Probes per second"
            value={report.load.probes_per_second.toFixed(2)}
            hint={`${report.load.probe_monitors} active monitors`}
          />
          <Card title="Database" value={formatBytes(report.load.database_bytes)} />
          <Card title="Check history" value={formatBytes(report.load.history_table_bytes)} />
        </div>
        <div className="text-xs text-muted-foreground">
          Alerts in the last 7 days: {report.alerts_7d.success} delivered, {report.alerts_7d.failed} failed.
        </div>
      </Section>

      <Section title="Latest teams" note="Names only. Emails are not shown here.">
        <div className="border border-border/60 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 text-muted-foreground font-mono text-[11px]">
              <tr>
                <th className="p-2">Team</th>
                <th className="p-2">Created</th>
                <th className="p-2">Plan</th>
                <th className="p-2">Monitors</th>
                <th className="p-2">Members</th>
                <th className="p-2">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px]">
              {report.recent_teams.map((r, i) => (
                <tr key={`${r.name}-${i}`}>
                  <td className="p-2 text-white truncate max-w-[200px]">{r.name}</td>
                  <td className="p-2 text-muted-foreground">{day(r.created_at)}</td>
                  <td className="p-2">{r.plan}</td>
                  <td className="p-2">{r.monitors}</td>
                  <td className="p-2">{r.members}</td>
                  <td className="p-2 text-muted-foreground">{day(r.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};
