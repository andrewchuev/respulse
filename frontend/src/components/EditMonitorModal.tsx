import React, { useState, useEffect } from 'react';
import { Monitor, MonitorWithStats, MonitorType, UpdateMonitorPayload } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Activity, ShieldCheck, Server, Heart, Code2, Lock, ChevronDown, ChevronUp, Copy, Check, Pencil } from 'lucide-react';
import { updateMonitor } from '../api/client';

interface EditMonitorModalProps {
  monitor: MonitorWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updated: Monitor) => void;
}

export const EditMonitorModal: React.FC<EditMonitorModalProps> = ({
  monitor,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
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
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (monitor) {
      setName(monitor.name || '');
      setUrl(monitor.url || '');
      setInterval(monitor.interval_seconds || 60);
      setTimeout(monitor.timeout_seconds || 10);
      setMethod(monitor.method || 'GET');
      setExpectedStatus(monitor.expected_status_code !== null && monitor.expected_status_code !== undefined ? String(monitor.expected_status_code) : '200');
      setKeyword(monitor.keyword || '');
      setPort(monitor.port !== null && monitor.port !== undefined ? String(monitor.port) : (monitor.monitor_type === 'SSL' ? '443' : '5432'));
      setAuthUsername(monitor.auth_username || '');
      setAuthPassword(monitor.auth_password || '');
      setGroupName(monitor.group_name || 'Default');
      setTagsInput(monitor.tags && monitor.tags.length > 0 ? monitor.tags.join(', ') : '');
      setGraceSeconds(monitor.grace_seconds !== undefined ? monitor.grace_seconds : 300);
      setSlug(monitor.slug || '');
      setScheduleType(monitor.cron_expression ? 'CRON' : 'INTERVAL');
      setCronExpression(monitor.cron_expression || '0 3 * * *');
      setTimezone(monitor.timezone || 'UTC');
      setShowAuth(Boolean(monitor.auth_username || monitor.auth_password));
      setError(null);
    }
  }, [monitor]);

  if (!monitor) return null;

  const monitorType: MonitorType = monitor.monitor_type;

  const getTypeMeta = () => {
    switch (monitorType) {
      case 'SSL':
        return { label: 'TLS / SSL Expiry', icon: ShieldCheck, color: 'text-amber-400', badgeClass: 'border-amber-500/30 text-amber-300 bg-amber-500/10' };
      case 'PORT':
        return { label: 'TCP Socket Port', icon: Server, color: 'text-blue-400', badgeClass: 'border-blue-500/30 text-blue-300 bg-blue-500/10' };
      case 'HEARTBEAT':
        return { label: 'Heartbeat (Dead Man Switch)', icon: Heart, color: 'text-rose-400', badgeClass: 'border-rose-500/30 text-rose-300 bg-rose-500/10' };
      case 'KEYWORD':
        return { label: 'Keyword Search', icon: Code2, color: 'text-purple-400', badgeClass: 'border-purple-500/30 text-purple-300 bg-purple-500/10' };
      default:
        return { label: 'HTTP / REST API', icon: Activity, color: 'text-emerald-400', badgeClass: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' };
    }
  };

  const meta = getTypeMeta();
  const Icon = meta.icon;

  const handleCopyId = () => {
    if (!monitor) return;
    navigator.clipboard.writeText(monitor.id);
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Friendly name is required');
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
      const payload: UpdateMonitorPayload = {
        name: name.trim(),
        url: monitorType === 'HEARTBEAT' && !url.trim() ? (monitor.url || 'heartbeat://push') : url.trim(),
        interval_seconds: Number(interval),
        timeout_seconds: Number(timeout),
        method: monitorType === 'HTTP' || monitorType === 'KEYWORD' ? method : 'GET',
        expected_status_code: expectedStatus ? parseInt(expectedStatus, 10) : undefined,
        keyword: monitorType === 'KEYWORD' ? (keyword.trim() || undefined) : undefined,
        port: (monitorType === 'PORT' || monitorType === 'SSL') && port ? parseInt(port, 10) : undefined,
        auth_username: authUsername.trim() || '',
        auth_password: authPassword || '',
        tags,
        group_name: groupName.trim() || 'Default',
        grace_seconds: monitorType === 'HEARTBEAT' ? Number(graceSeconds) : 0,
        slug: monitorType === 'HEARTBEAT' ? (slug.trim() ? slug.trim().toLowerCase().replace(' ', '-') : '') : undefined,
        cron_expression: monitorType === 'HEARTBEAT' ? (scheduleType === 'CRON' ? cronExpression.trim() : '') : undefined,
        timezone: monitorType === 'HEARTBEAT' && scheduleType === 'CRON' ? timezone : 'UTC',
      };

      const updated = await updateMonitor(monitor.id, payload);
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update monitor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl shadow-black/90 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <Pencil className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
                  Edit Monitor Parameters
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Update endpoint, polling frequency, thresholds, and routing tags.
                </DialogDescription>
              </div>
            </div>

            <Badge variant="outline" className={`text-xs font-mono font-medium flex items-center gap-1.5 px-2.5 py-1 ${meta.badgeClass}`}>
              <Icon className="h-3.5 w-3.5" />
              <span>{meta.label}</span>
            </Badge>
          </div>
        </DialogHeader>

        {/* Monitor Metadata Info Bar */}
        <div className="flex items-center justify-between bg-slate-950/70 border border-slate-800/80 rounded-lg px-3 py-1.5 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <span className="text-muted-foreground uppercase font-bold text-[10px]">ID:</span>
            <span className="text-slate-300 truncate">{monitor.id}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyId}
            className="flex items-center gap-1 hover:text-white transition-colors text-[10px] ml-2 flex-shrink-0"
            title="Copy Monitor UUID"
          >
            {copiedId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copiedId ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-destructive/15 border border-destructive/30 text-destructive flex items-center gap-2 animate-in fade-in-0 duration-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

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

          {/* Conditional Options: HTTP / KEYWORD */}
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
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conditional Options: PORT / SSL */}
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

          {/* Conditional Options: HEARTBEAT */}
          {monitorType === 'HEARTBEAT' && (
            <div className="space-y-3">
              {/* Slug Input */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <label className="text-xs font-medium text-slate-300 mb-1 block">
                  Human-Readable Slug
                </label>
                <Input
                  placeholder="e.g. database-nightly-backup"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="h-9 text-xs font-mono bg-slate-900 border-slate-700/80 focus:border-emerald-500"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Enables clean URLs: <code className="text-emerald-400 font-mono">/api/ping/&lt;KEY&gt;/{slug || 'my-task'}</code>
                </p>
              </div>

              {/* Schedule Mode (Interval vs Cron) */}
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
                          Cron Pattern (5 fields)
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

          {/* Frequency & Grace Period */}
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="border-slate-700 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-[0_0_15px_rgba(16,185,129,0.3)] gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              {loading ? 'Saving...' : 'Save Parameters'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
