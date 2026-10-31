import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  Mail,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  fetchCurrentUser,
  loginUser,
  registerUser,
  setAuthSession,
} from '../api/client';
import { UserProfile } from '../types';
import {
  getBiometricStatus,
  getSavedBiometricSession,
  isBiometricEnabledLocally,
  promptBiometricAuth,
  setBiometricEnabledLocally,
} from '../lib/biometrics';

interface MobileAuthScreenProps {
  onSuccess: (user: UserProfile) => void;
}

export const MobileAuthScreen: React.FC<MobileAuthScreenProps> = ({
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Options
  const [rememberMe, setRememberMe] = useState(true);
  const [enableBiometricOption, setEnableBiometricOption] = useState(true);

  // Biometrics state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [canQuickBiometric, setCanQuickBiometric] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if biometric hardware exists on device
    getBiometricStatus().then((status) => {
      setBiometricAvailable(status.isAvailable);
      const hasSavedSession = !!getSavedBiometricSession();
      const isBioOn = isBiometricEnabledLocally();
      if (status.isAvailable && hasSavedSession && isBioOn) {
        setCanQuickBiometric(true);
      }
    });

    // Populate remembered email if present
    const lastEmail = localStorage.getItem('respulse_last_email');
    if (lastEmail) {
      setEmail(lastEmail);
    }
  }, []);

  const handleQuickBiometric = async () => {
    setError(null);
    setLoading(true);
    try {
      const savedToken = getSavedBiometricSession();
      if (!savedToken) {
        throw new Error('Saved session not found. Please sign in with your password.');
      }

      const passed = await promptBiometricAuth('Confirm fingerprint to sign in to ResPulse');
      if (!passed) {
        setLoading(false);
        return;
      }

      setAuthSession(savedToken);
      const user = await fetchCurrentUser();
      onSuccess(user);
    } catch (err: any) {
      setError(err?.message || 'Biometric authentication failed');
    } finally {
      setLoading(false);
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
          setAuthSession(res.token);
          if (biometricAvailable && enableBiometricOption) {
            setBiometricEnabledLocally(true, res.token);
          }
          if (rememberMe) {
            localStorage.setItem('respulse_last_email', email);
          }
          const user = await fetchCurrentUser();
          onSuccess(user);
        } else {
          setError('Confirmation email sent to your address.');
        }
      } else {
        const res = await loginUser({ email, password });
        setAuthSession(res.token);

        if (rememberMe) {
          localStorage.setItem('respulse_last_email', email);
        }

        if (biometricAvailable && enableBiometricOption) {
          setBiometricEnabledLocally(true, res.token);
        }

        const user = await fetchCurrentUser();
        onSuccess(user);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col justify-between px-4 py-6 sm:px-8 relative overflow-y-auto pt-[max(env(safe-area-inset-top,1rem),1.5rem)] pb-[max(env(safe-area-inset-bottom,1rem),1.5rem)]">
      {/* Background ambient glows */}
      <div className="pointer-events-none fixed top-0 left-1/3 -z-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-10 right-1/4 -z-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-[120px]" />

      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mt-2 mb-6">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 via-teal-500/15 to-cyan-500/25 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] mb-3">
          <Activity className="h-8 w-8 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-300 bg-clip-text text-transparent">
            ResPulse
          </h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse shadow-[0_0_5px_rgba(16,185,129,1)]" />
            MOBILE SRE
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Infrastructure monitoring and rapid incident response
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto bg-card/80 backdrop-blur-md border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Quick Biometric Access if enrolled */}
        {canQuickBiometric && (
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
              <Fingerprint className="h-5 w-5 animate-pulse" />
              <span>Quick Biometric Sign-In</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Use fingerprint scanner for instant console access
            </p>
            <Button
              type="button"
              onClick={handleQuickBiometric}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 h-11"
            >
              <Fingerprint className="h-5 w-5" />
              {loading ? 'Verifying...' : 'Sign In with Fingerprint'}
            </Button>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                <span className="bg-card px-2 text-muted-foreground">or use password</span>
              </div>
            </div>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-secondary/50 rounded-xl border border-border/60 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
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
                ? 'bg-background text-foreground shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  Company / Project Name
                </label>
                <Input
                  required
                  placeholder="Acme DevOps Team"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-secondary/40 border-border/70 h-10 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                  Your Name
                </label>
                <Input
                  required
                  placeholder="Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-secondary/40 border-border/70 h-10 text-sm"
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-emerald-400" />
              Email Address
            </label>
            <Input
              required
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="sre@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary/40 border-border/70 h-10 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-400" />
              Password
            </label>
            <div className="relative">
              <Input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/40 border-border/70 h-10 text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="pt-1 space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-border text-emerald-500 focus:ring-emerald-500 bg-secondary/50 h-4 w-4"
              />
              <span>Remember session on this device</span>
            </label>

            {biometricAvailable && (
              <label className="flex items-center gap-2 cursor-pointer select-none text-emerald-400/90 hover:text-emerald-300">
                <input
                  type="checkbox"
                  checked={enableBiometricOption}
                  onChange={(e) => setEnableBiometricOption(e.target.checked)}
                  className="rounded border-border text-emerald-500 focus:ring-emerald-500 bg-secondary/50 h-4 w-4"
                />
                <span className="flex items-center gap-1">
                  <Fingerprint className="h-3.5 w-3.5" />
                  Enable fingerprint login
                </span>
              </label>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium h-11 text-sm shadow-[0_0_15px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span>Processing...</span>
            ) : mode === 'login' ? (
              <>
                <span>Sign In to Console</span>
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Create Account</span>
                <Sparkles className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-muted-foreground/60 font-mono mt-6">
        <span>ResPulse Mobile · Zero-Knowledge Security</span>
      </div>
    </div>
  );
};
