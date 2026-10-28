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
  isViewer?: boolean;
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
  isViewer = false,
}) => {
  const [testing, setTesting] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<{
    index: number;
    bar: { timestamp: string; is_up: boolean; response_time_ms: number; status_code: number | null };
  } | null>(null);

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
        return <ShieldCheck className="h-3 w-3 text-amber-400" />;
      case 'PORT':
        return <Server className="h-3 w-3 text-blue-400" />;
      case 'HEARTBEAT':
        return <Heart className="h-3 w-3 text-rose-400" />;
      default:
        return <Activity className="h-3 w-3 text-emerald-400" />;
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

  // Render Status Ping Dot
  const renderStatusDot = (sizeClass = 'h-3 w-3 sm:h-3.5 sm:w-3.5') => (
    <div className="relative flex-shrink-0 flex items-center justify-center">
      {isUp && (
        <span className={`flex ${sizeClass} relative`}>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-full w-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
        </span>
      )}
      {isDown && (
        <span className={`flex ${sizeClass} relative`}>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-full w-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
        </span>
      )}
      {isPaused && (
        <span className={`inline-flex rounded-full ${sizeClass} bg-muted-foreground/60`}></span>
      )}
      {!isUp && !isDown && !isPaused && (
        <span className={`inline-flex rounded-full ${sizeClass} bg-amber-400 animate-pulse`}></span>
      )}
    </div>
  );

  // -------------------------------------------------------------
  // COMPACT VIEW RENDERER (High-Density ~46px single-row)
  // -------------------------------------------------------------
  if (compact) {
    return (
      <div
        onClick={() => onSelect(monitor)}
        className={`group relative border transition-all duration-150 cursor-pointer rounded-lg px-3 py-2 flex items-center justify-between gap-3 ${
          isSelected
            ? 'border-emerald-500/80 bg-emerald-950/25 ring-1 ring-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
            : 'border-border/60 bg-card/40 hover:bg-card/80 hover:border-emerald-500/30 hover:shadow-[0_2px_15px_rgba(16,185,129,0.06)]'
        }`}
      >
        {/* Left: Checkbox + Status + Name + Protocol + URL */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(monitor.id, e);
            }}
            className="flex-shrink-0 flex items-center justify-center p-0.5 rounded hover:bg-white/10 transition-colors"
            title={isSelected ? 'Deselect monitor' : 'Select monitor'}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="h-3.5 w-3.5 rounded border-border/80 text-emerald-500 focus:ring-emerald-500 bg-background/80 cursor-pointer accent-emerald-500"
            />
          </div>

          {renderStatusDot('h-2.5 w-2.5')}

          <span className="font-semibold text-white tracking-tight truncate group-hover:text-emerald-400 transition-colors text-xs max-w-[130px] sm:max-w-[200px]">
            {monitor.name}
          </span>

          <Badge variant="outline" className="text-[9px] py-0 px-1 gap-1 bg-muted/40 font-mono flex-shrink-0 hidden sm:inline-flex">
            {getTypeIcon()}
            {monitor.monitor_type}
          </Badge>

          {monitor.group_name && monitor.group_name !== 'Default' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-300 bg-slate-800/70 border border-slate-700/60 px-1 py-0.2 rounded flex-shrink-0 hidden lg:inline-flex">
              <Folder className="h-2.5 w-2.5 text-amber-400" />
              {monitor.group_name}
            </span>
          )}

          <a
            href={monitor.url.startsWith('http') ? monitor.url : `http://${monitor.url}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-muted-foreground hover:text-white truncate hidden md:flex items-center gap-1 transition-colors font-mono max-w-[180px] lg:max-w-[260px]"
          >
            <span className="truncate">{monitor.url}</span>
            <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />
          </a>
        </div>

        {/* Center: Micro-bar timeline with animated hover tooltip */}
        <div className="relative flex-shrink-0 hidden sm:flex items-center">
          {hoveredBar && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150">
              <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-2 py-0.5 rounded-md shadow-xl text-[10px] font-mono whitespace-nowrap flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${hoveredBar.bar.is_up ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="font-semibold text-white">
                  {hoveredBar.bar.is_up ? '200 OK' : hoveredBar.bar.status_code ? `HTTP ${hoveredBar.bar.status_code}` : 'DOWN'}
                </span>
                <span className="text-emerald-400 font-bold">{formatMs(hoveredBar.bar.response_time_ms)}</span>
                <span className="text-slate-400">{hoveredBar.bar.timestamp ? new Date(hoveredBar.bar.timestamp).toLocaleTimeString() : ''}</span>
              </div>
            </div>
          )}

          <div
            className="flex items-center gap-[1px] h-4 px-1 py-0.5 bg-background/50 rounded border border-border/30"
            onMouseLeave={() => setHoveredBar(null)}
          >
            {historyBars.map((bar, idx) => {
              const hasData = bar.timestamp !== '';
              const barColor = !hasData
                ? 'bg-muted/30'
                : bar.is_up
                ? 'bg-emerald-500 hover:bg-emerald-300'
                : 'bg-red-500 hover:bg-red-300';

              return (
                <div
                  key={idx}
                  onMouseEnter={() => hasData && setHoveredBar({ index: idx, bar })}
                  className={`w-1 h-3 rounded-[0.5px] transition-all transform hover:scale-y-125 hover:brightness-125 cursor-pointer origin-bottom ${barColor}`}
                />
              );
            })}
          </div>
        </div>

        {/* Right: Uptime % + Latency + Compact Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-mono font-medium text-emerald-400">
            {monitor.uptime_24h.toFixed(1)}%
          </span>

          <span className="text-xs font-mono font-medium text-white w-14 text-right hidden sm:inline-block">
            {formatMs(monitor.last_response_time_ms)}
          </span>

          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title={isViewer ? 'Read-only access: requires Engineer role or higher to test' : 'Test now'}
              disabled={testing || isPaused || isViewer}
              onClick={handleTest}
            >
              <Play className={`h-3 w-3 ${testing ? 'animate-spin text-emerald-400' : ''}`} />
            </Button>

            {isPaused ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
                title={isViewer ? 'Read-only access: requires Engineer role or higher to resume' : 'Resume monitor'}
                disabled={isViewer}
                onClick={() => onResume(monitor.id)}
              >
                <Play className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed"
                title={isViewer ? 'Read-only access: requires Engineer role or higher to pause' : 'Pause monitor'}
                disabled={isViewer}
                onClick={() => onPause(monitor.id)}
              >
                <Pause className="h-3 w-3" />
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
              title={isViewer ? 'Read-only access: requires Engineer role or higher to delete' : 'Delete monitor'}
              disabled={isViewer}
              onClick={() => onDelete(monitor.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // COMFORTABLE VIEW RENDERER (Full Rich Card)
  // -------------------------------------------------------------
  return (
    <div
      onClick={() => onSelect(monitor)}
      className={`group relative bg-card/60 hover:bg-card/90 border transition-all duration-200 cursor-pointer rounded-xl p-4 sm:p-5 ${
        isSelected
          ? 'border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
          : 'border-border/80 hover:border-emerald-500/40 hover:shadow-[0_4px_25px_rgba(16,185,129,0.08)]'
      }`}
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
          {renderStatusDot()}

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
              {monitor.slug && (
                <span className="inline-flex items-center text-[10px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded">
                  /{monitor.slug}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground font-mono">
                {monitor.monitor_type === 'HEARTBEAT' ? (
                  <>
                    {monitor.cron_expression ? (
                      <span className="text-cyan-400 font-semibold">{monitor.cron_expression} ({monitor.timezone || 'UTC'})</span>
                    ) : (
                      `${monitor.interval_seconds}s`
                    )}
                    {monitor.grace_seconds ? ` (+${monitor.grace_seconds}s grace)` : ''}
                    {monitor.last_duration_ms ? ` · ${formatMs(monitor.last_duration_ms)} run` : ''}
                  </>
                ) : (
                  `${monitor.interval_seconds}s`
                )}
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

        {/* Center: 30-Check Uptime Strip with Animated Rich Tooltip */}
        <div className="relative flex flex-col items-start md:items-end flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-emerald-400">
              {monitor.uptime_24h.toFixed(1)}%
            </span>
            <span className="text-[11px] text-muted-foreground">uptime (24h)</span>
          </div>

          {/* Animated Tooltip on bar hover */}
          {hoveredBar && (
            <div className="absolute -top-11 right-0 md:right-0 z-30 pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150">
              <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-2.5 py-1 rounded-lg shadow-2xl text-[11px] font-mono whitespace-nowrap flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${hoveredBar.bar.is_up ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]'}`} />
                <span className="font-semibold text-white">
                  {hoveredBar.bar.is_up ? '200 OK' : hoveredBar.bar.status_code ? `HTTP ${hoveredBar.bar.status_code}` : 'DOWN'}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-emerald-400 font-bold">{formatMs(hoveredBar.bar.response_time_ms)}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-slate-400 text-[10px]">{hoveredBar.bar.timestamp ? new Date(hoveredBar.bar.timestamp).toLocaleTimeString() : ''}</span>
              </div>
            </div>
          )}

          {/* Bar timeline */}
          <div
            className="flex items-center gap-[2px] mt-1 h-5 sm:h-6 px-1 py-0.5 bg-background/50 rounded border border-border/40"
            onMouseLeave={() => setHoveredBar(null)}
          >
            {historyBars.map((bar, idx) => {
              const hasData = bar.timestamp !== '';
              const barColor = !hasData
                ? 'bg-muted/40'
                : bar.is_up
                ? 'bg-emerald-500 hover:bg-emerald-300'
                : 'bg-red-500 hover:bg-red-300';

              return (
                <div
                  key={idx}
                  onMouseEnter={() => hasData && setHoveredBar({ index: idx, bar })}
                  className={`w-1.5 h-3.5 sm:h-4 rounded-sm transition-all transform hover:scale-y-125 hover:brightness-125 cursor-pointer origin-bottom ${barColor}`}
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
              className="h-8 w-8 text-muted-foreground hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title={isViewer ? 'Read-only access: requires Engineer role or higher to test' : 'Test now'}
              disabled={testing || isPaused || isViewer}
              onClick={handleTest}
            >
              <Play className={`h-3.5 w-3.5 ${testing ? 'animate-spin text-emerald-400' : ''}`} />
            </Button>

            {isPaused ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
                title={isViewer ? 'Read-only access: requires Engineer role or higher to resume' : 'Resume monitor'}
                disabled={isViewer}
                onClick={() => onResume(monitor.id)}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed"
                title={isViewer ? 'Read-only access: requires Engineer role or higher to pause' : 'Pause monitor'}
                disabled={isViewer}
                onClick={() => onPause(monitor.id)}
              >
                <Pause className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
              title={isViewer ? 'Read-only access: requires Engineer role or higher to delete' : 'Delete monitor'}
              disabled={isViewer}
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
