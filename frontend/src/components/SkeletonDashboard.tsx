import React from 'react';

export const SkeletonDashboard: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* 1. KPI Stats Cards Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Monitored Targets', color: 'border-blue-500/20' },
          { label: 'Operational Status', color: 'border-emerald-500/20' },
          { label: 'Active Incidents', color: 'border-slate-700/50' },
          { label: 'Avg Latency (24h)', color: 'border-purple-500/20' },
        ].map((item, idx) => (
          <div
            key={idx}
            className={`rounded-xl border ${item.color} bg-card/40 backdrop-blur p-5 relative overflow-hidden`}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-3 w-28 rounded-md skeleton-shimmer" />
                <div className="flex items-baseline gap-2">
                  <div className="h-7 w-16 rounded-md skeleton-shimmer" />
                  <div className="h-3 w-12 rounded-md skeleton-shimmer" />
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg skeleton-shimmer opacity-80" />
            </div>
            {/* Ambient hairline glow on top */}
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        ))}
      </div>

      {/* 2. Search & Filter Bar Skeleton */}
      <div className="bg-card/40 backdrop-blur rounded-xl border border-border/70 p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="h-9 sm:w-80 rounded-lg skeleton-shimmer" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
            <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
            <div className="h-8 w-16 rounded-lg skeleton-shimmer" />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-border/30">
          <div className="h-5 w-12 rounded-md skeleton-shimmer" />
          <div className="h-5 w-16 rounded-md skeleton-shimmer" />
          <div className="h-5 w-14 rounded-md skeleton-shimmer" />
          <div className="h-5 w-20 rounded-md skeleton-shimmer" />
        </div>
      </div>

      {/* 3. Monitor Cards Skeletons */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-xl border border-border/60 bg-card/40 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden"
          >
            {/* Left: Checkbox + Status + Title & URL */}
            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
              <div className="h-4 w-4 rounded skeleton-shimmer mt-0.5 sm:mt-0 flex-shrink-0" />
              <div className="h-3.5 w-3.5 rounded-full skeleton-shimmer flex-shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-4.5 w-40 rounded skeleton-shimmer" />
                  <div className="h-4 w-12 rounded skeleton-shimmer" />
                  <div className="h-4 w-8 rounded skeleton-shimmer" />
                </div>
                <div className="h-3 w-64 rounded skeleton-shimmer" />
              </div>
            </div>

            {/* Center: 30-Check Timeline Skeleton */}
            <div className="flex flex-col items-start md:items-end flex-shrink-0 space-y-1.5">
              <div className="h-3 w-24 rounded skeleton-shimmer" />
              <div className="flex items-center gap-[2px] h-6 px-1 py-0.5 bg-background/50 rounded border border-border/30">
                {Array.from({ length: 30 }).map((_, barIdx) => (
                  <div
                    key={barIdx}
                    className="w-1.5 h-4 rounded-sm skeleton-shimmer opacity-70"
                  />
                ))}
              </div>
            </div>

            {/* Right: Latency & Actions Skeleton */}
            <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-border/40 pt-2.5 md:pt-0">
              <div className="space-y-1 text-right">
                <div className="h-4 w-12 rounded skeleton-shimmer ml-auto" />
                <div className="h-2.5 w-16 rounded skeleton-shimmer ml-auto" />
              </div>
              <div className="flex items-center gap-1">
                <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
                <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
                <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
