import React from 'react';
import { Check, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { PlanLimits } from '../types';

interface BetaPricingProps {
  limits: PlanLimits;
  onGetStarted: () => void;
}

const planned = [
  'Turbo 10-second probe intervals',
  'Up to 100 synthetic monitors',
  'Advanced 5-field Cron expressions with timezones',
  'Full 64KB STDERR / execution log capture',
  'Team workspace with up to 10 members and 4-tier RBAC',
  'Prometheus metrics exporter (/api/metrics)',
  'Tag-based alert routing (filter_tags)',
  '90-day retention and SRE post-mortems',
  'Custom domain for status pages',
];

/** Pricing section while the service is a free open beta and checkout is switched off. */
export const BetaPricing: React.FC<BetaPricingProps> = ({ limits, onGetStarted }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 max-w-3xl mx-auto">
    <div className="rounded-2xl border border-emerald-500/40 bg-slate-900/50 p-7 flex flex-col justify-between backdrop-blur ring-1 ring-emerald-500/20">
      <div className="space-y-5">
        <div>
          <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider">Open Beta</div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-extrabold text-white">$0</span>
            <span className="text-xs text-slate-400 font-mono">/ free while in beta</span>
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Everything you need to watch your sites, APIs and cron jobs. No credit card.
          </p>
        </div>

        <div className="pt-4 border-t border-white/5 space-y-3 text-xs text-slate-300">
          {[
            <>
              <strong>{limits.max_monitors} monitors</strong> (HTTP, SSL, TCP, heartbeat)
            </>,
            <>
              Checks as often as every <strong>{limits.min_interval_seconds} seconds</strong>
            </>,
            <>Heartbeat monitoring with interval pings and status signals</>,
            <>Telegram, Discord, Slack &amp; webhook alerts</>,
            <>Public status page and SVG status badges</>,
            <>
              <strong>{limits.retention_days}-day</strong> history and incident timeline
            </>,
          ].map((line, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={onGetStarted}
        className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.35)]"
      >
        Get Started Free
      </Button>
    </div>

    <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-7 flex flex-col justify-between backdrop-blur opacity-90">
      <div className="space-y-5">
        <div>
          <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Pro</div>
          <div className="flex items-center gap-2 mt-2 text-sm font-semibold text-slate-200">
            <Clock className="h-4 w-4 text-amber-400" />
            Planned, not available yet
          </div>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            We may add a paid plan later for heavier use. Early users will get advance notice before anything changes.
          </p>
        </div>

        <div className="pt-4 border-t border-white/5 space-y-3 text-xs text-slate-400">
          {planned.map((line) => (
            <div key={line} className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-slate-600 flex-shrink-0" />
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
