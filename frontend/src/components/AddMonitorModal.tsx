import React, { useState } from 'react';
import { CreateMonitorPayload, MonitorType } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Activity, ShieldCheck, Server, Heart, Code2 } from 'lucide-react';

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
      });

      // Reset form
      setName('');
      setUrl('');
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
      <DialogContent className="sm:max-w-[560px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">Create New Monitor</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure target endpoint, check frequency, and protocol parameters.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs rounded-md bg-destructive/15 border border-destructive/30 text-destructive">
              {error}
            </div>
          )}

          {/* Type Selector Tabs */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Monitor Type</label>
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
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-border/80 bg-background/50 hover:bg-background text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icon className={`h-3.5 w-3.5 ${isSelected ? 'text-emerald-400' : ''}`} />
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Friendly Name</label>
              <Input
                placeholder="e.g. Production API"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
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
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          {/* Conditional Options */}
          {(monitorType === 'HTTP' || monitorType === 'KEYWORD') && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-secondary/20 p-3 rounded-lg border border-border/50">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">HTTP Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground h-8 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="HEAD">HEAD</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Expected Status</label>
                <Input
                  placeholder="200"
                  value={expectedStatus}
                  onChange={(e) => setExpectedStatus(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {monitorType === 'KEYWORD' && (
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Keyword to find</label>
                  <Input
                    placeholder="e.g. success"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    required
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {(monitorType === 'PORT' || monitorType === 'SSL') && (
            <div className="grid grid-cols-2 gap-3 bg-secondary/20 p-3 rounded-lg border border-border/50">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Port Number</label>
                <Input
                  type="number"
                  placeholder={monitorType === 'SSL' ? '443' : '5432'}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="h-8 text-xs font-mono"
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
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-muted-foreground">
              <p className="font-semibold text-emerald-400 mb-1">Push-based Monitoring (Dead Man's Switch)</p>
              A unique webhook token will be generated. Simply call it periodically from your cron job or backup worker:
              <code className="block mt-1 p-1.5 bg-background/80 rounded border font-mono text-[11px] text-white">
                curl -X POST https://respulse.wsl.local/api/heartbeat/&lt;TOKEN&gt;
              </code>
            </div>
          )}

          {/* Intervals & Timeout */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Check Frequency</label>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground h-9 focus:ring-1 focus:ring-emerald-500"
              >
                <option value={10}>Every 10 seconds (Turbo)</option>
                <option value={30}>Every 30 seconds</option>
                <option value={60}>Every 1 minute</option>
                <option value={300}>Every 5 minutes</option>
                <option value={600}>Every 10 minutes</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Timeout (seconds)</label>
              <Input
                type="number"
                min="1"
                max="60"
                value={timeout}
                onChange={(e) => setTimeout(Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {loading ? 'Creating...' : 'Start Monitoring'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
