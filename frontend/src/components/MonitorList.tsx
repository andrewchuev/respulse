import React, { useState } from 'react';
import { MonitorWithStats } from '../types';
import { MonitorCard } from './MonitorCard';
import { Search, Filter, Plus } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

interface MonitorListProps {
  monitors: MonitorWithStats[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onSelect: (monitor: MonitorWithStats) => void;
  onAddClick: () => void;
}

export const MonitorList: React.FC<MonitorListProps> = ({
  monitors,
  onPause,
  onResume,
  onDelete,
  onTest,
  onSelect,
  onAddClick,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UP' | 'DOWN' | 'PAUSED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const filtered = monitors.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.url.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'UP' && m.status === 'UP') ||
      (statusFilter === 'DOWN' && m.status === 'DOWN') ||
      (statusFilter === 'PAUSED' && (m.is_paused || m.status === 'PAUSED'));

    const matchesType = typeFilter === 'ALL' || m.monitor_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search monitors by name or target URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border/80 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center bg-secondary/40 p-1 rounded-lg border border-border/60 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground mx-1.5" />
            {(['ALL', 'UP', 'DOWN', 'PAUSED'] as const).map((st) => (
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

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-secondary/40 border border-border/60 rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8"
          >
            <option value="ALL">All Types</option>
            <option value="HTTP">HTTP(S)</option>
            <option value="PORT">TCP Port</option>
            <option value="SSL">SSL Cert</option>
            <option value="HEARTBEAT">Heartbeat</option>
          </select>
        </div>
      </div>

      {/* Monitors Cards */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((monitor) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              onPause={onPause}
              onResume={onResume}
              onDelete={onDelete}
              onTest={onTest}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-card/30 rounded-2xl border border-dashed border-border/80 p-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No monitors found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {monitors.length === 0
              ? 'Get started by creating your first uptime monitor to watch websites, APIs or servers.'
              : 'No monitors match your current filter criteria.'}
          </p>
          {monitors.length === 0 && (
            <Button onClick={onAddClick} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              Create Monitor
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
