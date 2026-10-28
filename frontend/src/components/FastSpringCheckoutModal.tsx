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
  Building2,
} from 'lucide-react';
import { confirmFastSpringPayment, fetchFastSpringConfig } from '../api/client';
import { FastSpringCheckoutConfig } from '../types';

interface FastSpringCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanUpgraded: () => void;
}

declare global {
  interface Window {
    fastspring?: {
      builder: {
        reset: () => void;
        add: (productPath: string) => void;
        tag: (tags: Record<string, any>) => void;
        checkout: () => void;
        push: (payload: any) => void;
      };
    };
    fscClosedCallback?: (orderReference: any) => void;
    fscDataCallback?: (data: any) => void;
    fscErrorCallback?: (code: any, message: any) => void;
  }
}

export const FastSpringCheckoutModal: React.FC<FastSpringCheckoutModalProps> = ({
  isOpen,
  onClose,
  onPlanUpgraded,
}) => {
  const [config, setConfig] = useState<FastSpringCheckoutConfig | null>(null);
  const [orderReference, setOrderReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load FastSpring SBL script and fetch config
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSuccess(false);
    setOrderReference('');

    fetchFastSpringConfig()
      .then((cfg) => {
        setConfig(cfg);

        // Inject FastSpring Store Builder Library if not already loaded
        const existingScript = document.getElementById('fsc-api');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'fsc-api';
          script.src = 'https://sbl.onfastspring.com/sbl/1.0.1/fastspring-builder.min.js';
          script.type = 'text/javascript';
          script.setAttribute('data-storefront', cfg.storefront);
          script.setAttribute('data-closed-callback', 'fscClosedCallback');
          script.setAttribute('data-data-callback', 'fscDataCallback');
          script.setAttribute('data-error-callback', 'fscErrorCallback');
          document.body.appendChild(script);
        }

        // Register Global FastSpring Callbacks
        window.fscClosedCallback = (orderRef: any) => {
          if (orderRef) {
            const refId = typeof orderRef === 'string' ? orderRef : orderRef.id || orderRef.reference;
            if (refId) {
              setOrderReference(refId);
              handleAutoActivate(refId);
            }
          }
        };

        window.fscErrorCallback = (_code: any, message: any) => {
          if (message) {
            setError(typeof message === 'string' ? message : 'FastSpring checkout encountered an issue');
          }
        };
      })
      .catch((e) => setError(e.message || 'Failed to load FastSpring configuration'));

    return () => {
      window.fscClosedCallback = undefined;
      window.fscErrorCallback = undefined;
    };
  }, [isOpen]);

  const handleAutoActivate = async (refId: string) => {
    setLoading(true);
    setError(null);
    try {
      await confirmFastSpringPayment({
        order_id: refId,
        reference: refId,
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

  const handleOpenPopupCheckout = () => {
    if (!config) return;

    if (window.fastspring?.builder) {
      try {
        window.fastspring.builder.reset();
        window.fastspring.builder.tag({
          team_id: config.team_id,
          user_email: config.user_email,
        });
        window.fastspring.builder.add(config.product_path);
        window.fastspring.builder.checkout();
        return;
      } catch (e) {
        console.warn('FastSpring builder popup error, falling back to web checkout', e);
      }
    }

    // Fallback: Open web checkout in new window
    window.open(config.checkout_url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenWebCheckout = (url: string) => {
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
      await confirmFastSpringPayment({
        order_id: orderReference.trim() || undefined,
        reference: orderReference.trim() || undefined,
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
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CreditCard className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Upgrade to ResPulse Pro
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-950/40">
                    $8.00 / month
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Secure global checkout &amp; automated invoicing powered by <strong className="text-slate-200">FastSpring</strong>
                </DialogDescription>
              </div>
            </div>

            {/* FastSpring Logo Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-bold text-slate-200">
              <span className="text-emerald-400 font-extrabold tracking-tight">Fast</span>
              <span className="font-semibold text-slate-100">Spring</span>
              {config?.is_test && (
                <span className="text-[9px] px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded font-mono">TEST</span>
              )}
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
                Thank you! Your FastSpring order was verified and your organization has been upgraded to ResPulse Pro. All limits are unlocked.
              </p>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400">
              Active: 100 monitors &bull; 10s intervals &bull; 30-day retention &bull; 10 team seats &bull; Prometheus exporter
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {error && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Plan Highlights Grid */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-950 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
                  <Sparkles className="h-3.5 w-3.5" />
                  What's Included in Pro
                </div>
                <span className="text-xs font-mono text-slate-300">
                  <strong className="text-white text-base font-bold">$8.00</strong> / month
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                  <span>Up to <strong>100 active monitors</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                  <span><strong>10s probe precision</strong> scheduler</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                  <span><strong>30 days</strong> metrics &amp; latency history</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                  <span>Up to <strong>10 team seats</strong> with RBAC</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                  <span>Heartbeat &amp; Cron dead man's switch</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                  <span>Prometheus <code>/metrics</code> scraping</span>
                </div>
              </div>
            </div>

            {/* Step 1: FastSpring Checkout Actions */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] items-center justify-center font-mono">1</span>
                  <span>Choose Checkout Method</span>
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">Store: reslab (FastSpring)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* FastSpring Popup Checkout (Recommended) */}
                <button
                  type="button"
                  onClick={handleOpenPopupCheckout}
                  className="flex flex-col items-start p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 hover:border-emerald-500/50 text-left transition-all group shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-white group-hover:text-emerald-300 flex items-center gap-1.5">
                      FastSpring Popup
                      <Sparkles className="h-3 w-3 text-emerald-400" />
                    </span>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/40 bg-emerald-950/60 text-emerald-300 font-mono">
                      Fastest
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    In-page modal checkout. Pay with Credit Card, Apple Pay, Google Pay, or PayPal.
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Pay with FastSpring ($8.00) &rarr;</span>
                  </div>
                </button>

                {/* FastSpring Web Storefront */}
                <button
                  type="button"
                  onClick={() => config && handleOpenWebCheckout(config.checkout_url)}
                  className="flex flex-col items-start p-3.5 rounded-xl border border-slate-700 bg-slate-950/70 hover:bg-slate-900 hover:border-slate-600 text-left transition-all group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-300 flex items-center gap-1.5">
                      Hosted Web Checkout
                      <ExternalLink className="h-3 w-3 text-cyan-400" />
                    </span>
                    <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">
                      New Tab
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Open full FastSpring hosted checkout in a new browser tab.
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400">
                    <span>Open Web Checkout ($8.00) &rarr;</span>
                  </div>
                </button>
              </div>

              {/* Supported payment methods banner */}
              <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
                <span className="truncate pr-2">
                  Accepted: <strong>Cards (Visa, MC, Amex)</strong>, <strong>Apple Pay</strong>, <strong>Google Pay</strong>, <strong>Wire</strong>
                </span>
                {config && (
                  <button
                    type="button"
                    onClick={() => handleCopyLink(config.checkout_url)}
                    className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors flex-shrink-0"
                    title="Copy direct checkout link"
                  >
                    {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: Instant Activation & Confirmation */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span className="flex h-4 w-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] items-center justify-center font-mono">2</span>
                <span>Confirm Order &amp; Activate Pro</span>
              </label>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Already completed the checkout on FastSpring? Enter your Order Reference (or click below) to activate your Pro plan immediately.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="FastSpring Order ID / Reference (optional)"
                  value={orderReference}
                  onChange={(e) => setOrderReference(e.target.value)}
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
                <span>FastSpring handles PCI-DSS compliance, VAT/tax handling, and automated billing receipts.</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2 border-t border-slate-800/80 flex items-center justify-between sm:justify-between">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-slate-500" />
            <span>Merchant of Record: <strong className="text-slate-300 font-medium">FastSpring (reslab)</strong></span>
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
