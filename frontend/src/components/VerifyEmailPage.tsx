import React, { useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { verifyEmail } from '../api/client';

type State = { phase: 'working' } | { phase: 'done' } | { phase: 'failed'; message: string };

/** Landing page for the emailed confirmation link: redeems the token, then opens the dashboard. */
export const VerifyEmailPage: React.FC = () => {
  const [state, setState] = useState<State>({ phase: 'working' });
  // React StrictMode runs effects twice in development; a token can only be redeemed once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState({ phase: 'failed', message: 'This confirmation link is incomplete.' });
      return;
    }

    verifyEmail(token)
      .then(() => {
        setState({ phase: 'done' });
        // A full load starts the app with the new session instead of the signed-out landing state.
        window.setTimeout(() => window.location.replace('/app'), 1500);
      })
      .catch((err: Error) => setState({ phase: 'failed', message: err.message }));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
      <div className="max-w-sm text-center space-y-4">
        <a href="/" className="inline-flex items-center gap-2 font-bold text-white">
          <Activity className="h-5 w-5 text-emerald-400" />
          ResPulse
        </a>

        {state.phase === 'working' && <p className="text-sm text-slate-300">Confirming your email…</p>}

        {state.phase === 'done' && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">Email confirmed</h1>
            <p className="text-sm text-slate-300">Taking you to your dashboard…</p>
          </>
        )}

        {state.phase === 'failed' && (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
            <h1 className="text-xl font-bold text-white">Link not valid</h1>
            <p className="text-sm text-slate-300">{state.message}</p>
            <p className="text-xs text-slate-500">
              <a href="/login" className="text-emerald-400 hover:underline">
                Sign in
              </a>{' '}
              to get a new confirmation email.
            </p>
          </>
        )}
      </div>
    </div>
  );
};
