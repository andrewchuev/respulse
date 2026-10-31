import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { fetchBillingStatus } from '../api/client';
import { DowngradeStatus } from '../types';

interface DowngradeNoticeProps {
  plan: string;
  /** Changes whenever monitors are reloaded so the counters stay current. */
  refreshKey: unknown;
  onUpgrade?: () => void;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

export const DowngradeNotice: React.FC<DowngradeNoticeProps> = ({ plan, refreshKey, onUpgrade }) => {
  const [downgrade, setDowngrade] = useState<DowngradeStatus | null>(null);

  useEffect(() => {
    if (plan === 'PRO') {
      setDowngrade(null);
      return;
    }
    let cancelled = false;
    fetchBillingStatus()
      .then((status) => !cancelled && setDowngrade(status.downgrade ?? null))
      .catch(() => !cancelled && setDowngrade(null));
    return () => {
      cancelled = true;
    };
  }, [plan, refreshKey]);

  if (!downgrade) return null;

  const { enforced, grace_ends_at } = downgrade;
  const parts: string[] = [];
  if (downgrade.monitors_over_limit > 0) parts.push(`${downgrade.monitors_over_limit} monitor(s) over the Free limit`);
  if (downgrade.short_interval_monitors > 0) parts.push(`${downgrade.short_interval_monitors} monitor(s) probing faster than Free allows`);
  if (downgrade.members_over_limit > 0) parts.push(`${downgrade.members_over_limit} extra team member(s)`);

  if (!enforced && parts.length === 0) return null;
  if (enforced && downgrade.paused_by_plan === 0 && downgrade.suspended_by_plan === 0) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4 text-center text-xs text-amber-300 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
      {enforced ? (
        <span>
          Free plan limits are now applied: {downgrade.paused_by_plan} monitor(s) were paused and {downgrade.suspended_by_plan} member(s)
          suspended. Delete or pause monitors to resume others, or upgrade to Pro to restore everything.
        </span>
      ) : (
        <span>
          Your team moved to the Free plan. Until {formatDate(grace_ends_at)} everything keeps running; after that {parts.join(', ')} will be
          paused or limited. Upgrading to Pro restores it all.
        </span>
      )}
      {onUpgrade && (
        <button type="button" onClick={onUpgrade} className="underline underline-offset-2 hover:text-amber-200 font-semibold">
          Upgrade to Pro
        </button>
      )}
    </div>
  );
};
