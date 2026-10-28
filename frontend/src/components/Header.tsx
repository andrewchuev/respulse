import React from 'react';
import { Activity, Plus, Radio, Globe, Bell } from 'lucide-react';
import { Button } from './ui/button';

interface HeaderProps {
  currentView: 'dashboard' | 'channels' | 'status-page';
  setCurrentView: (view: 'dashboard' | 'channels' | 'status-page') => void;
  onOpenAddModal: () => void;
  totalActive: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  onOpenAddModal,
  totalActive,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-lg text-white">ResPulse</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                  LIVE
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Uptime & Synthetic Monitoring</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                currentView === 'dashboard'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('channels')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                currentView === 'channels'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              Alerts & Channels
            </button>
            <button
              onClick={() => setCurrentView('status-page')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                currentView === 'status-page'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              Public Status
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-md border border-border/50">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span>Multi-node Probing</span>
            <span className="text-foreground font-mono font-medium">({totalActive} active)</span>
          </div>

          <Button onClick={onOpenAddModal} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-950/40">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Monitor
          </Button>
        </div>
      </div>
    </header>
  );
};
