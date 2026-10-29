import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Shield,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { loginUser, registerUser, resendVerification, switchUser } from '../api/client';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  demoMode?: boolean;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  demoMode = false,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set once the account exists but its email still has to be confirmed.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPendingEmail(null);
      setResendNote(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!pendingEmail || resendCooldown > 0) return;
    setResendNote(null);
    try {
      await resendVerification(pendingEmail);
      setResendNote('A new link is on its way. Check your inbox and spam folder.');
      setResendCooldown(60);
    } catch (err: any) {
      setResendNote(err?.message || 'Could not send the email.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await registerUser({
          company_name: companyName,
          name,
          email,
          password,
        });
        if ('token' in res) {
          onSuccess(res.user);
          onClose();
        } else {
          setPendingEmail(res.email);
          setResendCooldown(60);
        }
      } else {
        const res = await loginUser({
          email,
          password,
        });
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      if (err?.code === 'EMAIL_NOT_VERIFIED') {
        setPendingEmail(email);
      } else {
        setError(err?.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string) => {
    setError(null);
    setLoading(true);
    try {
      const user = await switchUser(demoEmail);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  if (pendingEmail) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[460px] bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl shadow-black/90 p-6">
          <DialogHeader className="text-center sm:text-center pb-2 pr-0 sm:pr-0">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Mail className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-extrabold tracking-tight text-white">Check your inbox</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              We sent a confirmation link to <strong className="text-slate-200">{pendingEmail}</strong>. Open it to
              finish signing in. The link works once and expires in 24 hours.
            </DialogDescription>
          </DialogHeader>

          {resendNote && <p className="text-center text-xs text-emerald-300">{resendNote}</p>}

          <div className="flex flex-col items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="border-slate-700 text-xs text-slate-200"
            >
              {resendCooldown > 0 ? `Resend email (${resendCooldown}s)` : 'Resend email'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setPendingEmail(null);
                setMode('register');
              }}
              className="text-[11px] text-slate-500 hover:text-emerald-400"
            >
              Wrong address? Go back
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl shadow-black/90 p-6 overflow-hidden">
        {/* Glow backdrop behind modal */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        <DialogHeader className="text-center sm:text-center pb-2 pr-0 sm:pr-0">
          <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            <Activity className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl font-extrabold tracking-tight text-white">
            {mode === 'login' ? 'Sign In to ResPulse' : 'Create Organization'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            {mode === 'login'
              ? 'Access real-time synthetic monitors, incidents & telemetry'
              : 'Launch high-performance uptime monitoring for your team'}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-white/5 text-xs font-medium mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-slate-800 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  Organization / Team Name
                </label>
                <Input
                  required
                  placeholder="e.g. Acme Cloud Operations"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 text-xs h-10"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                  Your Full Name
                </label>
                <Input
                  required
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 text-xs h-10"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-emerald-400" />
              Work Email Address
            </label>
            <Input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 text-xs h-10 font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                Password
              </label>
              {mode === 'login' && demoMode && (
                <span className="text-[11px] text-slate-500 hover:text-emerald-400 cursor-pointer">
                  Demo password: <code className="text-emerald-400 font-mono">password123</code>
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950/60 border-slate-800 text-white placeholder:text-slate-500 text-xs h-10 pr-9 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-[0_0_20px_rgba(16,185,129,0.35)] gap-2 mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating...</span>
              </span>
            ) : mode === 'login' ? (
              <>
                <KeyRound className="h-4 w-4" />
                <span>Sign In to Dashboard</span>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-emerald-200" />
                <span>Create Workspace & Start Monitoring</span>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </>
            )}
          </Button>
        </form>

        {/* Quick Demo Personas Login */}
        {demoMode && (
        <div className="mt-5 pt-4 border-t border-white/5 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              Instant Sandbox Access
            </span>
            <span className="text-slate-500">1-click demo personas</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickDemoLogin('alice@respulse.internal')}
              className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-all group"
            >
              <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:scale-105">
                👑
              </div>
              <div className="truncate">
                <div className="font-semibold text-white truncate text-[11px]">Alice (Owner)</div>
                <div className="text-[10px] text-slate-500 font-mono">Full Control</div>
              </div>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickDemoLogin('charlie@respulse.internal')}
              className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-all group"
            >
              <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:scale-105">
                🛠️
              </div>
              <div className="truncate">
                <div className="font-semibold text-white truncate text-[11px]">Charlie (Engineer)</div>
                <div className="text-[10px] text-slate-500 font-mono">Ops & Incidents</div>
              </div>
            </button>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
