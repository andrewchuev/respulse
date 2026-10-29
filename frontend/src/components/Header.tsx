import React, { useState, useRef, useEffect } from 'react';
import { Activity, Plus, Radio, Globe, Bell, AlertTriangle, Users, ChevronDown, Check, Sparkles, LogOut, KeyRound, CreditCard, BarChart3, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/button';
import { UserProfile, UserRole } from '../types';

interface HeaderProps {
  currentView: 'dashboard' | 'channels' | 'incidents' | 'team' | 'status-page' | 'promo' | 'admin';
  setCurrentView: (view: 'dashboard' | 'channels' | 'incidents' | 'team' | 'status-page' | 'promo' | 'admin') => void;
  onOpenAddModal: () => void;
  totalActive: number;
  currentUser: UserProfile | null;
  availableUsers: UserProfile[];
  demoMode: boolean;
  isAdmin?: boolean;
  onSwitchUser: (email: string) => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
  onSignOut?: () => void;
  onOpenUpgradeModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  onOpenAddModal,
  totalActive,
  currentUser,
  availableUsers,
  demoMode,
  isAdmin = false,
  onSwitchUser,
  onOpenAuth,
  onSignOut,
  onOpenUpgradeModal,
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
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between md:grid md:grid-cols-[auto_1fr_auto] gap-4">
        {/* Zone 1 (Left): Brand Identity */}
        <div className="flex items-center gap-2.5 cursor-pointer group justify-self-start shrink-0" onClick={() => setCurrentView('dashboard')}>
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)] group-hover:scale-105 transition-all shrink-0">
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
            <p className="text-[11px] text-muted-foreground hidden xl:block">Enterprise Synthetic Monitoring</p>
          </div>
        </div>

        {/* Zone 2 (Center): Balanced Navigation Pill Bar */}
        <nav className="hidden md:flex items-center justify-self-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border/80 shadow-inner">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentView === 'dashboard'
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setCurrentView('channels')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentView === 'channels'
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bell className="h-3.5 w-3.5 shrink-0" />
            <span>Alerts<span className="hidden xl:inline"> & Channels</span></span>
          </button>
          <button
            onClick={() => setCurrentView('incidents')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentView === 'incidents'
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Incidents<span className="hidden xl:inline"> & RCA</span></span>
          </button>
          <button
            onClick={() => setCurrentView('team')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentView === 'team'
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>Team<span className="hidden xl:inline"> & RBAC</span></span>
          </button>
          <button
            onClick={() => setCurrentView('status-page')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentView === 'status-page'
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span><span className="hidden xl:inline">Public </span>Status</span>
          </button>
          <button
            onClick={() => setCurrentView('promo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentView === 'promo'
                ? 'bg-background text-foreground shadow-sm border border-border/60 text-amber-300'
                : 'text-muted-foreground hover:text-amber-300'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span><span className="hidden xl:inline">Overview & </span>Promo</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'admin'
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 shrink-0" />
              <span>Report</span>
            </button>
          )}
        </nav>

        {/* Zone 3 (Right): Monitoring Status, Upsell & User Actions */}
        <div className="flex items-center justify-self-end gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 shrink-0 whitespace-nowrap">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span><span className="hidden xl:inline">Multi-node </span>Probing</span>
            <span className="text-foreground font-mono font-medium whitespace-nowrap">({totalActive} active)</span>
          </div>

          {/* Upgrade to Pro CTA in Header */}
          {currentUser?.team_plan === 'FREE' && onOpenUpgradeModal && (
            <Button
              size="sm"
              onClick={onOpenUpgradeModal}
              className="hidden md:flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse shrink-0"
              title="Upgrade to Pro via FastSpring ($8/mo excl. VAT)"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span className="whitespace-nowrap">Upgrade to Pro ($8/mo + VAT)</span>
            </Button>
          )}

          {/* User Profile / RBAC Switcher Dropdown */}
          <div className="relative shrink-0" ref={menuRef}>
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
                <span className="text-xs font-medium text-white truncate max-w-[110px] leading-tight flex items-center gap-1">
                  {currentUser?.name || 'Loading...'}
                  <span className={`text-[8px] font-mono px-1 rounded font-bold ${
                    currentUser?.team_plan === 'FREE' ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {currentUser?.team_plan || 'PRO'}
                  </span>
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
                  <div className="flex items-center justify-between text-[10px] font-mono mt-1 pt-1 border-t border-slate-800/60">
                    <span className="text-emerald-400">Org: {currentUser?.team_name || 'ResPulse Enterprise'}</span>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenUpgradeModal?.();
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold hover:brightness-125 transition-all ${
                        currentUser?.team_plan === 'FREE' ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                      title="Manage Pro subscription (FastSpring)"
                    >
                      {currentUser?.team_plan || 'PRO'} PLAN
                    </button>
                  </div>
                </div>

                {/* FastSpring Subscription Action */}
                {onOpenUpgradeModal && (
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenUpgradeModal();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-xs text-left transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-emerald-400" />
                        <div>
                          <div className="font-semibold text-white group-hover:text-emerald-300 flex items-center gap-1">
                            {currentUser?.team_plan === 'PRO' ? 'FastSpring Billing' : 'Upgrade to Pro'}
                            <span className="text-[10px] text-emerald-400 font-mono">$8/mo</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[170px]">
                            Store: reslab (FastSpring)
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-bold">&rarr;</span>
                    </button>
                  </div>
                )}

                {/* Role Switcher for Demo / B2B evaluation; the server only honours it in demo mode */}
                {demoMode && (
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
                )}

                <div className="p-1.5 pt-2 flex items-center justify-between border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentView('team');
                      setIsUserMenuOpen(false);
                    }}
                    className="py-1 text-xs text-muted-foreground hover:text-white transition-colors"
                  >
                    Manage Team ➔
                  </button>
                  <div className="flex items-center gap-1.5">
                    {onOpenAuth && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenAuth('login');
                        }}
                        className="flex items-center gap-1 py-1 px-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                        title="Sign in with credentials"
                      >
                        <KeyRound className="h-3 w-3 text-cyan-400" />
                        Auth
                      </button>
                    )}
                    {onSignOut && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onSignOut();
                        }}
                        className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-all font-medium"
                      >
                        <LogOut className="h-3 w-3" />
                        Sign Out
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={onOpenAddModal}
            size="sm"
            disabled={isViewer}
            className={`font-medium shadow-lg shrink-0 ${
              isViewer
                ? 'opacity-40 cursor-not-allowed bg-secondary text-muted-foreground'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
            }`}
            title={isViewer ? 'Requires Engineer role or higher to create monitors' : 'Create new synthetic monitor'}
          >
            <Plus className="h-4 w-4 mr-1.5 shrink-0" />
            <span>Add Monitor</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
