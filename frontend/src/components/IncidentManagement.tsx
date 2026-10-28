import React, { useEffect, useState } from 'react';
import { IncidentWithDetails, MonitorWithStats, UserProfile } from '../types';
import { fetchIncidents, fetchMonitors } from '../api/client';
import { timeAgo } from '../lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  FileText,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { EditIncidentModal } from './EditIncidentModal';
import { DeclareIncidentModal } from './DeclareIncidentModal';

interface IncidentManagementProps {
  currentUser?: UserProfile | null;
}

export const IncidentManagement: React.FC<IncidentManagementProps> = ({ currentUser }) => {
  const [incidents, setIncidents] = useState<IncidentWithDetails[]>([]);
  const [monitors, setMonitors] = useState<MonitorWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONGOING' | 'RESOLVED'>('ALL');

  const isViewer = currentUser?.role === 'VIEWER';

  // Modals state
  const [selectedIncident, setSelectedIncident] = useState<IncidentWithDetails | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [incList, monList] = await Promise.all([fetchIncidents(), fetchMonitors()]);
      setIncidents(incList);
      setMonitors(monList);
    } catch (e) {
      console.error('Error loading incidents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const ongoingIncidents = incidents.filter((i) => i.status === 'ONGOING');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  const filteredIncidents = incidents.filter((i) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (i.title && i.title.toLowerCase().includes(q)) ||
      i.monitor_name.toLowerCase().includes(q) ||
      (i.summary && i.summary.toLowerCase().includes(q)) ||
      (i.root_cause && i.root_cause.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ONGOING' && i.status === 'ONGOING') ||
      (statusFilter === 'RESOLVED' && i.status === 'RESOLVED');

    return matchesSearch && matchesStatus;
  });

  // Calculate average MTTR
  const resolvedWithDuration = resolvedIncidents.filter((i) => i.duration_seconds && i.duration_seconds > 0);
  const avgDuration =
    resolvedWithDuration.length > 0
      ? Math.round(
          resolvedWithDuration.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0) /
            resolvedWithDuration.length
        )
      : 0;

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge className="bg-red-600 text-white font-mono text-[10px]">CRITICAL</Badge>;
      case 'MAJOR':
        return <Badge className="bg-amber-600 text-white font-mono text-[10px]">MAJOR</Badge>;
      case 'MINOR':
        return <Badge className="bg-blue-600 text-white font-mono text-[10px]">MINOR</Badge>;
      case 'MAINTENANCE':
        return <Badge className="bg-purple-600 text-white font-mono text-[10px]">MAINTENANCE</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{sev}</Badge>;
    }
  };

  const getStageColor = (st: string) => {
    switch (st) {
      case 'INVESTIGATING':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'IDENTIFIED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'MONITORING':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'RESOLVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-secondary/40 text-muted-foreground border-border/40';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/40 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground">
                Active Incidents
              </div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {ongoingIncidents.length}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {ongoingIncidents.length === 0 ? 'All systems operational' : 'Active resolution in progress'}
              </div>
            </div>
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                ongoingIncidents.length > 0
                  ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
            >
              {ongoingIncidents.length > 0 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground">
                Resolved Incidents
              </div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {resolvedIncidents.length}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Recorded incident history
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase font-mono tracking-wider text-muted-foreground">
                Mean Time to Resolve (MTTR)
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {formatDuration(avgDuration)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Average recovery timeframe
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 p-3 sm:p-4 rounded-xl border border-border/60">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents by title, service, root cause..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/80 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary/40 p-1 rounded-lg border border-border/60 text-xs">
            {(['ALL', 'ONGOING', 'RESOLVED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={loadData}
            variant="outline"
            className="h-9 px-2.5 border-border/80 text-xs text-muted-foreground hover:text-white"
            title="Refresh incident list"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            onClick={() => setIsDeclareModalOpen(true)}
            disabled={isViewer}
            className={`font-medium h-9 text-xs gap-1.5 ${
              isViewer
                ? 'opacity-40 cursor-not-allowed bg-secondary text-muted-foreground'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title={isViewer ? 'Requires Engineer role or higher to declare incidents' : 'Declare Incident'}
          >
            <Plus className="h-4 w-4" />
            Declare Incident
          </Button>
        </div>
      </div>

      {/* Ongoing Incidents Section */}
      {ongoingIncidents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
              Active Outages & Degradations ({ongoingIncidents.length})
            </h3>
            <span className="text-[11px] text-muted-foreground">Dispatched to public status page</span>
          </div>

          <div className="space-y-3">
            {ongoingIncidents.map((inc) => (
              <Card
                key={inc.id}
                className="border-red-500/40 bg-red-950/15 hover:bg-red-950/25 transition-all shadow-md"
              >
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getSeverityBadge(inc.severity)}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getStageColor(inc.stage)}`}>
                        {inc.stage}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Started {timeAgo(inc.started_at)}
                      </span>
                    </div>

                    <h4 className="font-semibold text-white text-base">
                      {inc.title || `${inc.monitor_name} Service Disruption`}
                    </h4>

                    <p className="text-xs text-muted-foreground max-w-2xl">
                      {inc.summary || 'Engineers are investigating service degradation.'}
                    </p>

                    {inc.root_cause && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-mono text-red-400/90 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded">
                        <span>Diagnostic:</span>
                        <span className="truncate max-w-md">{inc.root_cause}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedIncident(inc);
                        setIsEditModalOpen(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs gap-1.5"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Manage & Post Updates
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Incidents Table / List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Incident History & Post-Mortem Records ({filteredIncidents.length})
        </h3>

        {filteredIncidents.length > 0 ? (
          <div className="border border-border/70 rounded-xl bg-card/40 backdrop-blur overflow-hidden divide-y divide-border/60">
            {filteredIncidents.map((inc) => {
              const hasPostMortem = Boolean(inc.post_mortem && inc.post_mortem.trim());

              return (
                <div
                  key={inc.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-secondary/20 transition-colors"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getSeverityBadge(inc.severity)}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getStageColor(inc.stage)}`}>
                        {inc.stage}
                      </span>
                      <span className="font-semibold text-white text-sm truncate">
                        {inc.title || `${inc.monitor_name} Disruption`}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        ({inc.monitor_name})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                      <span>Started: {new Date(inc.started_at).toLocaleString()}</span>
                      {inc.duration_seconds && (
                        <span>Outage Duration: {formatDuration(inc.duration_seconds)}</span>
                      )}
                      {inc.updates && (
                        <span>{inc.updates.length} timeline update{inc.updates.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {inc.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{inc.summary}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasPostMortem ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                        <FileText className="h-3 w-3" />
                        RCA Published
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        No Post-Mortem
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedIncident(inc);
                        setIsEditModalOpen(true);
                      }}
                      className="h-8 text-xs gap-1 border-border/80 hover:text-white"
                    >
                      <FileText className="h-3.5 w-3.5 text-emerald-400" />
                      {hasPostMortem ? 'View / Edit Post-Mortem' : 'Write Post-Mortem'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-card/30 rounded-2xl border border-dashed border-border/80 p-8">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">No incidents found</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {incidents.length === 0
                ? 'Your infrastructure has had zero detected outages!'
                : 'No incidents match your current search and filter criteria.'}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <EditIncidentModal
        incident={selectedIncident}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedIncident(null);
        }}
        onRefresh={loadData}
      />

      <DeclareIncidentModal
        monitors={monitors}
        isOpen={isDeclareModalOpen}
        onClose={() => setIsDeclareModalOpen(false)}
        onCreated={loadData}
      />
    </div>
  );
};
