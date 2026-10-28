import React, { useMemo, useState } from 'react';
import { MonitorWithStats } from '../types';
import { MonitorCard } from './MonitorCard';
import {
  Search,
  Filter,
  Plus,
  Folder,
  Layers,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  Trash2,
  Tag,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
} from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { bulkAction } from '../api/client';

interface MonitorListProps {
  monitors: MonitorWithStats[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onSelect: (monitor: MonitorWithStats) => void;
  onAddClick: () => void;
  onRefreshData?: () => void;
  isViewer?: boolean;
}

export const MonitorList: React.FC<MonitorListProps> = ({
  monitors,
  onPause,
  onResume,
  onDelete,
  onTest,
  onSelect,
  onAddClick,
  onRefreshData,
  isViewer = false,
}) => {
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UP' | 'DOWN' | 'PAUSED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [tagFilter, setTagFilter] = useState<string>('ALL');

  // View state
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem('respulse_compact_view') === 'true';
    } catch {
      return false;
    }
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleCompact = () => {
    setIsCompact((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('respulse_compact_view', String(next));
      } catch {}
      return next;
    });
  };

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Bulk actions state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; success: boolean } | null>(null);

  // Extract all unique folders/groups
  const allGroups = useMemo(() => {
    const groups = new Set<string>();
    monitors.forEach((m) => {
      if (m.group_name) groups.add(m.group_name);
    });
    return Array.from(groups).sort();
  }, [monitors]);

  // Extract all unique tags with count
  const allTags = useMemo(() => {
    const counts: Record<string, number> = {};
    monitors.forEach((m) => {
      m.tags?.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [monitors]);

  // Filter monitors
  const filtered = useMemo(() => {
    return monitors.filter((m) => {
      const q = search.toLowerCase();
      const matchesSearch =
        m.name.toLowerCase().includes(q) ||
        m.url.toLowerCase().includes(q) ||
        (m.tags && m.tags.some((t) => t.toLowerCase().includes(q))) ||
        (m.group_name && m.group_name.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'UP' && m.status === 'UP') ||
        (statusFilter === 'DOWN' && m.status === 'DOWN') ||
        (statusFilter === 'PAUSED' && (m.is_paused || m.status === 'PAUSED'));

      const matchesType = typeFilter === 'ALL' || m.monitor_type === typeFilter;
      const matchesGroup = groupFilter === 'ALL' || m.group_name === groupFilter;
      const matchesTag = tagFilter === 'ALL' || (m.tags && m.tags.includes(tagFilter));

      return matchesSearch && matchesStatus && matchesType && matchesGroup && matchesTag;
    });
  }, [monitors, search, statusFilter, typeFilter, groupFilter, tagFilter]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter, groupFilter, tagFilter, pageSize]);

  // Pagination slice for flat view
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedMonitors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Grouped monitors for folder view
  const groupedMonitors = useMemo(() => {
    const groups: Record<string, MonitorWithStats[]> = {};
    filtered.forEach((m) => {
      const g = m.group_name || 'Default';
      if (!groups[g]) groups[g] = [];
      groups[g].push(m);
    });
    return groups;
  }, [filtered]);

  // Selection handlers
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectPage = () => {
    const pageIds = paginatedMonitors.map((m) => m.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((m) => m.id)));
    }
  };

  const handleSelectGroup = (groupName: string) => {
    const groupItems = groupedMonitors[groupName] || [];
    const groupIds = groupItems.map((m) => m.id);
    const allSelected = groupIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  // Bulk Actions
  const runBulkAction = async (action: 'pause' | 'resume' | 'test' | 'delete' | 'set_group' | 'add_tag', value?: string) => {
    if (selectedIds.size === 0) return;
    if (action === 'delete') {
      const confirmed = window.confirm(`Are you sure you want to delete ${selectedIds.size} monitor(s)? This cannot be undone.`);
      if (!confirmed) return;
    }

    setBulkLoading(true);
    setFeedback(null);
    try {
      const res = await bulkAction({
        ids: Array.from(selectedIds),
        action,
        value,
      });

      setFeedback({ message: res.message, success: true });
      if (action === 'delete') {
        setSelectedIds(new Set());
      }
      onRefreshData?.();
    } catch (err: any) {
      setFeedback({ message: err.message || 'Bulk operation failed', success: false });
    } finally {
      setBulkLoading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleMoveGroup = () => {
    const group = window.prompt('Enter folder/group name to assign to selected monitors:', 'Websites');
    if (group && group.trim()) {
      runBulkAction('set_group', group.trim());
    }
  };

  const handleAddTag = () => {
    const tag = window.prompt('Enter tag to add to selected monitors (e.g. prod, critical):', '');
    if (tag && tag.trim()) {
      runBulkAction('add_tag', tag.trim());
    }
  };

  // Checkbox state for current page
  const pageIds = paginatedMonitors.map((m) => m.id);
  const isPageFullySelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const isPagePartiallySelected = pageIds.some((id) => selectedIds.has(id)) && !isPageFullySelected;

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
            feedback.success
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-red-950/40 border-red-500/40 text-red-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-muted-foreground hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Search & Primary Toolbar */}
      <div className="bg-card/40 p-3 sm:p-4 rounded-xl border border-border/60 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search monitors by name, URL, group, or #tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/50 border-border/80 h-9 text-xs"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 flex-wrap sm:flex-nowrap">
            {/* Status Segmented Buttons */}
            <div className="flex items-center bg-secondary/40 p-1 rounded-lg border border-border/60 text-xs flex-shrink-0">
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

            {/* Monitor Type Select */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-secondary/40 border border-border/60 rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 flex-shrink-0"
            >
              <option value="ALL">All Types</option>
              <option value="HTTP">HTTP(S)</option>
              <option value="PORT">TCP Port</option>
              <option value="SSL">SSL Cert</option>
              <option value="HEARTBEAT">Heartbeat</option>
            </select>

            {/* Folder / Group Select */}
            {allGroups.length > 0 && (
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="bg-secondary/40 border border-border/60 rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 h-8 flex-shrink-0"
              >
                <option value="ALL">📁 All Folders</option>
                {allGroups.map((g) => (
                  <option key={g} value={g}>
                    📁 {g}
                  </option>
                ))}
              </select>
            )}

            {/* View Mode & Density Toggles */}
            <div className="flex items-center bg-secondary/40 p-1 rounded-lg border border-border/60 text-xs flex-shrink-0 gap-1">
              <button
                onClick={() => setViewMode('flat')}
                title="List View"
                className={`p-1.5 rounded transition-all ${
                  viewMode === 'flat' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                title="Group by Folders"
                className={`p-1.5 rounded transition-all ${
                  viewMode === 'grouped' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Folder className="h-3.5 w-3.5" />
              </button>
              <div className="w-[1px] h-3 bg-border/80 mx-0.5" />
              <button
                onClick={toggleCompact}
                title={isCompact ? 'Switch to Comfortable view' : 'Switch to Compact high-density view'}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1.5 font-medium text-xs ${
                  isCompact
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">{isCompact ? 'Compact' : 'Comfortable'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tag Filters Row */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-border/40 text-xs scrollbar-none">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-1 flex-shrink-0">
              <Tag className="h-3 w-3" /> Tags:
            </span>
            <button
              onClick={() => setTagFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all flex-shrink-0 ${
                tagFilter === 'ALL'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-secondary/40 text-muted-foreground hover:text-foreground border border-border/50'
              }`}
            >
              #all
            </button>
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? 'ALL' : tag)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all flex items-center gap-1 flex-shrink-0 ${
                  tagFilter === tag
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-secondary/40 text-muted-foreground hover:text-foreground border border-border/50'
                }`}
              >
                <span>#{tag}</span>
                <span className="text-[9px] opacity-70">({count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Selection Header / Page Info Bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            {/* Page selection checkbox */}
            <button
              onClick={handleSelectPage}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
              title={isPageFullySelected ? 'Deselect page' : 'Select all on page'}
            >
              {isPageFullySelected ? (
                <CheckSquare className="h-4 w-4 text-emerald-500" />
              ) : isPagePartiallySelected ? (
                <MinusSquare className="h-4 w-4 text-emerald-500" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-[11px] font-medium">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select page'}
              </span>
            </button>

            {/* Select All Filtered helper */}
            {selectedIds.size > 0 && selectedIds.size < filtered.length && (
              <button
                onClick={handleSelectAllFiltered}
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Select all {filtered.length} monitors
              </button>
            )}

            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-muted-foreground hover:text-white underline ml-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Counts & Density Info */}
          <div className="flex items-center gap-3">
            <span>
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </span>

            {/* Page size selector */}
            <div className="flex items-center gap-1">
              <span className="text-[11px]">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-secondary/40 border border-border/60 rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Monitors List / Grouped View */}
      {filtered.length > 0 ? (
        viewMode === 'grouped' ? (
          // Grouped Folders View
          <div className="space-y-4">
            {Object.entries(groupedMonitors).map(([groupName, groupMonitors]) => {
              const isCollapsed = collapsedGroups.has(groupName);
              const upCount = groupMonitors.filter((m) => m.status === 'UP').length;
              const isAllUp = upCount === groupMonitors.length;
              const hasDown = groupMonitors.some((m) => m.status === 'DOWN');
              const groupIds = groupMonitors.map((m) => m.id);
              const isGroupFullySelected = groupIds.every((id) => selectedIds.has(id));

              return (
                <div
                  key={groupName}
                  className="border border-border/70 rounded-xl bg-card/30 backdrop-blur overflow-hidden transition-all"
                >
                  {/* Folder Group Header */}
                  <div className="p-3 sm:p-4 bg-secondary/30 flex items-center justify-between gap-3 border-b border-border/50">
                    <div className="flex items-center gap-2.5">
                      {/* Group selection checkbox */}
                      <button
                        onClick={() => handleSelectGroup(groupName)}
                        className="text-muted-foreground hover:text-white"
                        title="Select entire folder"
                      >
                        {isGroupFullySelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      <button
                        onClick={() => toggleGroupCollapse(groupName)}
                        className="flex items-center gap-2 text-left group"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-white" />
                        )}
                        <Folder className="h-4 w-4 text-amber-400" />
                        <span className="font-semibold text-white text-sm group-hover:text-emerald-400 transition-colors">
                          {groupName}
                        </span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-mono">
                          {groupMonitors.length}
                        </Badge>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                          isAllUp
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : hasDown
                            ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {upCount}/{groupMonitors.length} Operational
                      </span>
                    </div>
                  </div>

                  {/* Group items */}
                  {!isCollapsed && (
                    <div className="p-2 sm:p-3 space-y-2">
                      {groupMonitors.map((monitor) => (
                        <MonitorCard
                          key={monitor.id}
                          monitor={monitor}
                          isSelected={selectedIds.has(monitor.id)}
                          onToggleSelect={handleToggleSelect}
                          onPause={onPause}
                          onResume={onResume}
                          onDelete={onDelete}
                          onTest={onTest}
                          onSelect={onSelect}
                          compact={isCompact}
                          isViewer={isViewer}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Flat Paginated View
          <div className="space-y-2.5">
            {paginatedMonitors.map((monitor) => (
              <MonitorCard
                key={monitor.id}
                monitor={monitor}
                isSelected={selectedIds.has(monitor.id)}
                onToggleSelect={handleToggleSelect}
                onPause={onPause}
                onResume={onResume}
                onDelete={onDelete}
                onTest={onTest}
                onSelect={onSelect}
                compact={isCompact}
                isViewer={isViewer}
              />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-16 bg-card/30 rounded-2xl border border-dashed border-border/80 p-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No monitors found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {monitors.length === 0
              ? 'Get started by creating your first uptime monitor to watch websites, APIs or servers.'
              : 'No monitors match your current search and filter criteria.'}
          </p>
          {monitors.length === 0 && (
            <Button onClick={onAddClick} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
              Create Monitor
            </Button>
          )}
        </div>
      )}

      {/* Pagination Footer Controls (Flat view) */}
      {viewMode === 'flat' && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/60 pt-4 px-2">
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-xs"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-xs"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {/* Page number buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <React.Fragment key={p}>
                    {showEllipsis && <span className="px-1 text-xs text-muted-foreground">…</span>}
                    <Button
                      variant={p === currentPage ? 'default' : 'outline'}
                      size="sm"
                      className={`h-8 w-8 p-0 text-xs font-mono ${
                        p === currentPage ? 'bg-emerald-600 text-white hover:bg-emerald-500' : ''
                      }`}
                      onClick={() => setCurrentPage(p)}
                    >
                      {p}
                    </Button>
                  </React.Fragment>
                );
              })}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-xs"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="Next Page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-xs"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Floating Bulk Actions Bar (Disabled for Viewer role) */}
      {selectedIds.size > 0 && !isViewer && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 rounded-2xl shadow-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-white ring-1 ring-emerald-500/20">
            {/* Left Counter & Deselect */}
            <div className="flex items-center gap-2 pl-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold font-mono">
                {selectedIds.size} monitor{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-muted-foreground hover:text-white ml-1 underline"
              >
                Clear
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                disabled={bulkLoading}
                onClick={() => runBulkAction('pause')}
                className="h-8 text-xs gap-1 border-border/80 hover:bg-amber-500/20 hover:text-amber-300"
                title="Pause selected monitors"
              >
                <Pause className="h-3.5 w-3.5 text-amber-400" />
                Pause
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={bulkLoading}
                onClick={() => runBulkAction('resume')}
                className="h-8 text-xs gap-1 border-border/80 hover:bg-emerald-500/20 hover:text-emerald-300"
                title="Resume selected monitors"
              >
                <Play className="h-3.5 w-3.5 text-emerald-400" />
                Resume
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={bulkLoading}
                onClick={() => runBulkAction('test')}
                className="h-8 text-xs gap-1 border-border/80 hover:bg-blue-500/20 hover:text-blue-300"
                title="Trigger immediate probe check"
              >
                <Play className="h-3.5 w-3.5 text-blue-400" />
                Test Now
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={bulkLoading}
                onClick={handleMoveGroup}
                className="h-8 text-xs gap-1 border-border/80 hover:bg-purple-500/20 hover:text-purple-300"
                title="Assign folder/group"
              >
                <Folder className="h-3.5 w-3.5 text-purple-400" />
                Folder
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={bulkLoading}
                onClick={handleAddTag}
                className="h-8 text-xs gap-1 border-border/80 hover:bg-teal-500/20 hover:text-teal-300"
                title="Add tag"
              >
                <Tag className="h-3.5 w-3.5 text-teal-400" />
                Tag
              </Button>

              <Button
                size="sm"
                variant="destructive"
                disabled={bulkLoading}
                onClick={() => runBulkAction('delete')}
                className="h-8 text-xs gap-1 bg-red-600/80 hover:bg-red-600"
                title="Delete selected monitors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
