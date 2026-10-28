import React, { useState } from 'react';
import {
  Activity,
  ShieldCheck,
  Server,
  Heart,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Bell,
  Users,
  Globe,
  Cpu,
  Zap,
  Sparkles,
  Check,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  SlidersHorizontal,
  BarChart3,
  Tag,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { BetaPricing } from './BetaPricing';
import { DEFAULT_APP_CONFIG } from '../api/client';
import { PlanLimits } from '../types';

interface PromoLandingPageProps {
  onOpenDashboard: () => void;
  onOpenStatusPage: () => void;
  onOpenAddModal?: () => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
  onOpenUpgradeModal?: () => void;
  /** False during the free beta: hides prices, checkout and Pro-only promises. */
  billingEnabled?: boolean;
  plans?: { FREE: PlanLimits; PRO: PlanLimits };
}

export const PromoLandingPage: React.FC<PromoLandingPageProps> = ({
  onOpenDashboard,
  onOpenStatusPage,
  onOpenAddModal,
  onOpenAuth,
  onOpenUpgradeModal,
  billingEnabled = true,
  plans,
}) => {
  const freeLimits = (plans ?? DEFAULT_APP_CONFIG.plans).FREE;
  const handlePrimaryCta = () => {
    if (onOpenAuth) {
      onOpenAuth('register');
    } else if (onOpenAddModal) {
      onOpenAddModal();
    } else {
      onOpenDashboard();
    }
  };
  // Playground state
  const [activeProtocol, setActiveProtocol] = useState<'http' | 'tcp' | 'ssl' | 'heartbeat' | 'alerts' | 'metrics'>('http');

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-foreground font-sans relative overflow-x-hidden selection:bg-emerald-500 selection:text-black">
      {/* Dynamic Ambient Background Glow Mesh */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 -z-10 h-[600px] w-[900px] rounded-full bg-gradient-to-tr from-emerald-500/10 via-cyan-500/10 to-transparent blur-[160px]" />
      <div className="pointer-events-none fixed top-[600px] -left-40 -z-10 h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[180px]" />
      <div className="pointer-events-none fixed top-[1400px] -right-40 -z-10 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-[180px]" />

      {/* ------------------------------------------------------------- */}
      {/* 1. STICKY TOP PROMO HEADER */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#070b14]/85 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={onOpenDashboard}>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/25 via-teal-500/10 to-cyan-500/25 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] group-hover:scale-105 transition-all">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-lg bg-gradient-to-r from-white via-slate-100 to-emerald-300 bg-clip-text text-transparent">
                  ResPulse
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  v1.0
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
            <a href="#protocols" className="hover:text-emerald-400 transition-colors">Protocols</a>
            <a href="#rust-architecture" className="hover:text-emerald-400 transition-colors">Architecture</a>
            <a href="#pricing" className="hover:text-emerald-400 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">FAQ</a>
            <button
              onClick={onOpenStatusPage}
              className="text-muted-foreground hover:text-white flex items-center gap-1 transition-colors"
            >
              <Globe className="h-3.5 w-3.5 text-cyan-400" />
              Public Status
            </button>
          </nav>

          {/* Header Actions */}
          <div className="flex items-center gap-2.5">
            {onOpenAuth && (
              <button
                onClick={() => onOpenAuth('login')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800/60 transition-all"
              >
                Sign In
              </button>
            )}

            <Button
              onClick={() => onOpenAuth ? onOpenAuth('register') : onOpenDashboard()}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.35)] gap-1.5"
            >
              <span>Get Started Free</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. HERO SECTION */}
      {/* ------------------------------------------------------------- */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 px-4 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-mono font-medium shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Zap className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
            <span>Rust 1.82 Engine • Zero GC Pauses • Async Tokio Core</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1] max-w-4xl mx-auto">
            Systems-Grade Synthetic Monitoring.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Engineered for SREs.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Eliminate blind spots across your distributed infrastructure. ResPulse delivers sub-millisecond precision
            probing for HTTP/S, TCP sockets, TLS certificates, and worker heartbeats — backed by instant multi-channel alerting
            and collaborative RCA post-mortems.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <Button
              onClick={() => onOpenAuth ? onOpenAuth('register') : handlePrimaryCta()}
              size="lg"
              className="w-full sm:w-auto h-12 px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all transform hover:scale-[1.02] gap-2"
            >
              <Sparkles className="h-4 w-4" />
              <span>Create Organization Free</span>
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Button
              onClick={onOpenDashboard}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-12 px-6 border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white text-sm backdrop-blur gap-2"
            >
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>Open Live Console</span>
            </Button>
          </div>

          {/* Key Value Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-8 max-w-4xl mx-auto text-left">
            {[
              { val: '< 10 ms', label: 'Scheduler Precision', icon: Clock, color: 'text-emerald-400' },
              { val: '100% Rust', label: 'Zero GC Observability', icon: Cpu, color: 'text-cyan-400' },
              billingEnabled
                ? { val: '10s Turbo', label: 'High-Frequency Probing', icon: Zap, color: 'text-purple-400' }
                : { val: `${freeLimits.min_interval_seconds}s`, label: 'Probe Intervals', icon: Zap, color: 'text-purple-400' },
              billingEnabled
                ? { val: '/metrics', label: 'Prometheus Exporter', icon: BarChart3, color: 'text-amber-400' }
                : { val: 'Heartbeat', label: 'Cron Dead-Man\'s Switch', icon: BarChart3, color: 'text-amber-400' },
              { val: '4-Tier RBAC', label: 'Enterprise Teams', icon: Users, color: 'text-blue-400' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-white/5 bg-slate-900/40 backdrop-blur hover:border-white/10 transition-all"
                >
                  <Icon className={`h-4 w-4 ${stat.color} mb-1`} />
                  <div className="text-lg font-bold font-mono text-white">{stat.val}</div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* 3. HERO INTERACTIVE CONSOLE MOCKUP */}
        {/* ------------------------------------------------------------- */}
        <div className="max-w-5xl mx-auto mt-12 md:mt-16 relative">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 blur-xl opacity-75 pointer-events-none" />

          <div className="relative rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl shadow-black/90 overflow-hidden backdrop-blur-2xl">
            {/* Mock Window Controls Header */}
            <div className="px-4 py-3 bg-slate-950/80 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-mono text-slate-400">https://respulse.online/app</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-medium">WebSocket Streaming (Live)</span>
              </div>
            </div>

            {/* Mock Dashboard Preview Content */}
            <div className="p-4 sm:p-6 space-y-4">
              {/* Mock 3 Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Total Targets</div>
                    <div className="text-xl font-bold font-mono text-white mt-0.5">7 Endpoints</div>
                  </div>
                  <Layers className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-mono tracking-wider text-emerald-400">Operational SLA</div>
                    <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">99.98% Healthy</div>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-950/20 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-mono tracking-wider text-purple-400">Avg Probe Latency</div>
                    <div className="text-xl font-bold font-mono text-white mt-0.5">38.4 ms</div>
                  </div>
                  <Clock className="h-5 w-5 text-purple-400" />
                </div>
              </div>

              {/* Mock High-Density Monitor Rows */}
              <div className="space-y-2">
                {[
                  { name: 'Core API Gateway', type: 'HTTP', url: 'https://api.internal/v1', uptime: '100.0%', ms: 42, down: false },
                  { name: 'Production Database', type: 'PORT', url: 'db.cluster:5432', uptime: '100.0%', ms: 4, down: false },
                  { name: 'Backup Worker Cron', type: 'HEARTBEAT', url: 'heartbeat://push', uptime: '98.5%', ms: 1, down: false },
                  { name: 'Public Web Portal', type: 'SSL', url: 'portal.company.com', uptime: '100.0%', ms: 118, down: false },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      <span className="font-semibold text-white truncate">{item.name}</span>
                      <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {item.type}
                      </span>
                      <span className="font-mono text-slate-400 text-[11px] truncate hidden md:inline">{item.url}</span>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Mini 30 bar timeline */}
                      <div className="hidden sm:flex items-center gap-[1.5px] h-3.5 px-1 bg-slate-900 rounded border border-slate-800">
                        {Array.from({ length: 24 }).map((_, b) => (
                          <div key={b} className="w-1 h-2 rounded-[0.5px] bg-emerald-500" />
                        ))}
                      </div>

                      <span className="font-mono font-medium text-emerald-400">{item.uptime}</span>
                      <span className="font-mono text-slate-300 w-12 text-right hidden sm:inline">{item.ms}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. INTERACTIVE PROTOCOL PLAYGROUND */}
      {/* ------------------------------------------------------------- */}
      <section id="protocols" className="py-20 border-t border-white/5 bg-slate-950/40 relative">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center space-y-3 mb-12">
            <Badge variant="outline" className="text-xs font-mono font-normal text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
              Multi-Protocol Engine
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              One Unified Engine for All Network Assets
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
              From public REST APIs to internal database sockets, TLS certificates, and asynchronous workers.
            </p>
          </div>

          {/* Interactive Protocol Selector Tabs */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 mb-8">
            {[
              { id: 'http', label: 'HTTP / REST APIs', icon: Activity },
              { id: 'tcp', label: 'TCP Socket & DBs', icon: Server },
              { id: 'ssl', label: 'TLS / SSL Expiry', icon: ShieldCheck },
              { id: 'heartbeat', label: "Cron & Dead Man's Switch", icon: Heart },
              { id: 'alerts', label: 'Alerts & Tag Routing', icon: Bell },
              { id: 'metrics', label: 'Prometheus & Badges', icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeProtocol === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveProtocol(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-emerald-400' : ''}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Protocol Card Details */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
            {activeProtocol === 'http' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-md">
                    <Activity className="h-3.5 w-3.5" />
                    Layer 7 Probing Engine
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">HTTP/HTTPS Synthetic Probing</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Execute high-frequency GET, POST, HEAD, and PUT requests with customizable request bodies and headers.
                    Validate expected HTTP status codes, detect body keywords, and measure accurate latency breakdown (DNS, Connect, TLS, TTFB).
                  </p>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Dedicated support for HTTP Basic Auth with automatic Base64 token injection</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Response body keyword verification (verifies JSON tokens or HTML markers)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Turbo 10-second probing intervals for mission-critical microservices</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-300 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-800 pb-2">
                    <span>Target Definition</span>
                    <span>REST / JSON</span>
                  </div>
                  <pre className="text-emerald-400 overflow-x-auto text-[11px] leading-relaxed">
{`curl -X POST https://respulse.online/api/monitors \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Checkout API",
    "url": "https://api.store.com/v2/orders",
    "monitor_type": "HTTP",
    "method": "POST",
    "expected_status_code": 200,
    "keyword": "order_accepted",
    "interval_seconds": 30
  }'`}
                  </pre>
                </div>
              </div>
            )}

            {activeProtocol === 'tcp' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 text-xs font-mono text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2.5 py-1 rounded-md">
                    <Server className="h-3.5 w-3.5" />
                    Layer 4 Socket Diagnostics
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">TCP Port & Database Checks</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Verify raw TCP socket connectivity across internal database clusters, caching tiers, and microservices
                    without establishing full application sessions.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>PostgreSQL (5432), MySQL (3306), Redis (6379), MongoDB (27017)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>SMTP (25/587), IMAP (993), SSH (22), and custom internal RPC ports</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Sub-millisecond connect handshake timeout measurement</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-300 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-800 pb-2">
                    <span>TCP Socket Probe</span>
                    <span>Port 5432</span>
                  </div>
                  <pre className="text-blue-400 overflow-x-auto text-[11px] leading-relaxed">
{`// Rust Async Tokio TCP Handshake
let start = Instant::now();
let stream = tokio::time::timeout(
    Duration::from_secs(timeout_secs),
    TcpStream::connect(format!("{}:{}", host, port)),
).await??;

let latency_ms = start.elapsed().as_millis();
// Result: Connected in 3.2ms`}
                  </pre>
                </div>
              </div>
            )}

            {activeProtocol === 'ssl' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-md">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Cryptographic Chain Assurance
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">SSL/TLS Certificate Tracking</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Validate TLS handshake integrity, verify certificate authority chains using <code className="text-amber-300">rustls</code> and
                    <code className="text-amber-300"> webpki-roots</code>, and receive advance alerts 30, 14, and 3 days before cert expiration.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Detects revoked, self-signed, and expired certificates before customers notice</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Validates SNI host matching and TLS 1.3 protocol negotiation</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-300 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-800 pb-2">
                    <span>Certificate Diagnostics</span>
                    <span>TLS 1.3</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="text-emerald-400">✓ Common Name: *.respulse.internal</div>
                    <div className="text-slate-400">Issuer: Let's Encrypt Authority X3</div>
                    <div className="text-slate-400">Valid Until: 2027-10-28 (365 days remaining)</div>
                    <div className="text-emerald-400">Status: HEALTHY / ZERO WARNINGS</div>
                  </div>
                </div>
              </div>
            )}

            {activeProtocol === 'heartbeat' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 text-xs font-mono text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2.5 py-1 rounded-md">
                    <Heart className="h-3.5 w-3.5" />
                    Advanced Cron &amp; Dead Man's Switch
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Cron Jobs, Workers &amp; Task Lifecycles</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Monitor background backups, asynchronous workers, and CI/CD pipelines with full Healthchecks.io-grade signals:
                    track execution durations (<code className="text-rose-300">/start</code>), signal explicit failures (<code className="text-rose-300">/fail</code>),
                    evaluate process exit codes (<code className="text-rose-300">/$?</code>), and capture up to 64KB of command output or STDERR traces.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>5-field Cron syntax with full IANA timezone support (<code className="text-emerald-300 font-mono">0 3 * * 1-5</code> in <code className="text-emerald-300 font-mono">Europe/Kyiv</code>)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Human-readable slug URLs &amp; on-the-fly auto-provisioning with <code className="text-emerald-300 font-mono">?create=1</code></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Configurable grace periods &amp; proactive hung/stuck job detection</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-300 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-800 pb-2">
                    <span>Task Lifecycle Shell Example</span>
                    <span>Bash / CI</span>
                  </div>
                  <pre className="text-rose-400 overflow-x-auto text-[11px] leading-relaxed">
{`# 1. Start execution timer
curl -fsS -m 5 https://respulse.online/api/ping/<KEY>/nightly-backup/start

# 2. Run task and capture STDERR/output
/usr/local/bin/backup.sh > /tmp/run.log 2>&1
CODE=$?

# 3. Report exit code & attach logs (?create=1 auto-registers check)
curl -fsS -m 10 --data-binary @/tmp/run.log \\
  "https://respulse.online/api/ping/<KEY>/nightly-backup/\${CODE}?create=1"`}
                  </pre>
                </div>
              </div>
            )}

            {activeProtocol === 'alerts' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-md">
                    <Bell className="h-3.5 w-3.5" />
                    Zero-Latency Dispatch &amp; Tag Routing
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Multi-Channel Alerts &amp; Tag-Based Routing</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Eliminate alert fatigue. Dispatch incidents to Telegram Bots, Discord Webhooks, Slack channels, and Custom Webhooks
                    the instant a probe fails — with granular tag-based routing (<code className="text-emerald-300">filter_tags</code>) so payment outages go to the billing squad, and database issues go to SREs.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Tag-based filtering: route by <code className="text-emerald-300 font-mono">#payments</code>, <code className="text-emerald-300 font-mono">#infra</code>, or <code className="text-emerald-300 font-mono">#prod</code></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Rich visual cards with root causes, latency charts, and incident links</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Full delivery diagnostic audit logs with response codes and timestamps</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2.5 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-800 pb-2">
                    <span>Supported Notification Targets</span>
                    <span>Tag Routing</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center gap-2">
                      <span className="font-semibold">Telegram Bot</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center gap-2">
                      <span className="font-semibold">Discord Webhook</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2">
                      <span className="font-semibold">Slack Channel</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-2">
                      <span className="font-semibold">Custom Webhook</span>
                    </div>
                  </div>
                  <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
                    <span className="text-slate-500"># Routing Rule:</span><br />
                    <span className="text-emerald-400">filter_tags</span>: [&quot;payments&quot;, &quot;billing&quot;] &rarr; #fintech-alerts
                  </div>
                </div>
              </div>
            )}

            {activeProtocol === 'metrics' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2.5 py-1 rounded-md">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Observability &amp; Developer Tooling
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">Prometheus Exporter &amp; Vector Status Badges</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    ResPulse seamlessly integrates into your existing DevOps stack. Scrape gauge metrics directly into Prometheus and Grafana,
                    and embed real-time Shields.io-compatible vector SVG status badges into your public GitHub READMEs and team documentation.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Standard Prometheus text format on <code className="text-cyan-300 font-mono">/metrics</code> and <code className="text-cyan-300 font-mono">/api/metrics</code></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Vector SVG badges with <code className="text-emerald-300 font-mono">up</code>, <code className="text-amber-300 font-mono">late</code> (grace window), <code className="text-red-300 font-mono">down</code> states</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Access badges by token (<code className="text-cyan-300 font-mono">/badge/:token.svg</code>) or slug (<code className="text-cyan-300 font-mono">/badge/:key/:slug.svg</code>)</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-300 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-800 pb-2">
                    <span>Prometheus &amp; Badge Snippets</span>
                    <span>Open Metrics</span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Prometheus Scrape:</div>
                    <pre className="text-cyan-300 text-[11px] overflow-x-auto bg-slate-900/60 p-2 rounded border border-slate-800">
{`# GET /api/metrics
respulse_monitors_total{status="UP"} 12
respulse_monitor_response_time_ms{name="API Gateway"} 38.4
respulse_heartbeat_duration_ms{slug="nightly-backup"} 1240.0`}
                    </pre>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">GitHub README.md Badge:</div>
                    <pre className="text-emerald-300 text-[11px] overflow-x-auto bg-slate-900/60 p-2 rounded border border-slate-800">
{`![Status](https://respulse.online/api/badge/<KEY>/backup.svg)`}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. WHY RUST? ARCHITECTURE DEEP DIVE */}
      {/* ------------------------------------------------------------- */}
      <section id="rust-architecture" className="py-20 border-t border-white/5 relative">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center space-y-3 mb-12">
            <Badge variant="outline" className="text-xs font-mono font-normal text-cyan-400 border-cyan-500/30 bg-cyan-500/10">
              High-Performance Systems Core
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Why We Built ResPulse in Rust
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
              Monitoring infrastructure shouldn't consume more resources than the services it monitors.
            </p>
          </div>

          {/* Benchmark Comparison Table */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-2xl backdrop-blur">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950/80 border-b border-white/5 font-mono text-[11px] text-slate-400 uppercase">
                <tr>
                  <th className="p-4 sm:p-5">Architectural Metric</th>
                  <th className="p-4 sm:p-5 text-emerald-400 font-bold">ResPulse (Rust + Axum)</th>
                  <th className="p-4 sm:p-5 text-slate-500">Legacy Node.js / Python Engines</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Base Memory Footprint</td>
                  <td className="p-4 sm:p-5 font-mono text-emerald-400 font-bold">~18 MB RSS</td>
                  <td className="p-4 sm:p-5 font-mono text-slate-400">~380 MB - 1.2 GB RSS</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Garbage Collection Pauses</td>
                  <td className="p-4 sm:p-5 font-mono text-emerald-400 font-bold">0.0 ms (Zero GC, deterministic RAII)</td>
                  <td className="p-4 sm:p-5 font-mono text-slate-400">50 - 250 ms Stop-the-world spikes</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Probe Timing Precision</td>
                  <td className="p-4 sm:p-5 font-mono text-emerald-400 font-bold">&lt; 1 ms scheduler jitter</td>
                  <td className="p-4 sm:p-5 font-mono text-slate-400">Event loop delays under load</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Concurrency Engine</td>
                  <td className="p-4 sm:p-5 font-mono text-emerald-400 font-bold">Tokio Multi-Threaded Work-Stealing Runtime</td>
                  <td className="p-4 sm:p-5 font-mono text-slate-400">Single-threaded event loop or heavy process forks</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">TLS Certificate Engine</td>
                  <td className="p-4 sm:p-5 font-mono text-emerald-400 font-bold">Memory-safe rustls (No OpenSSL C bugs)</td>
                  <td className="p-4 sm:p-5 font-mono text-slate-400">Vulnerable OpenSSL dynamic bindings</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. ENTERPRISE FEATURES (2x2 GRID) */}
      {/* ------------------------------------------------------------- */}
      <section id="features" className="py-20 border-t border-white/5 bg-slate-950/40 relative">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center space-y-3 mb-12">
            <Badge variant="outline" className="text-xs font-mono font-normal text-purple-400 border-purple-500/30 bg-purple-500/10">
              Enterprise Readiness
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Built for Scale, Teams, and Serious Ops
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
              Features you typically only find on enterprise tier SaaS products — included out of the box.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 1: RBAC */}
            <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl hover:border-emerald-500/30 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-105 transition-all">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">4-Tier Enterprise RBAC & Multi-User Teams</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Granular permission controls with distinct roles: <span className="text-purple-300 font-mono">OWNER</span>, <span className="text-blue-300 font-mono">ADMIN</span>, <span className="text-emerald-300 font-mono">ENGINEER</span>, and read-only <span className="text-slate-300 font-mono">VIEWER</span>. Complete with interactive Permissions Matrix and instant demo persona switcher.
              </p>
            </div>

            {/* Feature 2: Incident Management & RCA */}
            <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl hover:border-emerald-500/30 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 group-hover:scale-105 transition-all">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">SRE Incident Management & Post-Mortem Editor</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Chronological timeline updates with 4 operational stages (<span className="text-red-300">Investigating</span> → <span className="text-emerald-300">Resolved</span>). Includes a 1-click standard SRE RCA Post-Mortem template with public publication toggle for status pages.
              </p>
            </div>

            {/* Feature 3: Bulk Actions & Compact View */}
            <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl hover:border-emerald-500/30 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 transition-all">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">High-Density Compact View & Bulk Actions</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Multi-select checkboxes with floating bulk action toolbar (bulk pause, resume, simultaneous test, tagging, folder migration, and deletion). Includes a ~46px High-Density Compact View for NOC monitoring walls.
              </p>
            </div>

            {/* Feature 4: Public Status Pages */}
            <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl hover:border-emerald-500/30 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-all">
                <Globe className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Categorized Public Status Page</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Transparent SLA status page with automatic 90-day history calculations, grouped component blocks (Websites, Core APIs, Infrastructure), live active incident notices, and expandable past 7-day post-mortem reports.
              </p>
            </div>

            {/* Feature 5: Prometheus Exporter & Badges */}
            <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl hover:border-cyan-500/30 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 transition-all">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Prometheus Metrics &amp; Vector Badges</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Native <span className="text-cyan-300 font-mono">/metrics</span> and <span className="text-cyan-300 font-mono">/api/metrics</span> endpoints scrape platform gauges directly into Prometheus and Grafana. Embed real-time Shields.io-compatible vector SVG status badges into GitHub READMEs.
              </p>
            </div>

            {/* Feature 6: Tag-Based Alert Routing */}
            <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl hover:border-amber-500/30 transition-all group">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-105 transition-all">
                <Tag className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Granular Tag-Based Alert Routing</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Assign tags like <span className="text-emerald-300 font-mono">#payments</span>, <span className="text-cyan-300 font-mono">#db</span>, or <span className="text-purple-300 font-mono">#prod</span> and bind channels using <span className="text-amber-300 font-mono">filter_tags</span>. Alert notifications route straight to the on-call engineers responsible for that subsystem.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. PRICING SECTION */}
      {/* ------------------------------------------------------------- */}
      <section id="pricing" className="py-20 border-t border-white/5 relative">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center space-y-3 mb-10">
            <Badge variant="outline" className="text-xs font-mono font-normal text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
              {billingEnabled ? 'Simple, Transparent Pricing' : 'Free During the Open Beta'}
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {billingEnabled ? 'Two Plans. Zero Complications.' : 'Free While We Build It With You'}
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto">
              {billingEnabled
                ? 'Get started for free forever, or upgrade to Pro for high-frequency turbo probes, team RBAC, and Prometheus metrics.'
                : 'Use ResPulse for free while it is in beta. If we introduce a paid plan later, you will hear about it well in advance.'}
            </p>
          </div>

          {!billingEnabled && <BetaPricing limits={freeLimits} onGetStarted={onOpenDashboard} />}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 max-w-3xl mx-auto ${billingEnabled ? '' : 'hidden'}`}>
            {/* Plan 1: Free Forever */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-7 flex flex-col justify-between backdrop-blur">
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Free Tier</div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-4xl font-extrabold text-white">$0</span>
                    <span className="text-xs text-slate-400 font-mono">/ forever free</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Perfect for indie developers, home labs, side projects, and pet infrastructure.
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>10 Synthetic Monitors</strong> (HTTP, SSL, TCP)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>60-Second</strong> Standard Probe Intervals</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>10 Heartbeat / Cron Jobs</strong> (Dead Man's Switch)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>Telegram, Discord, Slack &amp; Webhooks</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>Vector SVG Status Badges for GitHub</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>14-Day Latency &amp; Incident Retention</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>1 User (Solo Workspace)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>Public Status Page on standard URL</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={onOpenDashboard}
                variant="outline"
                className="w-full mt-8 border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white"
              >
                Get Started Free
              </Button>
            </div>

            {/* Plan 2: Pro (Highlighted) */}
            <div className="rounded-2xl border border-emerald-500/50 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-emerald-950/30 p-7 flex flex-col justify-between backdrop-blur shadow-[0_0_35px_rgba(16,185,129,0.18)] relative ring-1 ring-emerald-500/30">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500 text-black shadow-md shadow-emerald-500/20">
                Recommended for Production
              </div>

              <div className="space-y-5">
                <div>
                  <div className="text-xs font-mono text-emerald-400 uppercase tracking-wider">Pro Plan</div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-4xl font-extrabold text-white">$8</span>
                    <span className="text-xs text-slate-400 font-mono">/ month (monthly billing)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-1">
                    * Price excludes applicable local VAT / sales tax (calculated at checkout)
                  </div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    Production monitoring for startups, engineers and squads requiring zero-latency alerts.
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>Everything in Free, plus:</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-white font-medium">Up to <strong>100 Synthetic Monitors</strong></span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-white font-medium"><strong>Turbo 10-Second</strong> Probe Intervals</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>Unlimited Cron &amp; Background Tasks</strong> with Timezones</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>Prometheus Metrics Exporter</strong> (<code className="text-[11px] text-cyan-300 bg-cyan-950/60 px-1 py-0.5 rounded">/api/metrics</code>)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>Tag-Based Alert Routing</strong> (<code className="text-[11px] text-emerald-300 bg-emerald-950/60 px-1 py-0.5 rounded">filter_tags</code>)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>Full <strong>64KB STDERR / Execution Log</strong> Capture</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>Up to <strong>10 Team Members</strong> with 4-Tier RBAC</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>90-Day Retention</strong> &amp; SRE Post-Mortem (RCA)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>Custom Domain for Public Status Page</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => {
                  if (onOpenUpgradeModal) {
                    onOpenUpgradeModal();
                  } else {
                    onOpenDashboard();
                  }
                }}
                className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-[0_0_20px_rgba(16,185,129,0.35)]"
              >
                Upgrade to Pro — $8/mo (excl. VAT)
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 8. TESTIMONIALS SECTION */}
      {/* ------------------------------------------------------------- */}
      <section className="py-20 border-t border-white/5 bg-slate-950/40 relative">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Trusted by SREs and Infrastructure Teams
            </h2>
            <p className="text-sm text-slate-400">Here's how engineering teams rely on ResPulse every day.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote: "ResPulse replaced our expensive legacy Datadog synthetic monitors. The Rust backend consumes virtually zero RAM, and false alarms dropped to absolute zero.",
                author: "Alex Rivera",
                role: "Head of Infrastructure",
                company: "HyperScale Cloud",
              },
              {
                quote: "The built-in Post-Mortem editor with 1-click SRE template cut our incident coordination time by 60%. Publishing updates to the public status page is seamless.",
                author: "Elena Rostova",
                role: "Staff SRE",
                company: "FinTech Core",
              },
              {
                quote: "Having 4-tier RBAC and a compact density view means our NOC team can supervise 200+ endpoints on a single wall monitor without losing track of a single millisecond.",
                author: "Marcus Vance",
                role: "VP of Platform Engineering",
                company: "Acme Global",
              },
            ].map((t, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border border-white/5 bg-slate-900/40 flex flex-col justify-between backdrop-blur"
              >
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic mb-4">
                  "{t.quote}"
                </p>
                <div>
                  <div className="font-semibold text-white text-xs">{t.author}</div>
                  <div className="text-[11px] text-emerald-400 font-mono">{t.role}</div>
                  <div className="text-[10px] text-slate-500">{t.company}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 9. FAQ ACCORDION SECTION */}
      {/* ------------------------------------------------------------- */}
      <section id="faq" className="py-20 border-t border-white/5 relative">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center space-y-3 mb-12">
            <Badge variant="outline" className="text-xs font-mono font-normal text-slate-400 border-slate-700 bg-slate-900">
              Frequently Asked Questions
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Got Questions? We've Got Answers.
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "How does ResPulse achieve zero garbage collection pauses?",
                a: "Unlike NodeJS or Python-based monitoring tools that suffer from periodic garbage collection (GC) freezes causing false latency spikes, ResPulse is built in 100% safe Rust. Rust uses deterministic compile-time memory management (RAII), ensuring ultra-consistent sub-millisecond scheduling precision."
              },
              {
                q: "Can I self-host ResPulse completely inside an isolated private VPC?",
                a: "Yes! ResPulse is 100% containerized with Docker Compose. It requires only PostgreSQL and a reverse proxy (like the included Caddy 2 setup). It can run entirely within your private subnet to monitor internal databases, Kubernetes pods, and VPC endpoints without egress access."
              },
              {
                q: "How does push heartbeat (dead man's switch) work for cron jobs?",
                a: "When you create a Heartbeat monitor, ResPulse generates a unique cryptographic webhook URL or clean slug URL. You can signal task start (/start) to measure runtime, pass shell exit codes (/$?), attach STDERR logs up to 64KB, and schedule with standard 5-field cron syntax in any IANA timezone. If a ping is missed or task hangs beyond the grace period, an incident is instantly declared."
              },
              {
                q: "Which alert delivery channels are currently supported?",
                a: "ResPulse natively supports Telegram Bot API, Discord Rich Embed Webhooks, Slack Incoming Webhooks, and Custom JSON Webhooks. With tag-based alert routing (filter_tags), you can route specific subsystem alerts directly to dedicated engineering squads."
              },
              {
                q: "Can I export ResPulse metrics directly into Prometheus and Grafana?",
                a: "Yes! ResPulse provides native /metrics and /api/metrics endpoints. Any Prometheus scraper or OpenTelemetry collector can gather platform gauges (monitor operational status, probe latencies, heartbeat durations, and active incidents) for visualization in your central Grafana dashboards."
              },
              {
                q: billingEnabled ? "What is included in the $8/month Pro plan?" : "Is ResPulse free?",
                a: billingEnabled ? "The Pro plan ($8.00 USD / month excl. VAT, cancel anytime) offers turbo 10-second probe intervals, up to 100 synthetic monitors, unlimited cron tasks with timezones, up to 10 team members with 4-tier RBAC, 90-day retention with SRE RCA post-mortems, Prometheus metric exports, tag-based alert routing, and custom domain status pages." : "Yes, ResPulse is free while it is in open beta, with generous limits for small teams and side projects. A paid plan with faster probes, team seats and a Prometheus exporter may come later; if it does, you will get advance notice and nothing will be charged without your explicit checkout.",
              },
              {
                q: "How does Role-Based Access Control (RBAC) enforce security?",
                a: "ResPulse implements a 4-tier security model: Owner (full control & org deletion), Admin (monitor & team management), Engineer (monitor CRUD, test probes & post-mortems), and Viewer (read-only dashboards). All mutations are strictly validated on the Axum backend and return 403 Forbidden for unauthorized roles."
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/5 bg-slate-900/50 overflow-hidden backdrop-blur"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="flex items-center justify-between w-full p-4 sm:p-5 text-left text-sm font-semibold text-white hover:text-emerald-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="h-4 w-4 text-emerald-400 flex-shrink-0 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500 flex-shrink-0 ml-2" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 10. FINAL BOTTOM CALL-TO-ACTION */}
      {/* ------------------------------------------------------------- */}
      <section className="py-20 border-t border-white/5 relative bg-gradient-to-b from-slate-950 to-[#070b14]">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Zap className="h-6 w-6" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Ready to Eliminate Downtime Blind Spots?
          </h2>

          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto">
            Deploy ResPulse in under 60 seconds with Docker Compose, or explore the live monitoring console right now.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Button
              onClick={onOpenDashboard}
              size="lg"
              className="w-full sm:w-auto h-12 px-8 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-[0_0_25px_rgba(16,185,129,0.4)] gap-2"
            >
              <Activity className="h-4 w-4" />
              <span>Open Live Monitoring Console</span>
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Button
              onClick={onOpenStatusPage}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-12 px-6 border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white text-sm gap-2"
            >
              <Globe className="h-4 w-4 text-cyan-400" />
              <span>View Public Status</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 11. FOOTER */}
      {/* ------------------------------------------------------------- */}
      <footer className="border-t border-white/5 py-12 bg-slate-950 text-xs text-slate-400">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
            <span className="font-bold text-white text-sm">ResPulse</span>
            <span className="text-[11px] text-slate-500">
              © {new Date().getFullYear()} ResPulse. Systems-grade synthetic monitoring.
            </span>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px]">
            <button onClick={onOpenDashboard} className="hover:text-emerald-400 transition-colors">
              Console
            </button>
            <button onClick={onOpenStatusPage} className="hover:text-emerald-400 transition-colors">
              Status Page
            </button>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">
              FAQ
            </a>
            <a href="/terms" className="hover:text-emerald-400 transition-colors">
              Terms
            </a>
            <a href="/privacy" className="hover:text-emerald-400 transition-colors">
              Privacy
            </a>
            {billingEnabled && (
              <a href="/refund" className="hover:text-emerald-400 transition-colors">
                Refunds
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
