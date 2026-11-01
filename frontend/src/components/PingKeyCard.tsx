import React, { useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';

/**
 * The team's ping key: what a script or another service uses to send heartbeats and to read
 * the status of the monitors. Hidden until asked for, because anyone who has it can write pings.
 */
export const PingKeyCard: React.FC<{ pingKey: string }> = ({ pingKey }) => {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const origin = window.location.origin;
  const env = `RESPULSE_URL=${origin}\nRESPULSE_PING_KEY=${pingKey}`;

  const copy = (text: string, what: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      window.setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
    });
  };

  return (
    <Card className="bg-card/40 border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Ping key</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Sends heartbeats to <code className="font-mono text-emerald-400">{origin}/api/ping/&lt;key&gt;/&lt;slug&gt;</code> and reads
          the status of your monitors. Keep it secret: anyone who has it can report as your services.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-md border border-border/60 bg-secondary/40 px-3 py-2 font-mono text-xs text-white">
            {shown ? pingKey : '•'.repeat(24)}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-2.5 border-border/80 text-muted-foreground hover:text-white"
            onClick={() => setShown((s) => !s)}
            title={shown ? 'Hide the key' : 'Show the key'}
          >
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 border-border/80 text-xs text-muted-foreground hover:text-white"
            onClick={() => copy(pingKey, 'key')}
          >
            {copied === 'key' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            Copy key
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            For resmetrics: <code className="font-mono text-zinc-300">RESPULSE_URL</code> and{' '}
            <code className="font-mono text-zinc-300">RESPULSE_PING_KEY</code> in its <code className="font-mono text-zinc-300">.env</code>.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 gap-1.5 border-border/80 text-xs text-muted-foreground hover:text-white"
            onClick={() => copy(env, 'env')}
          >
            {copied === 'env' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            Copy as .env lines
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
