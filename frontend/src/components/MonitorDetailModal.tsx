import React, { useEffect, useState } from 'react';
import { MonitorWithStats } from '../types';
import { fetchMonitor } from '../api/client';
import { formatMs, timeAgo } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Clock, ShieldCheck, Copy, Check, Terminal, Play, AlertTriangle, Pencil } from 'lucide-react';
import { SshConsolePanel } from './SshConsolePanel';
import { isTauri } from '../lib/sshClient';

interface MonitorDetailModalProps {
  monitor: MonitorWithStats | null;
  onClose: () => void;
  onEdit?: (monitor: MonitorWithStats) => void;
  isViewer?: boolean;
}

export const MonitorDetailModal: React.FC<MonitorDetailModalProps> = ({
  monitor,
  onClose,
  onEdit,
  isViewer = false,
}) => {
  const [details, setDetails] = useState<MonitorWithStats | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metrics' | 'ssh'>('metrics');
  // Credentials stay on the device, so the console exists only in the native apps.
  const sshAvailable = isTauri();

  useEffect(() => {
    if (!monitor) return;
    setDetails(monitor);
    setActiveTab('metrics');
    fetchMonitor(monitor.id).then(setDetails).catch(console.error);
  }, [monitor]);

  if (!monitor) return null;

  const data = details || monitor;
  const isUp = data.status === 'UP';
  const isDown = data.status === 'DOWN';

  const publicBase =
    typeof window !== 'undefined' &&
    !window.location.origin.includes('localhost') &&
    !window.location.origin.includes('tauri')
      ? window.location.origin
      : 'https://respulse.online';

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const heartbeatBase = data.heartbeat_token ? `${publicBase}/api/heartbeat/${data.heartbeat_token}` : '';

  return (
    <Dialog open={!!monitor} onOpenChange={onClose}>
      <DialogContent className="grid-cols-[minmax(0,1fr)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-[700px]bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl shadow-black/90 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 top-[52%] sm:top-[50%]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative">
                {isUp && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                {isDown && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${isUp ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : isDown ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-muted-foreground'}`}></span>
              </span>
              <div>
                <DialogTitle className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
                  {data.name}
                  <Badge variant="outline" className="text-xs font-mono font-normal">
                    {data.monitor_type}
                  </Badge>
                  {data.cron_expression && (
                    <Badge variant="secondary" className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/50">
                      cron: {data.cron_expression} ({data.timezone || 'UTC'})
                    </Badge>
                  )}
                  {data.grace_seconds !== undefined && data.grace_seconds > 0 && (
                    <Badge variant="secondary" className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/50">
                      +{data.grace_seconds}s grace
                    </Badge>
                  )}
                  {data.slug && (
                    <Badge variant="outline" className="text-[10px] font-mono text-purple-300 bg-purple-950/40 border border-purple-800/50">
                      /{data.slug}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs font-mono text-muted-foreground mt-0.5">
                  {data.url}
                </DialogDescription>
              </div>
            </div>

            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                disabled={isViewer}
                onClick={() => {
                  onClose();
                  onEdit(data);
                }}
                className="h-8 px-2.5 text-xs gap-1.5 border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white flex-shrink-0"
                title={isViewer ? 'Read-only access: requires Engineer role or higher to edit' : 'Edit monitor parameters'}
              >
                <Pencil className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Edit Parameters</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Tab Navigation: Metrics & Logs vs SSH SRE Triage */}
        <div className="flex border-b border-slate-800 gap-2 sm:gap-4 text-xs font-medium pt-1 overflow-x-auto no-scrollbar whitespace-nowrap">
          <button
            type="button"
            onClick={() => setActiveTab('metrics')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 -mb-px font-mono shrink-0 ${
              activeTab === 'metrics'
                ? 'border-emerald-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>
              <span className="sm:hidden">Metrics & Logs</span>
              <span className="hidden sm:inline">Metrics & Probing Logs</span>
            </span>
          </button>

          {sshAvailable && (
          <button
            type="button"
            onClick={() => setActiveTab('ssh')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 -mb-px font-mono shrink-0 ${
              activeTab === 'ssh'
                ? 'border-cyan-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span>
              <span className="sm:hidden">SSH Console</span>
              <span className="hidden sm:inline">SSH SRE Console</span>
            </span>
            {isDown && (
              <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse font-bold">
                INCIDENT TRIAGE
              </span>
            )}
          </button>
          )}
        </div>

        {sshAvailable && activeTab === 'ssh' ? (
          <div className="pt-2">
            <SshConsolePanel monitor={data} />
          </div>
        ) : (
          <div className="space-y-6 pt-2">
          {/* Heartbeat Signals & Webhooks (Healthchecks.io compatible) */}
          {data.heartbeat_token && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Heartbeat Signal Endpoints
                </span>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/80">
                  Healthchecks.io compatible
                </span>
              </div>

              {/* Signals Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                {/* 1. Success */}
                <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-emerald-400 block text-[10px] uppercase font-bold tracking-wider">Success (UP)</span>
                    <span className="text-slate-300 truncate block text-[10px]">{heartbeatBase}</span>
                  </div>
                  <button
                    onClick={() => copyText(`curl -fsS -m 10 ${heartbeatBase}`, 'success')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex-shrink-0"
                    title="Copy curl command"
                  >
                    {copiedKey === 'success' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* 2. Start (Duration) */}
                <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-cyan-400 block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <Play className="h-2.5 w-2.5" /> Start Timer
                    </span>
                    <span className="text-slate-300 truncate block text-[10px]">{heartbeatBase}/start</span>
                  </div>
                  <button
                    onClick={() => copyText(`curl -fsS -m 10 ${heartbeatBase}/start`, 'start')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex-shrink-0"
                    title="Copy start signal"
                  >
                    {copiedKey === 'start' ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* 3. Fail Signal */}
                <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-red-400 block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" /> Fail (DOWN)
                    </span>
                    <span className="text-slate-300 truncate block text-[10px]">{heartbeatBase}/fail</span>
                  </div>
                  <button
                    onClick={() => copyText(`curl -fsS -m 10 -d "Error details" ${heartbeatBase}/fail`, 'fail')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex-shrink-0"
                    title="Copy fail signal"
                  >
                    {copiedKey === 'fail' ? <Check className="h-3.5 w-3.5 text-red-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* 4. Exit Code */}
                <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-amber-400 block text-[10px] uppercase font-bold tracking-wider">Exit Code ($?)</span>
                    <span className="text-slate-300 truncate block text-[10px]">{heartbeatBase}/$?</span>
                  </div>
                  <button
                    onClick={() => copyText(`curl -fsS -m 10 --data-binary @output.log ${heartbeatBase}/$?`, 'code')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex-shrink-0"
                    title="Copy exit code with log pipe snippet"
                  >
                    {copiedKey === 'code' ? <Check className="h-3.5 w-3.5 text-amber-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Human-Readable Slug Ping Endpoint */}
              {data.slug && (
                <div className="p-2.5 bg-slate-950/90 rounded-lg border border-cyan-500/30 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-cyan-400 block text-[10px] uppercase font-bold tracking-wider">
                      Human-Readable Slug Endpoint
                    </span>
                    <span className="text-slate-200 truncate block text-[10px] font-mono">
                      {origin}/api/ping/&lt;PING_KEY&gt;/{data.slug}
                    </span>
                  </div>
                  <button
                    onClick={() => copyText(`curl -fsS -m 10 ${origin}/api/ping/<PING_KEY>/${data.slug}`, 'slug_url')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex-shrink-0"
                    title="Copy slug URL"
                  >
                    {copiedKey === 'slug_url' ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Next Expected Cron Ping Banner */}
          {data.next_expected_at && (
            <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                Next Expected Cron Ping:
              </span>
              <span className="text-emerald-400 font-semibold">
                {new Date(data.next_expected_at).toLocaleString()}
              </span>
            </div>
          )}

          {/* Captured Payload / Execution Output Logs */}
          {data.last_payload && (
            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 font-mono">
                  <Terminal className="h-3.5 w-3.5" />
                  Captured Execution Output / STDERR
                </span>
                <button
                  onClick={() => copyText(data.last_payload || '', 'payload')}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white font-mono"
                >
                  {copiedKey === 'payload' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedKey === 'payload' ? 'Copied!' : 'Copy Output'}
                </button>
              </div>
              <pre className="p-2.5 bg-black/60 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-48 whitespace-pre-wrap select-all">
                {data.last_payload}
              </pre>
            </div>
          )}

          {/* Public SVG Status Badge */}
          <div className="bg-slate-950/80 border border-slate-800 p-3 sm:p-3.5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5 font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Live Status Badge (SVG)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
                Embeddable in GitHub READMEs &amp; Dashboards
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 bg-black/40 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0 max-w-full">
                <img
                  src={`${publicBase}/api/badge/${data.heartbeat_token || data.id}.svg`}
                  alt={`${data.name} Status Badge`}
                  className="h-5 flex-shrink-0"
                />
                <span className="text-[10px] font-mono text-slate-400 truncate">
                  {`${publicBase}/api/badge/${data.heartbeat_token || data.id}.svg`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
                <button
                  onClick={() => copyText(`![${data.name}](${publicBase}/api/badge/${data.heartbeat_token || data.id}.svg)`, 'badge_md')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-200 hover:text-white flex items-center gap-1 transition"
                  title="Copy Markdown embed snippet"
                >
                  {copiedKey === 'badge_md' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedKey === 'badge_md' ? 'Copied MD' : 'Copy MD'}
                </button>
                <button
                  onClick={() => copyText(`${publicBase}/api/badge/${data.heartbeat_token || data.id}.svg`, 'badge_url')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 transition"
                  title="Copy direct SVG URL"
                >
                  {copiedKey === 'badge_url' ? <Check className="h-3 w-3 text-cyan-400" /> : <Copy className="h-3 w-3" />}
                  {copiedKey === 'badge_url' ? 'Copied' : 'URL'}
                </button>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-slate-950/60 border border-slate-800/80 p-2 sm:p-3 rounded-xl text-center shadow-inner">
              <span className="text-[9px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium block truncate">24h Uptime</span>
              <span className="text-sm sm:text-lg font-bold font-mono text-emerald-400">{data.uptime_24h.toFixed(1)}%</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-2 sm:p-3 rounded-xl text-center shadow-inner">
              <span className="text-[9px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium block truncate">7d Uptime</span>
              <span className="text-sm sm:text-lg font-bold font-mono text-emerald-400">{data.uptime_7d.toFixed(1)}%</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-2 sm:p-3 rounded-xl text-center shadow-inner">
              <span className="text-[9px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium block truncate">Latency</span>
              <span className="text-sm sm:text-lg font-bold font-mono text-white truncate block">{formatMs(data.last_response_time_ms)}</span>
            </div>
          </div>

          {/* Latency History Chart with Brand Neon Glow */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-purple-400" />
                Response Time History (ms)
              </h4>
              <span className="text-[11px] text-muted-foreground">Last {data.latency_history.length || 0} checks</span>
            </div>

            <div className="relative h-48 w-full bg-slate-950/70 rounded-xl p-3 border border-slate-800 shadow-[0_0_30px_rgba(16,185,129,0.08)] overflow-hidden">
              {/* Ambient Glow Aura */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-72 h-24 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

              {data.latency_history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.latency_history}>
                    <defs>
                      <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.65} />
                        <stop offset="60%" stopColor="#06b6d4" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#6b7280" fontSize={10} tickLine={false} />
                    <YAxis stroke="#6b7280" fontSize={10} tickLine={false} unit="ms" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '0.5rem',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(16, 185, 129, 0.2)',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                      formatter={(val: any) => [`${val} ms`, 'Response Time']}
                    />
                    <Area
                      type="monotone"
                      dataKey="latency"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#latencyGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Awaiting sufficient latency samples...
                </div>
              )}
            </div>
          </div>

          {/* Recent Check Logs */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
              Recent Probing Logs
            </h4>
            <div className="border border-border/80 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 text-muted-foreground border-b border-border/80 font-mono text-[11px]">
                  <tr>
                    <th className="p-2.5">Time</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">HTTP Code</th>
                    <th className="p-2.5">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.recent_history.length > 0 ? (
                    data.recent_history.slice(-10).reverse().map((item, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="p-2.5 text-muted-foreground font-mono">
                          {item.timestamp ? timeAgo(item.timestamp) : '—'}
                        </td>
                        <td className="p-2.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            item.is_up ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {item.is_up ? 'OPERATIONAL' : 'DOWN'}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-white">
                          {item.status_code || '—'}
                        </td>
                        <td className="p-2.5 font-mono text-emerald-400">
                          {formatMs(item.response_time_ms)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-muted-foreground">
                        No check history recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
