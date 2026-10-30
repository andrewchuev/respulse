import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Check,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { cancelWayForPaySubscription } from '../api/client';
import { UserProfile } from '../types';

interface ManageSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onSubscriptionCanceled?: () => void;
}

const proFeatures = [
  'Up to 100 Synthetic Monitors (HTTP, SSL, TCP, Heartbeat)',
  'Turbo 10-Second probe intervals',
  'Advanced 5-field Cron syntax & IANA timezones',
  'Full 64KB STDERR / execution log capture',
  'Prometheus metrics exporter (/api/metrics)',
  'Tag-based alert routing (filter_tags)',
  'Up to 10 Team Members with 4-tier RBAC',
  '90-day latency retention & SRE incident post-mortems',
  'Custom domain for public status pages',
];

const downgradeConsequences = [
  { label: 'Minimum probe interval', pro: '10 seconds', free: '60 seconds' },
  { label: 'Maximum synthetic monitors', pro: '100 targets', free: '20 targets' },
  { label: 'Team members & seats', pro: 'Up to 10 seats', free: '1 seat' },
  { label: 'Metric history retention', pro: '90 days', free: '30 days' },
];

const cancelReasons = [
  'Temporary project or evaluation completed',
  'Too expensive for current monitoring scope',
  'Missing required features or integrations',
  'Switching to another synthetic monitoring tool',
  'Other reason',
];

export const ManageSubscriptionModal: React.FC<ManageSubscriptionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSubscriptionCanceled,
}) => {
  const [view, setView] = useState<'overview' | 'confirm' | 'success'>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');

  const canManage = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  const handleModalClose = () => {
    if (loading) return;
    setError(null);
    setView('overview');
    setSelectedReason('');
    onClose();
  };

  const handleConfirmCancel = async () => {
    setLoading(true);
    setError(null);
    try {
      await cancelWayForPaySubscription();
      setView('success');
      if (onSubscriptionCanceled) {
        onSubscriptionCanceled();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription via WayForPay');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishSuccess = () => {
    handleModalClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-lg bg-slate-950 border border-slate-800 text-slate-100 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* VIEW 1: OVERVIEW */}
        {view === 'overview' && (
          <>
            <DialogHeader className="text-left space-y-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono text-[10px] uppercase gap-1.5 flex items-center"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Pro Subscription
                </Badge>
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                  <Lock className="h-3 w-3 text-emerald-400" />
                  <span>WayForPay SSL</span>
                </div>
              </div>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                ResPulse Pro Subscription
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Your workspace is active on the Pro plan with automatic monthly recurring renewal.
              </DialogDescription>
            </DialogHeader>

            {/* Plan Overview Card */}
            <div className="bg-slate-900/70 border border-emerald-500/30 rounded-xl p-4 space-y-3 mt-1">
              <div className="flex items-baseline justify-between border-b border-white/5 pb-3">
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>Monthly Subscription</span>
                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                      CURRENT PLAN
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Billed via WayForPay · Renews automatically
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-white">$16.00</span>
                  <span className="text-xs text-slate-400 font-mono"> / mo</span>
                </div>
              </div>

              {/* Workspace and Role Info */}
              <div className="grid grid-cols-2 gap-2 py-1 text-[11px] font-mono">
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">Organization</div>
                  <div className="text-slate-200 font-medium truncate">{currentUser?.team_name || 'My Workspace'}</div>
                </div>
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">Your Role</div>
                  <div className="text-slate-200 font-medium">{currentUser?.role || 'MEMBER'}</div>
                </div>
              </div>

              {/* Active Features list */}
              <div className="space-y-1.5 pt-1 text-xs text-slate-300">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                  Included Pro Capabilities
                </div>
                {proFeatures.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Provider info */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Managed securely via <strong>WayForPay</strong></span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">Recurring 30-day billing</span>
            </div>

            {/* Role restriction notice if not owner/admin */}
            {!canManage ? (
              <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-200">Owner / Admin Permissions Required</div>
                  <div className="text-[11px] text-amber-300/80 mt-0.5">
                    Only workspace Owners and Administrators can cancel or modify subscription billing. Contact your team admin to adjust plan settings.
                  </div>
                </div>
              </div>
            ) : (
              /* Danger Zone / Cancellation trigger for Owner/Admin */
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-300">Subscription Cancellation</div>
                  <div className="text-[11px] text-slate-500">Stop recurring charges and revert to Free</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setView('confirm')}
                  className="border-red-900/60 hover:bg-red-950/40 text-xs text-red-400 hover:text-red-300 h-8 gap-1"
                >
                  Cancel Subscription
                </Button>
              </div>
            )}

            <DialogFooter className="pt-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleModalClose}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 px-5 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
              >
                Keep Pro Plan
              </Button>
            </DialogFooter>
          </>
        )}

        {/* VIEW 2: CONFIRM CANCELLATION */}
        {view === 'confirm' && (
          <>
            <DialogHeader className="text-left space-y-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className="border-red-500/40 text-red-400 bg-red-500/10 font-mono text-[10px] uppercase gap-1"
                >
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                  Subscription Downgrade
                </Badge>
                <div className="text-[11px] font-mono text-slate-400">Step 2 of 2</div>
              </div>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                Cancel ResPulse Pro Subscription?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Canceling will stop your WayForPay recurring charges and revert your workspace to the Free plan.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            {/* Downgrade Impact Comparison */}
            <div className="bg-slate-900/70 border border-red-950/50 rounded-xl p-3.5 space-y-2.5">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-400" />
                <span>What happens upon cancellation:</span>
              </div>
              <div className="grid grid-cols-1 divide-y divide-white/5 text-xs">
                {downgradeConsequences.map((item, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between">
                    <span className="text-slate-400">{item.label}</span>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-emerald-400 line-through opacity-80">{item.pro}</span>
                      <span className="text-slate-500">&rarr;</span>
                      <span className="text-amber-300 font-semibold">{item.free}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Terms Note */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-[11px] text-slate-300 space-y-1">
              <div className="font-semibold text-white flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>No future charges will be billed</span>
              </div>
              <div className="text-slate-400 leading-relaxed">
                The regular recurring payment in WayForPay will be revoked immediately. No further $16.00/mo charges will occur.
              </div>
            </div>

            {/* Feedback Reason Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Why are you canceling? <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <div className="space-y-1.5">
                {cancelReasons.map((reason, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      selectedReason === reason
                        ? 'border-emerald-500/50 bg-emerald-950/20 text-white'
                        : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-850'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      className="accent-emerald-500 h-3.5 w-3.5"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-3 flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setView('overview')}
                disabled={loading}
                className="border-slate-800 hover:bg-slate-900 text-xs text-slate-300 gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleModalClose}
                disabled={loading}
                className="border-emerald-600/40 text-emerald-300 hover:bg-emerald-950/30 text-xs"
              >
                Keep My Pro Plan
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmCancel}
                disabled={loading}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold text-xs h-9 gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Canceling Subscription...</span>
                  </>
                ) : (
                  <span>Confirm Cancellation</span>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* VIEW 3: SUCCESS */}
        {view === 'success' && (
          <>
            <DialogHeader className="text-left space-y-2">
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono text-[10px] uppercase gap-1"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Status: Canceled
              </Badge>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                Subscription Successfully Canceled
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Your workspace has reverted to the Free plan. WayForPay recurring billing has been stopped.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3 mt-1 text-xs text-slate-300 leading-relaxed">
              <p>
                Your recurring subscription of <strong>$16.00/mo</strong> via WayForPay has been terminated. No further charges will be billed to your payment method.
              </p>
              <p className="text-slate-400">
                You can continue using ResPulse on the Free plan (up to 20 monitors, 60-second probe intervals), and you can upgrade back to Pro at any time directly from the dashboard.
              </p>
            </div>

            <DialogFooter className="pt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleFinishSuccess}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 px-6 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
