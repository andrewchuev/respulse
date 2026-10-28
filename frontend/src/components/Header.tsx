import React, { useState, useRef, useEffect } from 'react';
import { Activity, Plus, Radio, Globe, Bell, AlertTriangle, Users, ChevronDown, Check } from 'lucide-react';
import { Button } from './ui/button';
import { UserProfile, UserRole } from '../types';

interface HeaderProps {
  currentView: 'dashboard' | 'channels' | 'incidents' | 'team' | 'status-page';
  setCurrentView: (view: 'dashboard' | 'channels' | 'incidents' | 'team' | 'status-page') => void;
  onOpenAddModal: () => void;
  totalActive: number;
  currentUser: UserProfile | null;
  availableUsers: UserProfile[];
  onSwitchUser: (email: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  onOpenAddModal,
  totalActive,
  currentUser,
  availableUsers,
  onSwitchUser,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isViewer = currentUser?.role === 'VIEWER';

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'OWNER':
        return (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
            👑 OWNER
          </span>
        );
      case 'ADMIN':
        return (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
            🛡️ ADMIN
          </span>
        );
      case 'ENGINEER':
        return (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            🛠️ ENGINEER
          </span>
        );
      case 'VIEWER':
        return (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-500/15 text-zinc-300 border border-zinc-500/30">
            👁️ VIEWER
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => setCurrentView('dashboard')}>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)] group-hover:scale-105 transition-all">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-lg bg-gradient-to-r from-white via-slate-100 to-emerald-300 bg-clip-text text-transparent">
                  ResPulse
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse shadow-[0_0_5px_rgba(16,185,129,1)]"></span>
                  LIVE
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Enterprise Synthetic Monitoring</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border/80">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'dashboard'
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('channels')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'channels'
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              Alerts & Channels
            </button>
            <button
              onClick={() => setCurrentView('incidents')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'incidents'
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Incidents & RCA
            </button>
            <button
              onClick={() => setCurrentView('team')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'team'
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Team & RBAC
            </button>
            <button
              onClick={() => setCurrentView('status-page')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'status-page'
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              Public Status
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span>Multi-node Probing</span>
            <span className="text-foreground font-mono font-medium">({totalActive} active)</span>
          </div>

          {/* User Profile / RBAC Switcher Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary border border-border/80 px-2.5 py-1.5 rounded-lg transition-colors text-left"
            >
              <img
                src={currentUser?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser?.name || 'User'}`}
                alt={currentUser?.name || 'User'}
                className="h-6 w-6 rounded-full border border-border object-cover"
              />
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-medium text-white truncate max-w-[110px] leading-tight">
                  {currentUser?.name || 'Loading...'}
                </span>
                <span className="text-[10px] leading-none text-muted-foreground">
                  {currentUser?.role}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 rounded-2xl shadow-2xl shadow-black/90 p-2.5 z-50 divide-y divide-slate-800/80 animate-in fade-in-0 zoom-in-95 duration-150">
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                      Authenticated Profile
                    </span>
                    {getRoleBadge(currentUser?.role)}
                  </div>
                  <div className="font-semibold text-white text-xs">{currentUser?.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{currentUser?.email}</div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-1">
                    Org: {currentUser?.team_name || 'ResPulse Enterprise'}
                  </div>
                </div>

                {/* Role Switcher for Demo / B2B evaluation */}
                <div className="p-2 space-y-1.5">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">
                    Switch Active User / Role (RBAC)
                  </span>

                  <div className="space-y-1">
                    {availableUsers.map((u) => {
                      const isActive = u.email === currentUser?.email;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            onSwitchUser(u.email);
                            setIsUserMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors text-left ${
                            isActive
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                              : 'hover:bg-secondary/40 text-muted-foreground hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`}
                              alt={u.name}
                              className="h-5 w-5 rounded-full object-cover"
                            />
                            <div className="min-w-0">
                              <div className="font-medium truncate text-white">{u.name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate">{u.role}</div>
                            </div>
                          </div>
                          {isActive && <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-1 pt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentView('team');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-center py-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
                  >
                    Manage Team & Permissions ➔
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={onOpenAddModal}
            size="sm"
            disabled={isViewer}
            className={`font-medium shadow-lg ${
              isViewer
                ? 'opacity-40 cursor-not-allowed bg-secondary text-muted-foreground'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
            }`}
            title={isViewer ? 'Requires Engineer role or higher to create monitors' : 'Create new synthetic monitor'}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Monitor
          </Button>
        </div>
      </div>
    </header>
  );
};
