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
      });

      // Reset form
      setName('');
      setUrl('');
      setAuthUsername('');
      setAuthPassword('');
      setGroupName('Default');
      setTagsInput('');
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
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-muted-foreground">
              <p className="font-semibold text-emerald-400 mb-1">Push-based Monitoring (Dead Man's Switch)</p>
              A unique webhook token will be generated. Simply call it periodically from your cron job or backup worker:
              <code className="block mt-1 p-2 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300">
                curl -X POST {typeof window !== 'undefined' ? window.location.origin : 'https://respulse.online'}/api/heartbeat/&lt;TOKEN&gt;
              </code>
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

          {/* Intervals & Timeout */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Check Frequency</label>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-md px-2.5 py-1 text-xs text-foreground h-9 focus:ring-1 focus:ring-emerald-500"
              >
                <option value={10}>Every 10 seconds (Turbo)</option>
                <option value={30}>Every 30 seconds</option>
                <option value={60}>Every 1 minute</option>
                <option value={300}>Every 5 minutes</option>
                <option value={600}>Every 10 minutes</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 block">Timeout (seconds)</label>
              <Input
                type="number"
                min="1"
                max="60"
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
