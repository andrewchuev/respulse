import React, { useState } from 'react';
import { MonitorWithStats } from '../types';
import { formatMs, timeAgo } from '../lib/utils';
import {
  Play,
  Pause,
  Trash2,
  ExternalLink,
  Activity,
  ShieldCheck,
  Server,
  Heart,
  Folder,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface MonitorCardProps {
  monitor: MonitorWithStats;
  isSelected?: boolean;
  onToggleSelect?: (id: string, e: React.MouseEvent) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onSelect: (monitor: MonitorWithStats) => void;
  compact?: boolean;
}

export const MonitorCard: React.FC<MonitorCardProps> = ({
  monitor,
  isSelected = false,
  onToggleSelect,
  onPause,
  onResume,
  onDelete,
  onTest,
  onSelect,
  compact = false,
}) => {
  const [testing, setTesting] = useState(false);

  const handleTest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTesting(true);
    try {
      await onTest(monitor.id);
    } finally {
      setTimeout(() => setTesting(false), 500);
    }
  };

  const getTypeIcon = () => {
    switch (monitor.monitor_type) {
      case 'SSL':
        return <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />;
      case 'PORT':
        return <Server className="h-3.5 w-3.5 text-blue-400" />;
      case 'HEARTBEAT':
        return <Heart className="h-3.5 w-3.5 text-rose-400" />;
      default:
        return <Activity className="h-3.5 w-3.5 text-emerald-400" />;
    }
  };

  const isUp = monitor.status === 'UP';
  const isDown = monitor.status === 'DOWN';
  const isPaused = monitor.is_paused || monitor.status === 'PAUSED';

  // Generate 30 bars (fill up with placeholders if less than 30 checks exist)
  const historyBars = [...monitor.recent_history];
  while (historyBars.length < 30) {
    historyBars.unshift({
      timestamp: '',
      is_up: true,
      response_time_ms: 0,
      status_code: null,
    });
  }

  return (
    <div
      onClick={() => onSelect(monitor)}
      className={`group relative bg-card/60 hover:bg-card/90 border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md rounded-xl ${
        isSelected
          ? 'border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/50'
          : 'border-border/80 hover:border-emerald-500/30'
      } ${compact ? 'p-3' : 'p-4 sm:p-5'}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Checkbox + Status & Identity */}
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          {/* Bulk Selection Checkbox */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(monitor.id, e);
            }}
            className="mt-0.5 sm:mt-0 flex-shrink-0 flex items-center justify-center p-1 rounded hover:bg-white/10 transition-colors"
            title={isSelected ? 'Deselect monitor' : 'Select monitor'}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="h-4 w-4 rounded border-border/80 text-emerald-500 focus:ring-emerald-500 bg-background/80 cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Status Indicator */}
          <div className="relative mt-1 sm:mt-0 flex-shrink-0">
            {isUp && (
              <span className="flex h-3 w-3 sm:h-3.5 sm:w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-full w-full bg-emerald-500"></span>
              </span>
            )}
            {isDown && (
              <span className="flex h-3 w-3 sm:h-3.5 sm:w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-full w-full bg-red-500"></span>
              </span>
            )}
            {isPaused && (
              <span className="inline-flex rounded-full h-3 w-3 sm:h-3.5 sm:w-3.5 bg-muted-foreground/60"></span>
            )}
            {!isUp && !isDown && !isPaused && (
              <span className="inline-flex rounded-full h-3 w-3 sm:h-3.5 sm:w-3.5 bg-amber-400 animate-pulse"></span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white tracking-tight truncate group-hover:text-emerald-400 transition-colors text-sm sm:text-base">
                {monitor.name}
              </h3>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 gap-1 bg-muted/40 font-mono">
                {getTypeIcon()}
                {monitor.monitor_type}
              </Badge>
              {monitor.group_name && monitor.group_name !== 'Default' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 bg-slate-800/70 border border-slate-700/60 px-1.5 py-0.5 rounded">
                  <Folder className="h-3 w-3 text-amber-400" />
                  {monitor.group_name}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground font-mono">
                {monitor.interval_seconds}s
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5 sm:mt-1 flex-wrap">
              <a
                href={monitor.url.startsWith('http') ? monitor.url : `http://${monitor.url}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-muted-foreground hover:text-white truncate flex items-center gap-1 transition-colors font-mono max-w-[260px] sm:max-w-[380px]"
              >
                <span className="truncate">{monitor.url}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
              </a>

              {/* Tags */}
              {monitor.tags && monitor.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {monitor.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.2 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center: 30-Check Uptime Strip */}
        <div className="flex flex-col items-start md:items-end flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-emerald-400">
              {monitor.uptime_24h.toFixed(1)}%
            </span>
            <span className="text-[11px] text-muted-foreground">uptime (24h)</span>
          </div>

          {/* Bar timeline */}
          <div className="flex items-center gap-[2px] mt-1 h-5 sm:h-6 px-1 py-0.5 bg-background/50 rounded border border-border/40">
            {historyBars.map((bar, idx) => {
              const hasData = bar.timestamp !== '';
              const barColor = !hasData
                ? 'bg-muted/40'
                : bar.is_up
                ? 'bg-emerald-500 hover:bg-emerald-400'
                : 'bg-red-500 hover:bg-red-400';

              return (
                <div
                  key={idx}
                  title={
                    hasData
                      ? `${bar.is_up ? 'UP' : 'DOWN'} | ${formatMs(bar.response_time_ms)} | ${new Date(bar.timestamp).toLocaleTimeString()}`
                      : 'No data'
                  }
                  className={`w-1.5 h-3.5 sm:h-4 rounded-sm transition-all ${barColor}`}
                />
              );
            })}
          </div>
        </div>

        {/* Right: Latency & Quick Actions */}
        <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-border/40 pt-2.5 md:pt-0">
          <div className="text-right">
            <div className="text-sm font-mono font-medium text-white">
              {formatMs(monitor.last_response_time_ms)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {timeAgo(monitor.last_checked_at)}
            </div>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-white"
              title="Test now"
              disabled={testing || isPaused}
              onClick={handleTest}
            >
              <Play className={`h-3.5 w-3.5 ${testing ? 'animate-spin text-emerald-400' : ''}`} />
            </Button>

            {isPaused ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-emerald-400"
                title="Resume monitor"
                onClick={() => onResume(monitor.id)}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-amber-400"
                title="Pause monitor"
                onClick={() => onPause(monitor.id)}
              >
                <Pause className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-red-400"
              title="Delete monitor"
              onClick={() => onDelete(monitor.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Error alert banner if currently down */}
      {isDown && monitor.last_error && (
        <div className="mt-3 pt-2.5 border-t border-red-500/20 text-xs text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0 animate-ping" />
            <span className="font-mono truncate">{monitor.last_error}</span>
          </div>
          <span className="text-[10px] text-red-400/80 font-mono ml-2 flex-shrink-0">
            {timeAgo(monitor.last_status_change_at)}
          </span>
        </div>
      )}
    </div>
  );
};
