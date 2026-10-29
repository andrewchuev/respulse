import React, { useEffect } from 'react';
import { Activity } from 'lucide-react';
import { LegalKind, legalConfig, legalDocs, legalReady } from '../legal/content';

const NAV: { kind: LegalKind; label: string; href: string }[] = [
  { kind: 'terms', label: 'Terms of Service', href: '/terms' },
  { kind: 'privacy', label: 'Privacy Policy', href: '/privacy' },
  { kind: 'refund', label: 'Refund & Cancellation Policy', href: '/refund' },
];

export const LegalPage: React.FC<{ kind: LegalKind }> = ({ kind }) => {
  const doc = legalDocs[kind];

  // Keep unfinished drafts (placeholders still in place) out of search engines.
  useEffect(() => {
    if (legalReady) return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = `${doc.title} — ${legalConfig.product}`;
    window.scrollTo(0, 0);
    return () => {
      document.title = previous;
    };
  }, [doc.title]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-white/5 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-bold text-white">
            <Activity className="h-5 w-5 text-emerald-400" />
            {legalConfig.product}
          </a>
          <nav className="flex items-center gap-4 text-xs font-mono">
            {NAV.map((item) => (
              <a
                key={item.kind}
                href={item.href}
                aria-current={item.kind === kind ? 'page' : undefined}
                className={item.kind === kind ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400 transition-colors'}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{doc.title}</h1>
        <p className="mt-1 text-xs font-mono text-slate-500">Last updated: {legalConfig.updated}</p>
        <p className="mt-5 text-sm leading-relaxed text-slate-300">{doc.summary}</p>

        <div className="mt-8 space-y-8">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-bold text-white">{section.heading}</h2>
              {section.paragraphs?.map((text) => (
                <p key={text} className="mt-3 text-sm leading-relaxed text-slate-300">
                  {text}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
                  {section.bullets.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Merchant & Company Information (WayForPay requirement) */}
        <div className="mt-12 pt-8 border-t border-white/10 bg-slate-900/50 p-6 rounded-xl border border-slate-800">
          <h2 className="text-base font-bold text-white mb-3">Company information</h2>
          <ul className="space-y-2 text-xs text-slate-300">
            <li>
              <strong className="text-white">Legal name:</strong> {legalConfig.operator}
            </li>
            <li>
              <strong className="text-white">Tax ID (РНОКПП):</strong> {legalConfig.taxId}
            </li>
            <li>
              <strong className="text-white">State registration number:</strong> {legalConfig.registrationNumber}
            </li>
            <li>
              <strong className="text-white">Registered address:</strong> {legalConfig.operatorAddress}
            </li>
            <li>
              <strong className="text-white">Phone:</strong>{' '}
              <a href={`tel:${legalConfig.phone.replace(/\s+/g, '')}`} className="text-emerald-400 hover:underline font-mono">
                {legalConfig.phone}
              </a>
            </li>
            <li>
              <strong className="text-white">Email:</strong>{' '}
              <a href={`mailto:${legalConfig.supportEmail}`} className="text-emerald-400 hover:underline font-mono">
                {legalConfig.supportEmail}
              </a>
            </li>
          </ul>
        </div>
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-[11px] font-mono text-slate-500">
        <a href="/" className="hover:text-emerald-400 transition-colors">
          &larr; Back to {legalConfig.product}
        </a>
      </footer>
    </div>
  );
};
