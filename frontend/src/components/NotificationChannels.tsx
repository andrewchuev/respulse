import React, { useEffect, useState } from 'react';
import { AlertLogWithDetails, CreateChannelPayload, NotificationChannel, UserProfile } from '../types';
import {
  createChannel,
  deleteChannel,
  fetchAlertLogs,
  fetchChannels,
  testChannel,
  updateChannel,
} from '../api/client';
import { timeAgo } from '../lib/utils';
import {
  Bell,
  Send,
  MessageSquare,
  Hash,
  Webhook,
  Plus,
  Play,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { AddChannelModal } from './AddChannelModal';
import { EditChannelModal } from './EditChannelModal';

interface NotificationChannelsProps {
  currentUser?: UserProfile | null;
}

export const NotificationChannels: React.FC<NotificationChannelsProps> = ({ currentUser }) => {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [logs, setLogs] = useState<AlertLogWithDetails[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const isViewer = currentUser?.role === 'VIEWER';

  const loadData = async () => {
    try {
      const [ch, l] = await Promise.all([fetchChannels(), fetchAlertLogs()]);
      setChannels(ch);
      setLogs(l);
    } catch (e) {
      console.error('Error loading channels:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (payload: CreateChannelPayload) => {
    await createChannel(payload);
    await loadData();
    setIsAddModalOpen(false);
  };

  const handleUpdate = async (id: string, payload: Partial<CreateChannelPayload>) => {
    const updated = await updateChannel(id, payload);
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    await loadData();
  };

  const handleToggle = async (channel: NotificationChannel) => {
    try {
      const updated = await updateChannel(channel.id, { is_active: !channel.is_active });
      setChannels((prev) => prev.map((c) => (c.id === channel.id ? { ...c, ...updated } : c)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this notification channel?')) return;
    try {
      await deleteChannel(id);
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestFeedback(null);
    try {
      const res = await testChannel(id);
      setTestFeedback({
        id,
        success: res.success,
        message: res.success ? 'Delivered successfully!' : res.error || 'Delivery failed',
      });
      // Refresh logs
      fetchAlertLogs().then(setLogs).catch(() => {});
    } catch (e: any) {
      setTestFeedback({
        id,
        success: false,
        message: e.message || 'Network error',
      });
    } finally {
      setTestingId(null);
      setTimeout(() => setTestFeedback(null), 5000);
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'TELEGRAM':
        return <Send className="h-4 w-4 text-sky-400" />;
      case 'DISCORD':
        return <MessageSquare className="h-4 w-4 text-indigo-400" />;
      case 'SLACK':
        return <Hash className="h-4 w-4 text-amber-400" />;
      default:
        return <Webhook className="h-4 w-4 text-emerald-400" />;
    }
  };

  const maskValue = (type: string, config: Record<string, any>) => {
    if (type === 'TELEGRAM') {
      const chat = config.chat_id || '';
      return `Chat: ${chat}`;
    }
    const url = config.webhook_url || '';
    if (!url) return '—';
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname.slice(0, 15)}...`;
    } catch {
      return url.slice(0, 30) + '...';
    }
  };

  const totalDelivered = logs.filter((l) => l.status === 'SUCCESS').length;
  const totalFailed = logs.filter((l) => l.status === 'FAILED').length;
  const successRate = logs.length > 0 ? ((totalDelivered / logs.length) * 100).toFixed(0) : '100';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        <p className="text-xs text-muted-foreground font-mono">Loading alert delivery network...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-card/60 backdrop-blur border-border/80">
          <CardContent className="p-3.5 sm:p-5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Configured Channels</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-white">{channels.length}</span>
                <span className="text-xs text-emerald-400 font-mono">
                  ({channels.filter((c) => c.is_active).length} active)
                </span>
              </div>
            </div>
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Bell className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur border-border/80">
          <CardContent className="p-3.5 sm:p-5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Alerts Dispatched</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-400">{totalDelivered}</span>
                <span className="text-xs text-muted-foreground">sent successfully</span>
              </div>
            </div>
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur border-border/80">
          <CardContent className="p-3.5 sm:p-5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Delivery Rate</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white">{successRate}%</span>
                {totalFailed > 0 && (
                  <span className="text-xs text-red-400 font-mono">({totalFailed} failed)</span>
                )}
              </div>
            </div>
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Radio className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Notification Channels</h2>
          <p className="text-xs text-muted-foreground">
            On-call teams and engineers are immediately notified when a service degrades or recovers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadData} className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            disabled={isViewer}
            className={`h-9 font-medium shadow-lg gap-1.5 text-xs ${
              isViewer
                ? 'opacity-40 cursor-not-allowed bg-secondary text-muted-foreground'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
            }`}
            title={isViewer ? 'Requires Engineer role or higher to add notification channels' : 'Add Channel'}
          >
            <Plus className="h-4 w-4" />
            Add Channel
          </Button>
        </div>
      </div>

      {/* Channel Cards */}
      {channels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {channels.map((channel) => {
            const isTesting = testingId === channel.id;
            const feedback = testFeedback?.id === channel.id ? testFeedback : null;

            return (
              <div
                key={channel.id}
                className="bg-card/70 border border-border/80 hover:border-border rounded-xl p-4 transition-all shadow-sm flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary/80 border border-border flex items-center justify-center flex-shrink-0">
                      {getChannelIcon(channel.channel_type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white text-sm truncate">{channel.name}</h4>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                          {channel.channel_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[260px]">
                        {maskValue(channel.channel_type, channel.config)}
                      </p>

                      {/* Tag Routing Filter Badges */}
                      {channel.filter_tags && channel.filter_tags.length > 0 ? (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground font-mono">Routing:</span>
                          {channel.filter_tags.map(t => (
                            <span key={t} className="inline-flex items-center text-[9px] font-mono font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-1.5 py-0.2 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-[10px] text-muted-foreground font-mono">Routing:</span>
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-800/50 px-1.5 py-0.2 rounded">
                            All Monitors
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(channel)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium border transition-colors ${
                        channel.is_active
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60'
                      }`}
                    >
                      {channel.is_active ? 'ACTIVE' : 'MUTED'}
                    </button>
                  </div>
                </div>

                {/* Feedback Toast Banner */}
                {feedback && (
                  <div
                    className={`p-2 rounded text-xs flex items-center gap-2 ${
                      feedback.success
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/15 border border-red-500/30 text-red-400'
                    }`}
                  >
                    {feedback.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    )}
                    <span className="truncate">{feedback.message}</span>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                  <span className="text-[11px] text-muted-foreground">
                    Created {timeAgo(channel.created_at)}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2.5 gap-1.5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={isTesting || isViewer}
                      title={isViewer ? 'Requires Engineer role or higher to test alerts' : 'Send test alert'}
                      onClick={() => handleTest(channel.id)}
                    >
                      <Play className={`h-3 w-3 ${isTesting ? 'animate-spin text-emerald-400' : ''}`} />
                      {isTesting ? 'Sending...' : 'Send Test Alert'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={isViewer}
                      title={isViewer ? 'Requires Engineer role or higher to edit channels' : 'Edit channel'}
                      onClick={() => setEditingChannel(channel)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={isViewer}
                      title={isViewer ? 'Requires Engineer role or higher to delete channels' : 'Delete channel'}
                      onClick={() => handleDelete(channel.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-card/30 rounded-2xl border border-dashed border-border/80 p-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No notification channels configured</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            Connect Telegram, Discord, Slack or custom Webhooks so your team is instantly notified when outages occur.
          </p>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            Configure First Channel
          </Button>
        </div>
      )}

      {/* Live Alert Delivery Logs */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-emerald-400" />
            Alert Delivery History
          </h3>
          <span className="text-xs text-muted-foreground">Last 50 alert transmissions</span>
        </div>

        <div className="border border-border/80 rounded-xl overflow-hidden bg-card/60 backdrop-blur">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 text-muted-foreground border-b border-border/80 font-mono text-[11px]">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Event</th>
                <th className="p-3">Target Monitor</th>
                <th className="p-3">Delivery Status</th>
                <th className="p-3">Diagnostics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {logs.length > 0 ? (
                logs.map((log) => {
                  const isSuccess = log.status === 'SUCCESS';
                  const isDown = log.event_type === 'DOWN';
                  const isResolved = log.event_type === 'RESOLVED';

                  return (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="p-3 text-muted-foreground font-mono whitespace-nowrap">
                        {timeAgo(log.sent_at)}
                      </td>
                      <td className="p-3 font-semibold text-white">
                        <div className="flex items-center gap-1.5">
                          {getChannelIcon(log.channel_type)}
                          <span>{log.channel_name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isDown
                              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                              : isResolved
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                          }`}
                        >
                          {log.event_type}
                        </span>
                      </td>
                      <td className="p-3 text-white font-mono truncate max-w-[200px]">
                        {log.monitor_name || 'System Test'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            isSuccess ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-[11px] truncate max-w-[240px]">
                        {log.error_message || 'Delivered to gateway OK'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No alert delivery logs yet. When incidents occur or test alerts are triggered, logs will appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddChannelModal
        isOpen={isAddModalOpen}
        isPro={currentUser?.team_plan === 'PRO'}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreate}
      />

      <EditChannelModal
        isOpen={Boolean(editingChannel)}
        isPro={currentUser?.team_plan === 'PRO'}
        channel={editingChannel}
        onClose={() => setEditingChannel(null)}
        onSubmit={handleUpdate}
      />
    </div>
  );
};
