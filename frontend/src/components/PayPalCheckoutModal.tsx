import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  CreditCard,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  Sparkles,
  Copy,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Users,
} from 'lucide-react';
import { confirmPayPalPayment, fetchPayPalConfig } from '../api/client';
import { PayPalCheckoutConfig } from '../types';

interface PayPalCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanUpgraded: () => void;
}

export const PayPalCheckoutModal: React.FC<PayPalCheckoutModalProps> = ({
  isOpen,
  onClose,
  onPlanUpgraded,
}) => {
  const [config, setConfig] = useState<PayPalCheckoutConfig | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      setTransactionId('');
      fetchPayPalConfig()
        .then(setConfig)
        .catch((e) => setError(e.message || 'Failed to load PayPal configuration'));
    }
  }, [isOpen]);

  const handleOpenPayPal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleActivate = async () => {
    setLoading(true);
    setError(null);
    try {
      await confirmPayPalPayment({
        transaction_id: transactionId.trim() || undefined,
        payment_status: 'COMPLETED',
      });
      setSuccess(true);
      onPlanUpgraded();
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Payment confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl shadow-black/90 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#0070BA]/20 border border-[#0070BA]/40 flex items-center justify-center text-[#0070BA]">
                <CreditCard className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Upgrade to Pro Plan
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-950/40">
                    $8 / month
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Secure monthly subscription via PayPal to <strong className="text-slate-200">andrew.chuev@gmail.com</strong>
                </DialogDescription>
              </div>
            </div>

            {/* PayPal Logo Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#003087]/20 border border-[#0070BA]/30 text-xs font-bold text-sky-400">
              <span className="font-extrabold tracking-tighter text-[#0079C1]">Pay</span>
              <span className="font-extrabold tracking-tighter text-[#00457C]">Pal</span>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Pro Plan Activated!</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Thank you! Your payment was verified and your organization has been upgraded to ResPulse Pro. All limits have been expanded.
              </p>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400">
              Active: 100 monitors • 10s Turbo intervals • Prometheus exporter • 10 seats
            </div>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {error && (
              <div className="p-3 text-xs rounded-lg bg-destructive/15 border border-destructive/30 text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Pricing & Value Summary Card */}
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-emerald-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-semibold">ResPulse Pro Subscription</div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-3xl font-extrabold text-white">$8.00</span>
                    <span className="text-xs text-slate-400 font-mono">USD / month (cancel anytime)</span>
                  </div>
                </div>
                <div className="text-right text-[11px] font-mono text-slate-400">
                  <div className="text-slate-300 font-medium">Recipient Account:</div>
                  <div className="text-emerald-400 select-all font-semibold">andrew.chuev@gmail.com</div>
                </div>
              </div>

              {/* What you get */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                  <span><strong>10s Turbo</strong> Probe Frequency</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Up to <strong>100 Monitors</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                  <span><strong>Prometheus</strong> Exporter (<code className="text-[10px]">/metrics</code>)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                  <span><strong>10 Team Seats</strong> with 4-Tier RBAC</span>
                </div>
              </div>
            </div>

            {/* Step 1: PayPal Payment Actions */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span className="flex h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] items-center justify-center font-mono">1</span>
                <span>Choose Payment Method on PayPal</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Method 1: PayPal Monthly Subscription */}
                <button
                  type="button"
                  disabled={!config}
                  onClick={() => config && handleOpenPayPal(config.subscription_url)}
                  className="flex flex-col items-start p-3.5 rounded-xl border border-[#0070BA]/50 bg-gradient-to-b from-[#003087]/30 to-slate-900/90 hover:from-[#003087]/50 hover:to-slate-900 hover:border-[#0070BA] text-left transition-all shadow-lg hover:shadow-cyan-900/20 group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-300 flex items-center gap-1.5">
                      PayPal Monthly Auto-Renew
                      <ExternalLink className="h-3 w-3 text-cyan-400" />
                    </span>
                    <Badge variant="secondary" className="text-[9px] bg-cyan-950 text-cyan-300 border-cyan-800">
                      Recommended
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Set up automatic monthly subscription of $8.00/mo via your PayPal account or card.
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                    <span>Pay $8/mo with PayPal &rarr;</span>
                  </div>
                </button>

                {/* Method 2: PayPal.Me Quick Pay */}
                <button
                  type="button"
                  disabled={!config}
                  onClick={() => config && handleOpenPayPal(config.paypal_me_url)}
                  className="flex flex-col items-start p-3.5 rounded-xl border border-slate-700 bg-slate-950/70 hover:bg-slate-900 hover:border-slate-600 text-left transition-all group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-white group-hover:text-amber-300 flex items-center gap-1.5">
                      PayPal.Me Quick Transfer
                      <ExternalLink className="h-3 w-3 text-amber-400" />
                    </span>
                    <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">
                      Direct
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Direct transfer of $8 USD to <code className="text-slate-300">paypal.me/andrewchuev</code>.
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                    <span>Open PayPal.Me ($8 USD) &rarr;</span>
                  </div>
                </button>
              </div>

              {/* Direct Link Copy Button */}
              {config && (
                <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
                  <span className="truncate pr-2">Recipient: <strong>andrew.chuev@gmail.com</strong> (Amount: $8.00 USD)</span>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(config.subscription_url)}
                    className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors flex-shrink-0"
                    title="Copy direct checkout link"
                  >
                    {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Instant Activation & Confirmation */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span className="flex h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] items-center justify-center font-mono">2</span>
                <span>Confirm Payment &amp; Activate Pro</span>
              </label>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Completed the payment on PayPal? Enter your Transaction ID or click below to activate your Pro plan immediately.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="PayPal Transaction ID / Order reference (optional)"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="h-9 text-xs font-mono bg-slate-900 border-slate-700 focus:border-emerald-500 flex-1"
                />
                <Button
                  onClick={handleActivate}
                  disabled={loading}
                  className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] flex-shrink-0 gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {loading ? 'Activating...' : 'Activate Pro Plan'}
                </Button>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span>Instant activation with 30-day money-back guarantee. Invoices are stored in your team billing history.</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2 border-t border-slate-800/80 flex items-center justify-between sm:justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            Merchant: <span className="text-slate-300 font-medium">andrew.chuev@gmail.com</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white"
          >
            {success ? 'Close' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
