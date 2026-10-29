import React, { useState } from 'react';
import { ChannelType, CreateChannelPayload } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, MessageSquare, Hash, Webhook } from 'lucide-react';

interface AddChannelModalProps {
  isOpen: boolean;
  isPro?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateChannelPayload) => Promise<void>;
}

export const AddChannelModal: React.FC<AddChannelModalProps> = ({
  isOpen,
  isPro = false,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [channelType, setChannelType] = useState<ChannelType>('TELEGRAM');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [genericWebhookUrl, setGenericWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [filterTagsInput, setFilterTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }

    let config: Record<string, any> = {};

    if (channelType === 'TELEGRAM') {
      if (!telegramToken.trim() || !telegramChatId.trim()) {
        setError('Telegram Bot Token and Chat ID are both required');
        return;
      }
      config = {
        bot_token: telegramToken.trim(),
        chat_id: telegramChatId.trim(),
      };
    } else if (channelType === 'DISCORD') {
      if (!discordWebhookUrl.trim()) {
        setError('Discord Webhook URL is required');
        return;
      }
      config = { webhook_url: discordWebhookUrl.trim() };
    } else if (channelType === 'SLACK') {
      if (!slackWebhookUrl.trim()) {
        setError('Slack Webhook URL is required');
        return;
      }
      config = { webhook_url: slackWebhookUrl.trim() };
    } else if (channelType === 'WEBHOOK') {
      if (!genericWebhookUrl.trim()) {
        setError('Webhook Endpoint URL is required');
        return;
      }
      config = {
        webhook_url: genericWebhookUrl.trim(),
        secret: webhookSecret.trim() || undefined,
      };
    }

    setLoading(true);
    const filter_tags = filterTagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase().replace('#', ''))
      .filter(Boolean);

    try {
      await onSubmit({
        name: name.trim(),
        channel_type: channelType,
        config,
        is_active: true,
        filter_tags: filter_tags.length > 0 ? filter_tags : undefined,
      });

      // Reset
      setName('');
      setTelegramToken('');
      setTelegramChatId('');
      setDiscordWebhookUrl('');
      setSlackWebhookUrl('');
      setGenericWebhookUrl('');
      setWebhookSecret('');
      setFilterTagsInput('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create notification channel');
    } finally {
      setLoading(false);
    }
  };

  const types: { id: ChannelType; label: string; icon: any; desc: string }[] = [
    { id: 'TELEGRAM', label: 'Telegram Bot', icon: Send, desc: 'Instant DM or group message' },
    { id: 'DISCORD', label: 'Discord', icon: MessageSquare, desc: 'Rich embed in channel' },
    { id: 'SLACK', label: 'Slack', icon: Hash, desc: 'Incoming webhook alert' },
    { id: 'WEBHOOK', label: 'Custom Webhook', icon: Webhook, desc: 'JSON payload to your API' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 shadow-2xl shadow-black/90">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">Add Notification Channel</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Connect an alert delivery channel to immediately notify your team on incidents and recoveries.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-destructive/15 border border-destructive/30 text-destructive flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Channel Type Selector */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">Delivery Channel</label>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => {
                const Icon = t.icon;
                const isSelected = channelType === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setChannelType(t.id)}
                    className={`relative flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-400 bg-gradient-to-br from-emerald-500/25 via-emerald-950/40 to-slate-900/90 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50'
                        : 'border-slate-800 bg-slate-950/70 hover:bg-slate-900/90 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                      </span>
                    )}
                    <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-emerald-300' : ''}`} />
                    <div>
                      <div className="text-xs font-semibold">{t.label}</div>
                      <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Channel Friendly Name */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">Channel Name</label>
            <Input
              placeholder={
                channelType === 'TELEGRAM'
                  ? 'e.g. SRE Telegram Channel'
                  : channelType === 'DISCORD'
                  ? 'e.g. #ops-incidents'
                  : 'e.g. On-Call Notification'
              }
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-9 text-xs bg-slate-950/80 border-slate-700/80 focus:border-emerald-500 text-white"
            />
          </div>

          {/* Telegram Config */}
          {channelType === 'TELEGRAM' && (
            <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 shadow-inner">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Bot Token</label>
                <Input
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Chat ID or Channel ID</label>
                <Input
                  placeholder="-1001234567890 or @your_channel"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tip: Create a bot with <b>@BotFather</b> on Telegram, then add it to your group or channel and retrieve your <b>chat_id</b>.
              </p>
            </div>
          )}

          {/* Discord Config */}
          {channelType === 'DISCORD' && (
            <div className="space-y-3 bg-secondary/20 p-3.5 rounded-lg border border-border/50">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Discord Webhook URL</label>
                <Input
                  placeholder="https://discord.com/api/webhooks/..."
                  value={discordWebhookUrl}
                  onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tip: In Discord, go to Server Settings → Integrations → Webhooks → New Webhook, then copy the Webhook URL.
              </p>
            </div>
          )}

          {/* Slack Config */}
          {channelType === 'SLACK' && (
            <div className="space-y-3 bg-secondary/20 p-3.5 rounded-lg border border-border/50">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Slack Webhook URL</label>
                <Input
                  placeholder="https://hooks.slack.com/services/..."
                  value={slackWebhookUrl}
                  onChange={(e) => setSlackWebhookUrl(e.target.value)}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tip: Go to your Slack App configuration and create an Incoming Webhook for your alerts channel.
              </p>
            </div>
          )}

          {/* Custom Webhook Config */}
          {channelType === 'WEBHOOK' && (
            <div className="space-y-3 bg-secondary/20 p-3.5 rounded-lg border border-border/50">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Endpoint URL</label>
                <Input
                  placeholder="https://api.yourdomain.com/v1/alerts/webhook"
                  value={genericWebhookUrl}
                  onChange={(e) => setGenericWebhookUrl(e.target.value)}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Secret Token (Optional)</label>
                <Input
                  placeholder="secret-token-for-signature"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                ResPulse will send a structured JSON payload with event details on incidents and recoveries.
              </p>
            </div>
          )}

          {/* Tag Routing Filter */}
          <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 block">
                Filter by Tags
              </label>
              {!isPro && (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  PRO FEATURE
                </span>
              )}
            </div>
            <Input
              placeholder={isPro ? "e.g. prod, database, critical" : "Available on Pro plan ($16/mo)"}
              value={filterTagsInput}
              onChange={(e) => setFilterTagsInput(e.target.value)}
              disabled={!isPro}
              className="h-8 text-xs font-mono bg-slate-900 border-slate-700/80 focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-muted-foreground">
              {isPro
                ? "Leave blank to receive alerts for all monitors. If tags are specified, this channel only receives alerts for matching monitors."
                : "Route specific alerts (e.g. #database to DevOps) with Pro plan tag routing."}
            </p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {loading ? 'Connecting...' : 'Save Channel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
