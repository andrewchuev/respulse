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
      <Card className="bg-card/60 backdrop-blur border-border/80 hover:border-border transition-all">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monitored Targets</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-white">{total}</span>
              <span className="text-xs text-muted-foreground">total endpoints</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Layers className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur border-border/80 hover:border-border transition-all">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operational Status</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-emerald-400">{up} / {total}</span>
              <span className="text-xs font-mono text-emerald-400/90 font-medium">({uptime}%)</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur border-border/80 hover:border-border transition-all">
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
            down > 0 ? 'bg-red-500/15 border border-red-500/30 text-red-400 animate-pulse' : 'bg-muted/30 border border-border text-muted-foreground'
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur border-border/80 hover:border-border transition-all">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Latency (24h)</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono tracking-tight text-white">{avgLatency}</span>
              <span className="text-xs font-mono text-muted-foreground">ms</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Clock className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
