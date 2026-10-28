import React from 'react';
import { GlobalStats } from '../types';
import { CheckCircle2, AlertTriangle, Clock, Layers } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface StatsOverviewProps {
  stats: GlobalStats | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  const total = stats?.total_monitors ?? 0;
  const up = stats?.up_monitors ?? 0;
  const down = stats?.down_monitors ?? 0;
  const uptime = stats?.overall_uptime_24h ?? 100;
  const avgLatency = stats?.avg_response_time_ms ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. Monitored Targets */}
      <Card className="relative overflow-hidden bg-card/60 backdrop-blur border-border/80 hover:border-cyan-500/40 hover:shadow-[0_4px_25px_rgba(6,182,212,0.1)] transition-all group">
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monitored Targets</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-white group-hover:text-cyan-300 transition-colors">{total}</span>
              <span className="text-xs text-muted-foreground">total endpoints</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            <Layers className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Operational Status */}
      <Card className="relative overflow-hidden bg-card/60 backdrop-blur border-border/80 hover:border-emerald-500/50 hover:shadow-[0_4px_25px_rgba(16,185,129,0.15)] transition-all group">
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operational Status</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-emerald-400 shadow-sm">{up} / {total}</span>
              <span className="text-xs font-mono text-emerald-400/90 font-medium">({uptime}%)</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 3. Active Incidents */}
      <Card className={`relative overflow-hidden bg-card/60 backdrop-blur border-border/80 transition-all group ${
        down > 0 ? 'hover:border-red-500/50 hover:shadow-[0_4px_25px_rgba(239,68,68,0.2)]' : 'hover:border-border'
      }`}>
        <div className={`absolute top-0 inset-x-0 h-[1px] ${
          down > 0 ? 'bg-gradient-to-r from-transparent via-red-400/40 to-transparent' : 'bg-gradient-to-r from-transparent via-white/10 to-transparent'
        }`} />
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Incidents</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-bold tracking-tight ${down > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                {down}
              </span>
              <span className="text-xs text-muted-foreground">
                {down === 0 ? 'All systems green' : 'investigating'}
              </span>
            </div>
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            down > 0
              ? 'bg-red-500/15 border border-red-500/30 text-red-400 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.3)]'
              : 'bg-muted/30 border border-border text-muted-foreground'
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Avg Latency */}
      <Card className="relative overflow-hidden bg-card/60 backdrop-blur border-border/80 hover:border-purple-500/40 hover:shadow-[0_4px_25px_rgba(168,85,247,0.12)] transition-all group">
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Latency (24h)</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono tracking-tight text-white group-hover:text-purple-300 transition-colors">{avgLatency}</span>
              <span className="text-xs font-mono text-muted-foreground">ms</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.2)]">
            <Clock className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
