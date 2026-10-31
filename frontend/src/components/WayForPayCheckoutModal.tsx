import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  CreditCard,
  Check,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { createWayForPayCheckoutSession } from '../api/client';

interface WayForPayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
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
];

export const WayForPayCheckoutModal: React.FC<WayForPayCheckoutModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createWayForPayCheckoutSession();
      if (res.url) {
        window.location.href = res.url;
      } else {
        throw new Error('No redirect URL returned by payment gateway');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize WayForPay checkout session');
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-950 border border-slate-800 text-slate-100 p-6 shadow-2xl">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono text-[10px] uppercase">
              Pro Subscription
            </Badge>
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
              <Lock className="h-3 w-3 text-emerald-400" />
              <span>WayForPay SSL</span>
            </div>
          </div>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Upgrade to ResPulse Pro
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Activate high-frequency monitoring, Cron scheduling, and team collaboration for production infrastructure.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Pricing Summary Box */}
        <div className="bg-slate-900/70 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-baseline justify-between border-b border-white/5 pb-3">
            <div>
              <div className="text-xs font-semibold text-white">Monthly Subscription</div>
              <div className="text-[11px] text-slate-400">Automatic renewal, cancel anytime</div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-white">$16.00</span>
              <span className="text-xs text-slate-400 font-mono"> / mo</span>
            </div>
          </div>

          {/* Features list */}
          <div className="space-y-2 pt-1 text-xs text-slate-300">
            {proFeatures.map((feat, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Provider Note */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Secure 256-bit payment by <strong>WayForPay</strong></span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">Visa / Mastercard / GPay / Apple Pay</span>
        </div>

        <DialogFooter className="pt-2 flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="border-slate-800 hover:bg-slate-900 text-xs text-slate-300"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleCheckout}
            disabled={loading}
            className="w-full sm:w-auto flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            {loading ? (
              <span>Redirecting to WayForPay...</span>
            ) : (
              <>
                <CreditCard className="h-3.5 w-3.5" />
                <span>Pay $16.00 with WayForPay &rarr;</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
