import React, { useState, useRef, useEffect } from 'react';
import { Activity, Plus, Radio, Globe, Bell, AlertTriangle, Users, ChevronDown, Check, Sparkles, LogOut, KeyRound, CreditCard, LayoutDashboard, FileJson, Menu, X, Shield, Fingerprint } from 'lucide-react';
import { Button } from './ui/button';
import { UserProfile, UserRole } from '../types';
import { isTauri } from '../lib/sshClient';
import { getBiometricStatus, isBiometricEnabledLocally, promptBiometricAuth, setBiometricEnabledLocally } from '../lib/biometrics';
import { getAuthToken } from '../api/client';

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
  onOpenManageSubscription?: () => void;
  onOpenExportImport?: (tab: 'export' | 'import') => void;
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
  onOpenManageSubscription,
  onOpenExportImport,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasBioHardware, setHasBioHardware] = useState(false);
  const [isBioEnabled, setIsBioEnabled] = useState(isBiometricEnabledLocally);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTauri()) {
      getBiometricStatus().then((s) => setHasBioHardware(s.isAvailable));
    }
  }, []);

  const handleToggleBiometric = async () => {
    if (isBioEnabled) {
      setBiometricEnabledLocally(false);
      setIsBioEnabled(false);
    } else {
      const ok = await promptBiometricAuth('Confirm fingerprint to enable biometric login');
      if (ok) {
        setBiometricEnabledLocally(true, getAuthToken());
        setIsBioEnabled(true);
      }
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
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
    <header className={`sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 ${isTauri() ? 'pt-9 sm:pt-0' : 'pt-[env(safe-area-inset-top,0px)]'}`}>
      <div className="w-full max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 lg:gap-4">
        {/* Zone 1 (Left): Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group shrink-0" onClick={() => setCurrentView('dashboard')}>
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)] group-hover:scale-105 transition-all shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold tracking-tight text-base sm:text-lg bg-gradient-to-r from-white via-slate-100 to-emerald-300 bg-clip-text text-transparent">
                ResPulse
              </span>
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 sm:mr-1.5 animate-pulse shadow-[0_0_5px_rgba(16,185,129,1)]"></span>
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden xl:block">Enterprise Synthetic Monitoring</p>
          </div>
        </div>

        {/* Zone 2 (Center): Balanced Navigation Pill Bar */}
        <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 bg-secondary/50 p-1 rounded-xl border border-border/80 shadow-inner">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
            className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentView === 'status-page'
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span><span className="hidden xl:inline">Public </span>Status</span>
          </button>
          {!isTauri() && (
            <button
              onClick={() => setCurrentView('promo')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === 'promo'
                  ? 'bg-background text-foreground shadow-sm border border-border/60 text-amber-300'
                  : 'text-muted-foreground hover:text-amber-300'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span><span className="hidden xl:inline">Overview & </span>Promo</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setCurrentView('admin')}
              className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'admin'
                  ? 'bg-purple-500/20 text-purple-300 shadow-sm border border-purple-500/40'
                  : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10'
              }`}
            >
              <Shield className="h-3.5 w-3.5 text-purple-400 shrink-0" />
              <span>Super Admin</span>
            </button>
          )}
        </nav>

        {/* Zone 3 (Right): Monitoring Status, Upsell & User Actions */}
        <div className="flex items-center justify-self-end gap-1.5 sm:gap-3 shrink-0">
          <div className="hidden 2xl:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 shrink-0 whitespace-nowrap">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span><span className="hidden xl:inline">Multi-node </span>Probing</span>
            <span className="text-foreground font-mono font-medium whitespace-nowrap">({totalActive} active)</span>
          </div>

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
              <div className="hidden xl:flex flex-col">
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
                        if (currentUser?.team_plan === 'PRO') {
                          onOpenManageSubscription ? onOpenManageSubscription() : onOpenUpgradeModal?.();
                        } else {
                          onOpenUpgradeModal?.();
                        }
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold hover:brightness-125 transition-all ${
                        currentUser?.team_plan === 'FREE' ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                      title={currentUser?.team_plan === 'PRO' ? "Manage Pro subscription (WayForPay)" : "Upgrade to Pro (WayForPay)"}
                    >
                      {currentUser?.team_plan || 'PRO'} PLAN
                    </button>
                  </div>
                </div>

                {/* WayForPay Subscription Action */}
                {(currentUser?.team_plan === 'PRO' ? onOpenManageSubscription || onOpenUpgradeModal : onOpenUpgradeModal) && (
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (currentUser?.team_plan === 'PRO') {
                          onOpenManageSubscription ? onOpenManageSubscription() : onOpenUpgradeModal?.();
                        } else {
                          onOpenUpgradeModal?.();
                        }
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-xs text-left transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-emerald-400" />
                        <div>
                          <div className="font-semibold text-white group-hover:text-emerald-300 flex items-center gap-1">
                            {currentUser?.team_plan === 'PRO' ? 'Pro Subscription' : 'Upgrade to Pro'}
                            <span className="text-[10px] text-emerald-400 font-mono">$16/mo</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[170px]">
                            {currentUser?.team_plan === 'PRO' ? 'Active · Manage via WayForPay' : 'WayForPay Checkout'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-bold">&rarr;</span>
                    </button>
                  </div>
                )}

                {/* Configuration Export & Import Action */}
                {onOpenExportImport && (
                  <div className="p-2 pt-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenExportImport('export');
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-xs text-left transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4 text-cyan-400" />
                        <div>
                          <div className="font-semibold text-white group-hover:text-cyan-300">
                            Backup & Restore
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Export / Import Config
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 group-hover:text-cyan-400 font-bold">&rarr;</span>
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

                {isTauri() && hasBioHardware && (
                  <div className="p-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={handleToggleBiometric}
                      className="w-full flex items-center justify-between p-2 rounded-xl text-xs bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/50 transition-all text-slate-300"
                    >
                      <span className="flex items-center gap-2">
                        <Fingerprint className="h-4 w-4 text-emerald-400" />
                        <span>Fingerprint Login</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          isBioEnabled
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-700/40 text-slate-400 border border-slate-600/30'
                        }`}
                      >
                        {isBioEnabled ? 'ON' : 'OFF'}
                      </span>
                    </button>
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
            className={`font-medium shadow-lg shrink-0 px-2.5 sm:px-3 h-8 sm:h-9 ${
              isViewer
                ? 'opacity-40 cursor-not-allowed bg-secondary text-muted-foreground'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
            }`}
            title={isViewer ? 'Requires Engineer role or higher to create monitors' : 'Create new synthetic monitor'}
          >
            <Plus className="h-4 w-4 sm:mr-1.5 shrink-0" />
            <span className="hidden sm:inline">Add Monitor</span>
          </Button>

          {/* Mobile & Tablet Hamburger Menu Button (< lg) */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/80 text-slate-300 hover:text-white transition-colors shrink-0"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4 text-emerald-400" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Navigation Dropdown Menu (< lg) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-border/80 bg-slate-900/98 backdrop-blur-2xl px-3 sm:px-4 py-3 space-y-3 animate-in slide-in-from-top-2 duration-150 shadow-2xl">
          <nav className="grid grid-cols-2 gap-1.5 text-xs font-medium">
            <button
              onClick={() => {
                setCurrentView('dashboard');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left ${
                currentView === 'dashboard'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-white font-semibold'
                  : 'bg-secondary/30 hover:bg-secondary/60 text-slate-300'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => {
                setCurrentView('channels');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left ${
                currentView === 'channels'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-white font-semibold'
                  : 'bg-secondary/30 hover:bg-secondary/60 text-slate-300'
              }`}
            >
              <Bell className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Alert Channels</span>
            </button>

            <button
              onClick={() => {
                setCurrentView('incidents');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left ${
                currentView === 'incidents'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-white font-semibold'
                  : 'bg-secondary/30 hover:bg-secondary/60 text-slate-300'
              }`}
            >
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Incidents & RCA</span>
            </button>

            <button
              onClick={() => {
                setCurrentView('team');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left ${
                currentView === 'team'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-white font-semibold'
                  : 'bg-secondary/30 hover:bg-secondary/60 text-slate-300'
              }`}
            >
              <Users className="h-4 w-4 text-blue-400 shrink-0" />
              <span>Team & RBAC</span>
            </button>

            <button
              onClick={() => {
                setCurrentView('status-page');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left ${
                currentView === 'status-page'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-white font-semibold'
                  : 'bg-secondary/30 hover:bg-secondary/60 text-slate-300'
              }`}
            >
              <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>Public Status</span>
            </button>

            {!isTauri() && (
              <button
                onClick={() => {
                  setCurrentView('promo');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left ${
                  currentView === 'promo'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-white font-semibold'
                    : 'bg-secondary/30 hover:bg-secondary/60 text-slate-300'
                }`}
              >
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Overview & Promo</span>
              </button>
            )}

            {isTauri() && hasBioHardware && (
              <button
                onClick={() => {
                  handleToggleBiometric();
                }}
                className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-left text-xs text-slate-200"
              >
                <span className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Fingerprint Login</span>
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${isBioEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/40 text-slate-400'}`}>
                  {isBioEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => {
                  setCurrentView('admin');
                  setIsMobileMenuOpen(false);
                }}
                className={`col-span-2 flex items-center gap-2 p-2.5 rounded-lg transition-colors text-left ${
                  currentView === 'admin'
                    ? 'bg-purple-500/20 border border-purple-500/40 text-purple-200 font-semibold'
                    : 'bg-purple-950/20 hover:bg-purple-950/40 border border-purple-500/20 text-purple-300'
                }`}
              >
                <Shield className="h-4 w-4 text-purple-400 shrink-0" />
                <span>Super-Admin Console</span>
              </button>
            )}
          </nav>

          {/* Quick Mobile Action Bar */}
          {(onOpenExportImport || (currentUser?.team_plan === 'FREE' && onOpenUpgradeModal)) && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              {onOpenExportImport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenExportImport('export');
                  }}
                  className="flex-1 h-8 text-xs border-slate-700 bg-slate-800/80 text-slate-200 gap-1.5"
                >
                  <FileJson className="h-3.5 w-3.5 text-cyan-400" />
                  Backup & Restore
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};
