import React, { useEffect, useState } from 'react';
import { MonitorWithStats } from '../types';
import { fetchMonitor } from '../api/client';
import { formatMs, timeAgo } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Clock, ShieldCheck, Copy, Check } from 'lucide-react';

interface MonitorDetailModalProps {
  monitor: MonitorWithStats | null;
  onClose: () => void;
}

export const MonitorDetailModal: React.FC<MonitorDetailModalProps> = ({
  monitor,
  onClose,
}) => {
  const [details, setDetails] = useState<MonitorWithStats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!monitor) return;
    setDetails(monitor);
    fetchMonitor(monitor.id).then(setDetails).catch(console.error);
  }, [monitor]);

  if (!monitor) return null;

  const data = details || monitor;
  const isUp = data.status === 'UP';
  const isDown = data.status === 'DOWN';

  const copyToken = () => {
    if (data.heartbeat_token) {
      const url = `https://respulse.wsl.local/api/heartbeat/${data.heartbeat_token}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={!!monitor} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-3.5 w-3.5 relative">
              {isUp && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              {isDown && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-muted-foreground'}`}></span>
            </span>
            <div>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                {data.name}
                <Badge variant="outline" className="text-xs font-mono font-normal">
                  {data.monitor_type}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs font-mono text-muted-foreground mt-0.5">
                {data.url}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Heartbeat Token snippet if Heartbeat */}
          {data.heartbeat_token && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Heartbeat Webhook URL
                </span>
                <button
                  onClick={copyToken}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <code className="block p-2 bg-background/90 rounded border font-mono text-xs text-white select-all break-all">
                curl -X POST https://respulse.wsl.local/api/heartbeat/{data.heartbeat_token}
              </code>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary/40 border border-border/80 p-3 rounded-lg text-center">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block">24h Uptime</span>
              <span className="text-lg font-bold font-mono text-emerald-400">{data.uptime_24h.toFixed(1)}%</span>
            </div>
            <div className="bg-secondary/40 border border-border/80 p-3 rounded-lg text-center">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block">7d Uptime</span>
              <span className="text-lg font-bold font-mono text-emerald-400">{data.uptime_7d.toFixed(1)}%</span>
            </div>
            <div className="bg-secondary/40 border border-border/80 p-3 rounded-lg text-center">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block">Current Latency</span>
              <span className="text-lg font-bold font-mono text-white">{formatMs(data.last_response_time_ms)}</span>
            </div>
          </div>

          {/* Latency History Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-purple-400" />
                Response Time History (ms)
              </h4>
              <span className="text-[11px] text-muted-foreground">Last {data.latency_history.length || 0} checks</span>
            </div>

            <div className="h-44 w-full bg-secondary/20 rounded-lg p-2 border border-border/60">
              {data.latency_history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.latency_history}>
                    <defs>
                      <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#6b7280" fontSize={10} tickLine={false} />
                    <YAxis stroke="#6b7280" fontSize={10} tickLine={false} unit="ms" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.375rem', fontSize: '11px' }}
                      formatter={(val: any) => [`${val} ms`, 'Response Time']}
                    />
                    <Area type="monotone" dataKey="latency" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#latencyGradient)" />
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
            <div className="border border-border/80 rounded-lg overflow-hidden">
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
      </DialogContent>
    </Dialog>
  );
};
