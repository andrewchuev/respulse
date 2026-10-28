import React, { useState } from 'react';
import { CreateMonitorPayload, MonitorType } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Activity, ShieldCheck, Server, Heart, Code2, Lock, ChevronDown, ChevronUp } from 'lucide-react';

interface AddMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateMonitorPayload) => Promise<void>;
}

export const AddMonitorModal: React.FC<AddMonitorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [monitorType, setMonitorType] = useState<MonitorType>('HTTP');
  const [interval, setInterval] = useState<number>(60);
  const [timeout, setTimeout] = useState<number>(10);
  const [method, setMethod] = useState<string>('GET');
  const [expectedStatus, setExpectedStatus] = useState<string>('200');
  const [keyword, setKeyword] = useState<string>('');
  const [port, setPort] = useState<string>('80');
  const [authUsername, setAuthUsername] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [groupName, setGroupName] = useState<string>('Default');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [graceSeconds, setGraceSeconds] = useState<number>(300);
  const [slug, setSlug] = useState<string>('');
  const [scheduleType, setScheduleType] = useState<'INTERVAL' | 'CRON'>('INTERVAL');
  const [cronExpression, setCronExpression] = useState<string>('0 3 * * *');
  const [timezone, setTimezone] = useState<string>('UTC');
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Monitor name is required');
      return;
    }
    if (!url.trim() && monitorType !== 'HEARTBEAT') {
      setError('Target URL or Host is required');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase().replace('#', ''))
      .filter(Boolean);

    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        url: monitorType === 'HEARTBEAT' && !url.trim() ? 'heartbeat://push' : url.trim(),
        monitor_type: monitorType,
        interval_seconds: Number(interval),
        timeout_seconds: Number(timeout),
        method: monitorType === 'HTTP' || monitorType === 'KEYWORD' ? method : 'GET',
        expected_status_code: expectedStatus ? parseInt(expectedStatus, 10) : undefined,
        keyword: keyword.trim() || undefined,
        port: port ? parseInt(port, 10) : undefined,
        auth_username: authUsername.trim() || undefined,
        auth_password: authPassword || undefined,
        tags,
        group_name: groupName.trim() || 'Default',
        grace_seconds: monitorType === 'HEARTBEAT' ? Number(graceSeconds) : 0,
        slug: monitorType === 'HEARTBEAT' && slug.trim() ? slug.trim().toLowerCase().replace(' ', '-') : undefined,
        cron_expression: monitorType === 'HEARTBEAT' && scheduleType === 'CRON' ? cronExpression.trim() : undefined,
        timezone: monitorType === 'HEARTBEAT' && scheduleType === 'CRON' ? timezone : 'UTC',
      });

      // Reset form
      setName('');
      setUrl('');
      setAuthUsername('');
      setAuthPassword('');
      setGroupName('Default');
      setTagsInput('');
      setSlug('');
      setScheduleType('INTERVAL');
      setCronExpression('0 3 * * *');
      setTimezone('UTC');
      setShowAuth(false);
      setMonitorType('HTTP');
      setInterval(60);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create monitor');
    } finally {
      setLoading(false);
    }
  };

  const types: { id: MonitorType; label: string; icon: any; desc: string }[] = [
    { id: 'HTTP', label: 'HTTP(S)', icon: Activity, desc: 'Websites & REST APIs' },
    { id: 'KEYWORD', label: 'Keyword', icon: Code2, desc: 'Search for text in HTML/JSON' },
    { id: 'PORT', label: 'TCP Port', icon: Server, desc: 'Databases & socket ports' },
    { id: 'SSL', label: 'SSL Cert', icon: ShieldCheck, desc: 'Certificate expiration' },
    { id: 'HEARTBEAT', label: 'Heartbeat', icon: Heart, desc: "Cron & worker dead man's switch" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[580px] bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl shadow-black/90">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-white">Create New Monitor</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Configure target endpoint, check frequency, and protocol parameters.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-destructive/15 border border-destructive/30 text-destructive flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Monitor Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {types.map((t) => {
                const Icon = t.icon;
                const isSelected = monitorType === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => {
                      setMonitorType(t.id);
                      if (t.id === 'PORT') setPort('5432');
                      if (t.id === 'SSL') setPort('443');
                    }}
                    className={`relative flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-400 bg-gradient-to-br from-emerald-500/30 via-emerald-950/50 to-slate-900/90 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/60'
                        : 'border-slate-800 bg-slate-950/70 hover:bg-slate-900/90 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,1)]"></span>
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icon className={`h-3.5 w-3.5 ${isSelected ? 'text-emerald-300' : ''}`} />
                      <span>{t.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name & Target */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Friendly Name</label>
              <Input
                placeholder="e.g. Production API"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-9 text-xs bg-slate-950/80 border-slate-700/80 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">
                {monitorType === 'PORT' || monitorType === 'SSL' ? 'Host / IP' : 'Target URL'}
              </label>
              <Input
                placeholder={
                  monitorType === 'PORT' || monitorType === 'SSL'
                    ? 'api.example.com'
                    : monitorType === 'HEARTBEAT'
                    ? 'Optional notes / identifier'
                    : 'https://api.example.com/health'
                }
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required={monitorType !== 'HEARTBEAT'}
                className="h-9 text-xs font-mono bg-slate-950/80 border-slate-700/80 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Conditional Options */}
          {(monitorType === 'HTTP' || monitorType === 'KEYWORD') && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 shadow-inner">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1 block">HTTP Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1 text-xs text-foreground h-8 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="HEAD">HEAD</option>
                    <option value="PUT">PUT</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 mb-1 block">Expected Status</label>
                  <Input
                    placeholder="200"
                    value={expectedStatus}
                    onChange={(e) => setExpectedStatus(e.target.value)}
                    className="h-8 text-xs font-mono bg-slate-900 border-slate-700/80 focus:border-emerald-500"
                  />
                </div>

                {monitorType === 'KEYWORD' && (
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[11px] font-medium text-slate-400 mb-1 block">Keyword to find</label>
                    <Input
                      placeholder="e.g. success"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      required
                      className="h-8 text-xs bg-slate-900 border-slate-700/80 focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Basic Auth Section Toggle */}
              <div className="border border-slate-800/80 rounded-xl p-3 bg-slate-950/40 shadow-inner">
                <button
                  type="button"
                  onClick={() => setShowAuth(!showAuth)}
                  className="flex items-center justify-between w-full text-xs font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                    HTTP Basic Authentication {authUsername ? '(Configured)' : '(Optional)'}
                  </span>
                  {showAuth ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showAuth && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800/80">
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 mb-1 block">Username</label>
                      <Input
                        placeholder="admin"
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        className="h-8 text-xs font-mono bg-slate-900 border-slate-700/80 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 mb-1 block">Password</label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="h-8 text-xs font-mono bg-slate-900 border-slate-700/80 focus:border-emerald-500"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground col-span-1 sm:col-span-2">
                      Credentials are automatically passed via the standard Authorization header. You can also specify credentials directly in the URL: <code className="text-emerald-400">https://user:pass@example.com</code>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(monitorType === 'PORT' || monitorType === 'SSL') && (
            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 shadow-inner">
              <div>
                <label className="text-[11px] font-medium text-slate-400 mb-1 block">Port Number</label>
                <Input
                  type="number"
                  placeholder={monitorType === 'SSL' ? '443' : '5432'}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="h-8 text-xs font-mono bg-slate-900 border-slate-700/80 focus:border-emerald-500"
                />
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center">
                {monitorType === 'SSL'
                  ? 'Verifies TLS handshake & warns before expiration.'
                  : 'Tests raw TCP socket connection.'}
              </div>
            </div>
          )}

          {monitorType === 'HEARTBEAT' && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-emerald-400">Push-based Monitoring (Dead Man's Switch)</p>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                  Healthchecks.io compatible
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                A unique webhook token will be generated. You can signal success, duration (<code className="text-emerald-300 font-mono">/start</code>), error exits (<code className="text-emerald-300 font-mono">/$?</code>), and pipe logs:
              </p>
              <div className="space-y-1 font-mono text-[11px] bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                <div className="text-muted-foreground text-[10px] pb-0.5">// 1. Standard success ping:</div>
                <div className="text-emerald-300 truncate">curl -fsS -m 10 {typeof window !== 'undefined' ? window.location.origin : 'https://respulse.online'}/api/heartbeat/&lt;TOKEN&gt;</div>
                <div className="text-muted-foreground text-[10px] pt-1 pb-0.5">// 2. Duration tracking with exit code:</div>
                <div className="text-cyan-300 truncate">curl -fsS -m 10 .../api/heartbeat/&lt;TOKEN&gt;/start &amp;&amp; ./job.sh</div>
                <div className="text-cyan-300 truncate">curl -fsS -m 10 .../api/heartbeat/&lt;TOKEN&gt;/$?</div>
                <div className="text-muted-foreground text-[10px] pt-1 pb-0.5">// 3. Pipe output &amp; STDERR logs on failure:</div>
                <div className="text-amber-300 truncate">curl -fsS -m 10 --data-binary @job.log .../api/heartbeat/&lt;TOKEN&gt;/$?</div>
                <div className="text-muted-foreground text-[10px] pt-1 pb-0.5">// 4. Auto-provisioning by slug:</div>
                <div className="text-emerald-400 truncate">curl -fsS -m 10 .../api/ping/&lt;PING_KEY&gt;/backup-task?create=1</div>
              </div>
            </div>
          )}

          {/* Slug Input for Heartbeat */}
          {monitorType === 'HEARTBEAT' && (
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              <label className="text-xs font-medium text-slate-300 mb-1 block">
                Human-Readable Slug (Optional)
              </label>
              <Input
                placeholder="e.g. database-nightly-backup"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="h-9 text-xs font-mono bg-slate-900 border-slate-700/80 focus:border-emerald-500"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Enables clean URLs: <code className="text-emerald-400 font-mono">/api/ping/&lt;KEY&gt;/{slug || 'my-task'}</code> and auto-provisioning with <code className="text-emerald-400 font-mono">?create=1</code>.
              </p>
            </div>
          )}

          {/* Schedule Mode (Interval vs Cron) for Heartbeat */}
          {monitorType === 'HEARTBEAT' && (
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Schedule Type</label>
                <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setScheduleType('INTERVAL')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                      scheduleType === 'INTERVAL'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-white'
                    }`}
                  >
                    Simple Interval
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('CRON')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                      scheduleType === 'CRON'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-white'
                    }`}
                  >
                    Cron Pattern
                  </button>
                </div>
              </div>

              {scheduleType === 'CRON' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 mb-1 block">
                        Cron Pattern (min hour dom month dow)
                      </label>
                      <Input
                        placeholder="0 3 * * 1-5"
                        value={cronExpression}
                        onChange={(e) => setCronExpression(e.target.value)}
                        className="h-8 text-xs font-mono bg-slate-900 border-slate-700/80 focus:border-emerald-500"
                        required={scheduleType === 'CRON'}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 mb-1 block">
                        Timezone
                      </label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-md px-2.5 py-1 text-xs text-foreground h-8 focus:ring-1 focus:ring-emerald-500 font-mono"
                      >
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                        <option value="Europe/Kyiv">Europe/Kyiv (UTC+2 / UTC+3)</option>
                        <option value="Europe/Berlin">Europe/Berlin (UTC+1 / UTC+2)</option>
                        <option value="Europe/London">Europe/London (GMT / BST)</option>
                        <option value="America/New_York">America/New_York (EST / EDT)</option>
                        <option value="America/Chicago">America/Chicago (CST / CDT)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST / PDT)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      </select>
                    </div>
                  </div>
                  {/* Cron Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono">Presets:</span>
                    {[
                      { label: 'Every 5m', expr: '*/5 * * * *' },
                      { label: 'Hourly', expr: '0 * * * *' },
                      { label: 'Daily (3 AM)', expr: '0 3 * * *' },
                      { label: 'Weekdays (9 AM)', expr: '0 9 * * 1-5' },
                      { label: 'Weekly (Sun)', expr: '0 0 * * 0' },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setCronExpression(p.expr)}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Folder / Group & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 shadow-inner">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Folder / Group</label>
              <Input
                placeholder="e.g. Websites, Core APIs, Infrastructure"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="h-9 text-xs bg-slate-900 border-slate-700/80 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Tags (comma-separated)</label>
              <Input
                placeholder="prod, api, critical"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="h-9 text-xs font-mono bg-slate-900 border-slate-700/80 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Intervals, Grace & Timeout */}
          <div className={`grid ${monitorType === 'HEARTBEAT' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'} gap-3`}>
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">
                {monitorType === 'HEARTBEAT' ? 'Expected Period' : 'Check Frequency'}
              </label>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-2.5 py-1 text-xs text-foreground h-9 focus:ring-1 focus:ring-emerald-500"
              >
                {monitorType === 'HEARTBEAT' ? (
                  <>
                    <option value={60}>Every 1 minute</option>
                    <option value={300}>Every 5 minutes</option>
                    <option value={900}>Every 15 minutes</option>
                    <option value={1800}>Every 30 minutes</option>
                    <option value={3600}>Every 1 hour</option>
                    <option value={21600}>Every 6 hours</option>
                    <option value={43200}>Every 12 hours</option>
                    <option value={86400}>Every 24 hours (Daily)</option>
                    <option value={604800}>Every 7 days (Weekly)</option>
                  </>
                ) : (
                  <>
                    <option value={10}>⚡ Every 10 seconds (Turbo Pro)</option>
                    <option value={30}>⚡ Every 30 seconds (Pro)</option>
                    <option value={60}>Every 1 minute (Standard)</option>
                    <option value={300}>Every 5 minutes</option>
                    <option value={600}>Every 10 minutes</option>
                  </>
                )}
              </select>
            </div>

            {monitorType === 'HEARTBEAT' && (
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">
                  Grace Time (Buffer)
                </label>
                <select
                  value={graceSeconds}
                  onChange={(e) => setGraceSeconds(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-2.5 py-1 text-xs text-foreground h-9 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value={0}>0s (Strict / No grace)</option>
                  <option value={60}>1 minute (60s)</option>
                  <option value={300}>5 minutes (300s)</option>
                  <option value={900}>15 minutes (900s)</option>
                  <option value={1800}>30 minutes (1800s)</option>
                  <option value={3600}>1 hour (3600s)</option>
                  <option value={7200}>2 hours (7200s)</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">
                {monitorType === 'HEARTBEAT' ? 'Job Timeout (sec)' : 'Probe Timeout (sec)'}
              </label>
              <Input
                type="number"
                min="1"
                max="86400"
                value={timeout}
                onChange={(e) => setTimeout(Number(e.target.value))}
                className="h-9 text-xs bg-slate-950 border-slate-700/80 focus:border-emerald-500"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading} className="border-slate-700 hover:bg-slate-800">
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              {loading ? 'Creating...' : 'Start Monitoring'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
