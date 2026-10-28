import React, { useState } from 'react';
import { CreateManualIncidentPayload, IncidentSeverity, IncidentStage, MonitorWithStats } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AlertCircle } from 'lucide-react';
import { createManualIncident } from '../api/client';

interface DeclareIncidentModalProps {
  monitors: MonitorWithStats[];
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const DeclareIncidentModal: React.FC<DeclareIncidentModalProps> = ({
  monitors,
  isOpen,
  onClose,
  onCreated,
}) => {
  const [monitorId, setMonitorId] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('MAJOR');
  const [stage, setStage] = useState<IncidentStage>('INVESTIGATING');
  const [summary, setSummary] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default monitor when modal opens
  React.useEffect(() => {
    if (monitors.length > 0 && !monitorId) {
      setMonitorId(monitors[0].id);
    }
  }, [monitors, monitorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monitorId) {
      setError('Please select an affected monitor');
      return;
    }
    if (!title.trim()) {
      setError('Incident title is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: CreateManualIncidentPayload = {
        monitor_id: monitorId,
        title: title.trim(),
        severity,
        stage,
        summary: summary.trim() || undefined,
        message: message.trim() || summary.trim() || undefined,
      };

      await createManualIncident(payload);
      setTitle('');
      setSummary('');
      setMessage('');
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to declare incident');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[540px] bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-white">Declare Incident or Maintenance</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Publish a manual incident notice or planned maintenance window to the status page.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          {error && (
            <div className="p-2.5 text-xs rounded bg-destructive/15 border border-destructive/30 text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Affected Service</label>
            <select
              value={monitorId}
              onChange={(e) => setMonitorId(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground h-9 focus:ring-1 focus:ring-emerald-500"
            >
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.url})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Incident Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Database Maintenance or Core API Degradation"
              required
              className="h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground h-9 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="CRITICAL">🔴 CRITICAL (Complete Outage)</option>
                <option value="MAJOR">🟠 MAJOR (High Impact)</option>
                <option value="MINOR">🔵 MINOR (Degraded)</option>
                <option value="MAINTENANCE">🟣 MAINTENANCE (Planned)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Initial Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as IncidentStage)}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground h-9 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="INVESTIGATING">Investigating</option>
                <option value="IDENTIFIED">Identified</option>
                <option value="MONITORING">Monitoring</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Public Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder="Brief summary visible on the public status page banner..."
              className="w-full bg-background border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Initial Timeline Note</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Initial status message for users: e.g. We are performing scheduled database indexing..."
              className="w-full bg-background border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
            />
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
              {loading ? 'Publishing...' : 'Declare Incident'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
