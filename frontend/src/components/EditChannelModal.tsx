import React, { useEffect, useState } from 'react';
import { ChannelType, CreateChannelPayload, NotificationChannel } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, MessageSquare, Hash, Webhook, AlertTriangle, ShieldCheck } from 'lucide-react';

interface EditChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: NotificationChannel | null;
  onSubmit: (id: string, payload: Partial<CreateChannelPayload>) => Promise<void>;
}

export const EditChannelModal: React.FC<EditChannelModalProps> = ({
  isOpen,
  onClose,
  channel,
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
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrentTokenMasked =
    channel?.channel_type === 'TELEGRAM' && channel?.config?.bot_token === '********';

  useEffect(() => {
    if (channel && isOpen) {
      setName(channel.name || '');
      setChannelType((channel.channel_type as ChannelType) || 'TELEGRAM');
      setIsActive(channel.is_active ?? true);
      setFilterTagsInput((channel.filter_tags || []).join(', '));
      setError(null);

      const cfg = channel.config || {};
      if (cfg.bot_token === '********') {
        setTelegramToken('');
      } else {
        setTelegramToken(cfg.bot_token || '');
      }
      setTelegramChatId(cfg.chat_id || '');
      setDiscordWebhookUrl(cfg.webhook_url || '');
      setSlackWebhookUrl(cfg.webhook_url || '');
      setGenericWebhookUrl(cfg.webhook_url || '');
      setWebhookSecret(cfg.secret || '');
    }
  }, [channel, isOpen]);

  if (!channel) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }

    let config: Record<string, any> = {};

    if (channelType === 'TELEGRAM') {
      if (!telegramChatId.trim()) {
        setError('Telegram Chat ID is required');
        return;
      }
      if (isCurrentTokenMasked && !telegramToken.trim()) {
        setError('Please enter a valid Telegram Bot Token. Current token is masked ("********") from an import.');
        return;
      }

      config = {
        chat_id: telegramChatId.trim(),
        bot_token: telegramToken.trim() || channel.config?.bot_token || '',
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
      await onSubmit(channel.id, {
        name: name.trim(),
        channel_type: channelType,
        config,
        is_active: isActive,
        filter_tags,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update notification channel');
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
          <DialogTitle className="text-lg font-semibold text-white flex items-center justify-between">
            <span>Edit Notification Channel</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
              isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {isActive ? 'Active' : 'Muted'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update notification credentials, routing tags or active status for this alert destination.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-destructive/15 border border-destructive/30 text-destructive flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Masked Token Alert Notice */}
          {isCurrentTokenMasked && (
            <div className="p-3 text-xs rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-400 flex-shrink-0" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold block text-amber-200">Masked Token Detected</span>
                This channel was imported from a sanitized backup with placeholder token (<code className="px-1 py-0.5 bg-black/40 rounded font-mono">********</code>).
                Please enter the real Telegram Bot Token from @BotFather below to enable alert delivery.
              </div>
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
              placeholder="e.g. SRE Telegram Channel"
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Bot Token</label>
                  {!isCurrentTokenMasked && channel.config?.bot_token && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                      <ShieldCheck className="h-3 w-3" /> Configured
                    </span>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder={
                    isCurrentTokenMasked
                      ? 'Paste your bot token (e.g. 123456789:ABCdefGh...)'
                      : 'Leave unchanged or paste new token to replace'
                  }
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
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
            </div>
          )}

          {/* Tag Routing Filter */}
          <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            <label className="text-xs font-medium text-slate-300 block">
              Filter by Tags (Optional)
            </label>
            <Input
              placeholder="e.g. prod, database, critical"
              value={filterTagsInput}
              onChange={(e) => setFilterTagsInput(e.target.value)}
              className="h-8 text-xs font-mono bg-slate-900 border-slate-700/80 focus:border-emerald-500"
            />
            <p className="text-[10px] text-muted-foreground">
              Comma-separated tags. Leave blank to receive alerts for all monitors.
            </p>
          </div>

          {/* Active Status Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-lg border border-slate-800/60">
            <div className="text-xs">
              <span className="font-medium text-slate-200 block">Channel Status</span>
              <span className="text-[10px] text-muted-foreground">
                {isActive ? 'Channel is active and dispatches alerts on incidents.' : 'Channel is muted; alerts are suppressed.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isActive ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
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
              {loading ? 'Saving...' : 'Update Channel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
