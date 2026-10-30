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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
      {/* 1. Monitored Targets */}
      <Card className="relative overflow-hidden bg-card/60 backdrop-blur border-border/80 hover:border-cyan-500/40 hover:shadow-[0_4px_25px_rgba(6,182,212,0.1)] transition-all group">
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
        <CardContent className="p-2.5 sm:p-5 flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span className="sm:hidden">Monitored</span>
              <span className="hidden sm:inline">Monitored Targets</span>
            </p>
            <div className="flex items-baseline gap-1 sm:gap-2 mt-0.5 sm:mt-1">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-white group-hover:text-cyan-300 transition-colors">{total}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">endpoints</span>
            </div>
          </div>
          <div className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)] shrink-0">
            <Layers className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 2. Operational Status */}
      <Card className="relative overflow-hidden bg-card/60 backdrop-blur border-border/80 hover:border-emerald-500/50 hover:shadow-[0_4px_25px_rgba(16,185,129,0.15)] transition-all group">
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
        <CardContent className="p-2.5 sm:p-5 flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span className="sm:hidden">Operational</span>
              <span className="hidden sm:inline">Operational Status</span>
            </p>
            <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5 sm:mt-1">
              <span className="text-lg sm:text-2xl font-bold tracking-tight text-emerald-400 shadow-sm whitespace-nowrap">{up}/{total}</span>
              <span className="text-[10px] sm:text-xs font-mono text-emerald-400/90 font-medium whitespace-nowrap">({uptime}%)</span>
            </div>
          </div>
          <div className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)] shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
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
        <CardContent className="p-2.5 sm:p-5 flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span className="sm:hidden">Incidents</span>
              <span className="hidden sm:inline">Active Incidents</span>
            </p>
            <div className="flex items-baseline gap-1 sm:gap-2 mt-0.5 sm:mt-1">
              <span className={`text-lg sm:text-2xl font-bold tracking-tight ${down > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                {down}
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                {down === 0 ? 'All green' : 'investigating'}
              </span>
            </div>
          </div>
          <div className={`h-7 w-7 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center shrink-0 ${
            down > 0
              ? 'bg-red-500/15 border border-red-500/30 text-red-400 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.3)]'
              : 'bg-muted/30 border border-border text-muted-foreground'
          }`}>
            <AlertTriangle className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Avg Latency */}
      <Card className="relative overflow-hidden bg-card/60 backdrop-blur border-border/80 hover:border-purple-500/40 hover:shadow-[0_4px_25px_rgba(168,85,247,0.12)] transition-all group">
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />
        <CardContent className="p-2.5 sm:p-5 flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span className="sm:hidden">Latency</span>
              <span className="hidden sm:inline">Avg Latency (24h)</span>
            </p>
            <div className="flex items-baseline gap-1 sm:gap-2 mt-0.5 sm:mt-1">
              <span className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-white group-hover:text-purple-300 transition-colors">{avgLatency}</span>
              <span className="text-[10px] sm:text-xs font-mono text-muted-foreground">ms</span>
            </div>
          </div>
          <div className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.2)] shrink-0">
            <Clock className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
