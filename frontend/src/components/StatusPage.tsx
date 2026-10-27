import React, { useEffect, useState } from 'react';
import { PublicStatusPage as StatusPageType } from '../types';
import { fetchStatusPage } from '../api/client';
import { formatMs, timeAgo } from '../lib/utils';
import { CheckCircle2, AlertTriangle, Shield, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface StatusPageProps {
  onBack: () => void;
}

export const StatusPage: React.FC<StatusPageProps> = ({ onBack }) => {
  const [data, setData] = useState<StatusPageType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatusPage()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const allOperational = data?.all_systems_operational ?? true;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-white gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <span className="text-xs text-muted-foreground font-mono">
          Updated {new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Main Status Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium mb-2">
          <Shield className="h-3.5 w-3.5" />
          ResPulse Live Status
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{data?.title || 'System Status'}</h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          {data?.description || 'Real-time performance and availability metrics across our platform.'}
        </p>
      </div>

      {/* Operational Banner */}
      <div
        className={`p-6 rounded-2xl border flex items-center justify-between gap-4 shadow-lg ${
          allOperational
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
            : 'bg-red-950/25 border-red-500/30 text-red-300'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center ${
              allOperational ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400 animate-pulse'
            }`}
          >
            {allOperational ? <CheckCircle2 className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {allOperational ? 'All Systems Fully Operational' : 'Experiencing Service Disruptions'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allOperational
                ? 'All web endpoints, APIs, databases, and microservices are operating normally.'
                : 'Our engineers are investigating issues with affected services.'}
            </p>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <div className="text-2xl font-bold font-mono text-emerald-400">99.98%</div>
          <div className="text-[11px] text-muted-foreground">90-day uptime</div>
        </div>
      </div>

      {/* Active Incidents */}
      {data?.active_incidents && data.active_incidents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Active Incidents
          </h3>
          {data.active_incidents.map((inc) => (
            <Card key={inc.id} className="border-red-500/30 bg-red-950/10">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Investigating</span>
                  <span className="text-xs text-muted-foreground font-mono">{timeAgo(inc.started_at)}</span>
                </div>
                <p className="text-sm text-white font-medium">{inc.root_cause || 'Service unresponsive'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Services List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            System Components ({data?.services.length || 0})
          </h3>
          <span className="text-xs text-muted-foreground">Last 30 checks history</span>
        </div>

        <div className="divide-y divide-border/60 border border-border/80 rounded-xl bg-card/60 backdrop-blur overflow-hidden">
          {data?.services.map((svc) => {
            const isUp = svc.status === 'UP';
            const historyBars = [...svc.recent_history];
            while (historyBars.length < 30) {
              historyBars.unshift({
                timestamp: '',
                is_up: true,
                response_time_ms: 0,
                status_code: null,
              });
            }

            return (
              <div key={svc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${isUp ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                    <span className="font-semibold text-white text-sm">{svc.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground">
                      {svc.monitor_type}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono block mt-0.5 truncate max-w-sm">
                    {svc.url}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Bars */}
                  <div className="flex items-center gap-[2px] h-5 bg-background/50 px-1 py-0.5 rounded border border-border/40">
                    {historyBars.map((b, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-3.5 rounded-sm ${
                          b.timestamp === '' ? 'bg-muted/40' : b.is_up ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="text-right min-w-[70px]">
                    <div className="text-xs font-bold font-mono text-emerald-400">
                      {svc.uptime_24h.toFixed(1)}%
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {formatMs(svc.last_response_time_ms)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center pt-8 border-t border-border/60 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-white">ResPulse Status Network</p>
        <p>Continuous synthetic health monitoring powered by Rust & Axum.</p>
      </footer>
    </div>
  );
};
