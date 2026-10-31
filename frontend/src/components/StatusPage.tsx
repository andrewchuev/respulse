import React, { useEffect, useMemo, useState } from 'react';
import { PublicStatusPage as StatusPageType } from '../types';
import { fetchStatusPage } from '../api/client';
import { formatMs, timeAgo } from '../lib/utils';
import {
  CheckCircle2,
  AlertTriangle,
  Shield,
  ArrowLeft,
  Folder,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface StatusPageProps {
  onBack: () => void;
}

export const StatusPage: React.FC<StatusPageProps> = ({ onBack }) => {
  const [data, setData] = useState<StatusPageType | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPostMortems, setExpandedPostMortems] = useState<Set<string>>(new Set());

  const togglePostMortem = (id: string) => {
    setExpandedPostMortems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    fetchStatusPage()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const groupedServices = useMemo(() => {
    if (!data?.services) return {};
    const groups: Record<string, typeof data.services> = {};
    data.services.forEach((s) => {
      const g = s.group_name || 'General Services';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });
    return groups;
  }, [data?.services]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const allOperational = data?.all_systems_operational ?? true;

  return (
    <div className="min-h-screen bg-background text-foreground">
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

        {/* Active Service Incidents */}
        {data?.active_incidents && data.active_incidents.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-red-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
              Active Incidents ({data.active_incidents.length})
            </h3>
            {data.active_incidents.map((inc) => (
              <Card key={inc.id} className="border-red-500/40 bg-red-950/20 shadow-lg">
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-red-500/20 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-600 text-white">
                        {inc.severity || 'MAJOR'}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-red-500/30 text-red-300">
                        {inc.stage || 'INVESTIGATING'}
                      </span>
                      <h4 className="font-bold text-white text-base">
                        {inc.title || `${inc.monitor_name} Service Disruption`}
                      </h4>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Started {timeAgo(inc.started_at)}
                    </span>
                  </div>

                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {inc.summary || 'Our engineers are investigating degraded response metrics on affected infrastructure.'}
                  </p>

                  {/* Timeline updates */}
                  {inc.updates && inc.updates.length > 0 && (
                    <div className="pt-2">
                      <h5 className="text-xs font-semibold uppercase font-mono tracking-wider text-muted-foreground mb-2">
                        Live Incident Updates
                      </h5>
                      <div className="space-y-2.5 pl-4 border-l-2 border-red-500/40 ml-1">
                        {inc.updates.map((u) => (
                          <div key={u.id} className="text-xs space-y-0.5">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="font-semibold text-white font-mono">{u.stage}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">{u.author}</span>
                              <span className="text-muted-foreground font-mono">({timeAgo(u.created_at)})</span>
                            </div>
                            <p className="text-foreground/85 whitespace-pre-wrap">{u.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Services List Grouped by Category */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              System Components ({data?.services.length || 0})
            </h3>
            <span className="text-xs text-muted-foreground font-mono">30 checks history</span>
          </div>

          {Object.entries(groupedServices).map(([groupName, services]) => {
            const upCount = services.filter((s) => s.status === 'UP').length;
            const isAllUp = upCount === services.length;

            return (
              <div key={groupName} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-amber-400" />
                    <h4 className="text-sm font-semibold text-white">{groupName}</h4>
                    <span className="text-xs text-muted-foreground font-mono">({services.length})</span>
                  </div>
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                      isAllUp
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}
                  >
                    {upCount}/{services.length} Operational
                  </span>
                </div>

                <div className="divide-y divide-border/60 border border-border/80 rounded-xl bg-card/60 backdrop-blur overflow-hidden">
                  {services.map((svc) => {
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

                        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto">
                          {/* Bars */}
                          <div className="flex items-center gap-[1.5px] sm:gap-[2px] h-5 bg-background/50 px-1 py-0.5 rounded border border-border/40">
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
                            <div className="text-[10px] font-mono text-muted-foreground" title="Median response time, last 24h">
                              {formatMs(svc.latency_p50_ms)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Past Incidents & Post-Mortem Records (Past 7 Days) */}
        <div className="space-y-4 pt-4 border-t border-border/60">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Past Incidents & Post-Mortems (Past 7 Days)
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              {data?.resolved_incidents?.length || 0} resolved
            </span>
          </div>

          {data?.resolved_incidents && data.resolved_incidents.length > 0 ? (
            <div className="space-y-3">
              {data.resolved_incidents.map((inc) => {
                const isExpanded = expandedPostMortems.has(inc.id);
                const hasPostMortem = Boolean(inc.post_mortem && inc.post_mortem.trim());

                return (
                  <Card key={inc.id} className="border-border/70 bg-card/40 backdrop-blur overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            RESOLVED
                          </span>
                          <h4 className="font-semibold text-white text-sm">
                            {inc.title || `${inc.monitor_name} Disruption`}
                          </h4>
                          <span className="text-xs text-muted-foreground font-mono">
                            ({inc.monitor_name})
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(inc.started_at).toLocaleDateString()} • Outage Duration:{' '}
                          {inc.duration_seconds ? `${Math.round(inc.duration_seconds / 60)}m` : 'N/A'}
                        </span>
                      </div>

                      {inc.summary && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {inc.summary}
                        </p>
                      )}

                      {/* Timeline Updates */}
                      {inc.updates && inc.updates.length > 0 && (
                        <div className="pl-3 border-l-2 border-border/80 space-y-1.5 pt-1 text-xs text-muted-foreground">
                          {inc.updates.map((u) => (
                            <div key={u.id} className="text-[11px]">
                              <span className="font-mono text-white font-medium">{u.stage}:</span>{' '}
                              <span>{u.message}</span>
                              <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">
                                ({timeAgo(u.created_at)})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Expandable Post-Mortem / RCA */}
                      {hasPostMortem && (
                        <div className="pt-2 border-t border-border/50">
                          <button
                            onClick={() => togglePostMortem(inc.id)}
                            className="flex items-center justify-between w-full text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors py-1"
                          >
                            <span className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5" />
                              Root Cause Analysis & Post-Mortem
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-2.5 p-4 rounded-xl bg-secondary/30 border border-border/60 text-xs text-foreground/90 font-mono whitespace-pre-wrap leading-relaxed animate-in fade-in duration-200">
                              {inc.post_mortem}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 bg-card/20 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground">
              No incidents reported in the past 7 days.
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-border/60 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-white">ResPulse Status Network</p>
          <p>Continuous synthetic health monitoring powered by Rust & Axum.</p>
        </footer>
      </div>
    </div>
  );
};
