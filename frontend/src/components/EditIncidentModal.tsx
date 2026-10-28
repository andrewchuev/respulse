import React, { useState, useEffect } from 'react';
import {
  IncidentSeverity,
  IncidentStage,
  IncidentWithDetails,
  UpdateIncidentPayload,
} from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { timeAgo } from '../lib/utils';
import {
  AlertTriangle,
  Clock,
  Send,
  FileText,
  User,
  Globe,
  Lock,
} from 'lucide-react';
import { addIncidentUpdate, updateIncident } from '../api/client';

interface EditIncidentModalProps {
  incident: IncidentWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const EditIncidentModal: React.FC<EditIncidentModalProps> = ({
  incident,
  isOpen,
  onClose,
  onRefresh,
}) => {
  if (!incident) return null;

  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'postmortem'>('details');

  // Details state
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('MAJOR');
  const [stage, setStage] = useState<IncidentStage>('INVESTIGATING');
  const [summary, setSummary] = useState('');
  const [postMortem, setPostMortem] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New update state
  const [updateStage, setUpdateStage] = useState<IncidentStage>('INVESTIGATING');
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateAuthor, setUpdateAuthor] = useState('On-Call SRE');
  const [postingUpdate, setPostingUpdate] = useState(false);

  useEffect(() => {
    if (incident) {
      setTitle(incident.title || `${incident.monitor_name} Service Disruption`);
      setSeverity(incident.severity || 'MAJOR');
      setStage(incident.stage || (incident.status === 'RESOLVED' ? 'RESOLVED' : 'INVESTIGATING'));
      setSummary(incident.summary || '');
      setPostMortem(incident.post_mortem || '');
      setIsPublished(incident.is_published ?? true);
      setUpdateStage(incident.stage || 'INVESTIGATING');
    }
  }, [incident]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const payload: UpdateIncidentPayload = {
        title: title.trim(),
        severity,
        stage,
        summary: summary.trim() || undefined,
        post_mortem: postMortem.trim() || undefined,
        is_published: isPublished,
      };

      await updateIncident(incident.id, payload);
      setFeedback('Incident and post-mortem updated successfully!');
      onRefresh();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback(err.message || 'Failed to update incident');
    } finally {
      setSaving(false);
    }
  };

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateMessage.trim()) return;

    setPostingUpdate(true);
    try {
      await addIncidentUpdate(incident.id, {
        stage: updateStage,
        message: updateMessage.trim(),
        author: updateAuthor.trim() || 'On-Call SRE',
      });

      setUpdateMessage('');
      setStage(updateStage);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to post update');
    } finally {
      setPostingUpdate(false);
    }
  };

  const insertPostMortemTemplate = () => {
    const template = `## 1. Incident Overview
- **Service Affected:** ${incident.monitor_name}
- **Impact Duration:** ${incident.duration_seconds ? `${Math.round(incident.duration_seconds / 60)} minutes` : 'Ongoing'}
- **Severity Level:** ${severity}

## 2. Root Cause Analysis (RCA)
Technical details of why the failure occurred:
${incident.root_cause || 'Elevated response latency and error responses from target endpoint.'}

## 3. Resolution & Mitigation
Immediate actions taken by the response team to restore normal operations.

## 4. Corrective & Preventative Actions
- [ ] Add enhanced synthetic alerts for early degradation detection
- [ ] Review auto-scaling and retry parameters
- [ ] Update disaster recovery runbooks`;

    setPostMortem(template);
  };

  const getStageColor = (st: IncidentStage) => {
    switch (st) {
      case 'INVESTIGATING':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'IDENTIFIED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'MONITORING':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'RESOLVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  const getSeverityBadge = (sev: IncidentSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge className="bg-red-600 text-white font-mono text-[10px]">CRITICAL</Badge>;
      case 'MAJOR':
        return <Badge className="bg-amber-600 text-white font-mono text-[10px]">MAJOR</Badge>;
      case 'MINOR':
        return <Badge className="bg-blue-600 text-white font-mono text-[10px]">MINOR</Badge>;
      case 'MAINTENANCE':
        return <Badge className="bg-purple-600 text-white font-mono text-[10px]">MAINTENANCE</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-white">
                  Incident Management & Post-Mortem
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono">
                  {incident.monitor_name} • Started {timeAgo(incident.started_at)}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getSeverityBadge(severity)}
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getStageColor(stage)}`}>
                {stage}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-lg border border-border/60 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'details'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Incident Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="h-3 w-3" />
            Live Timeline ({incident.updates?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('postmortem')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'postmortem'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-3 w-3" />
            Post-Mortem & RCA
          </button>
        </div>

        {feedback && (
          <div className="p-2.5 text-xs rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
            {feedback}
          </div>
        )}

        {/* Tab 1: Overview & Details */}
        {activeTab === 'details' && (
          <form onSubmit={handleSaveDetails} className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Public Incident Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Elevated Latency on API Gateway"
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
                  <option value="MINOR">🔵 MINOR (Degraded Performance)</option>
                  <option value="MAINTENANCE">🟣 MAINTENANCE (Scheduled)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Current Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as IncidentStage)}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1 text-xs text-foreground h-9 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="INVESTIGATING">Investigating</option>
                  <option value="IDENTIFIED">Identified</option>
                  <option value="MONITORING">Monitoring Fix</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Business & Client Summary
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="Human-readable explanation of what happened for public status page and users..."
                className="w-full bg-background border border-border rounded-md p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
              />
            </div>

            {/* Technical Root Cause Info */}
            {incident.root_cause && (
              <div className="bg-secondary/20 p-3 rounded-lg border border-border/50 text-xs">
                <span className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">
                  Automated Probe Error Diagnostic
                </span>
                <code className="text-red-400 font-mono text-xs">{incident.root_cause}</code>
              </div>
            )}

            {/* Visibility toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/15 border border-border/50">
              <div className="flex items-center gap-2">
                {isPublished ? <Globe className="h-4 w-4 text-emerald-400" /> : <Lock className="h-4 w-4 text-amber-400" />}
                <div>
                  <span className="text-xs font-medium text-white block">
                    {isPublished ? 'Visible on Public Status Page' : 'Private (Internal Team Only)'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Control whether end-users see this incident at https://respulse.wsl.local/status-page
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                {saving ? 'Saving...' : 'Save Incident Changes'}
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Timeline Updates */}
        {activeTab === 'timeline' && (
          <div className="space-y-4 pt-1">
            {/* New Update Form */}
            <form onSubmit={handlePostUpdate} className="bg-secondary/20 p-3.5 rounded-xl border border-border/60 space-y-3">
              <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-emerald-400" />
                Post Timeline Status Update
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Update Stage</label>
                  <select
                    value={updateStage}
                    onChange={(e) => setUpdateStage(e.target.value as IncidentStage)}
                    className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground h-8 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="INVESTIGATING">Investigating</option>
                    <option value="IDENTIFIED">Identified</option>
                    <option value="MONITORING">Monitoring</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Author / Title</label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={updateAuthor}
                      onChange={(e) => setUpdateAuthor(e.target.value)}
                      placeholder="e.g. Lead SRE Engineer"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Message</label>
                <textarea
                  value={updateMessage}
                  onChange={(e) => setUpdateMessage(e.target.value)}
                  rows={2}
                  placeholder="e.g. We have deployed a hotfix to edge proxies and are monitoring error recovery..."
                  required
                  className="w-full bg-background border border-border rounded-md p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={postingUpdate || !updateMessage.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium h-8 text-xs gap-1"
                >
                  <Send className="h-3 w-3" />
                  {postingUpdate ? 'Posting...' : 'Post Status Update'}
                </Button>
              </div>
            </form>

            {/* Chronological Timeline */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Chronological Incident Timeline ({incident.updates?.length || 0})
              </h4>

              {incident.updates && incident.updates.length > 0 ? (
                <div className="relative pl-6 space-y-4 border-l border-border/80 ml-2">
                  {incident.updates.map((up) => (
                    <div key={up.id} className="relative group">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-background border-2 border-emerald-400" />

                      <div className="bg-card/50 p-3 rounded-lg border border-border/50 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getStageColor(up.stage)}`}>
                              {up.stage}
                            </span>
                            <span className="text-[11px] font-medium text-white">{up.author}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(up.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/90 whitespace-pre-wrap">{up.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No timeline updates posted yet.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Post-Mortem & RCA */}
        {activeTab === 'postmortem' && (
          <form onSubmit={handleSaveDetails} className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-white">Post-Mortem & Root Cause Analysis (RCA)</h4>
                <p className="text-[11px] text-muted-foreground">
                  Published after service restoration to detail impact, root cause, and preventative action items.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={insertPostMortemTemplate}
                className="text-xs h-7 gap-1"
              >
                Insert Standard Template
              </Button>
            </div>

            <div>
              <textarea
                value={postMortem}
                onChange={(e) => setPostMortem(e.target.value)}
                rows={12}
                placeholder="Write detailed post-mortem report (Markdown supported)..."
                className="w-full bg-background border border-border rounded-md p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono leading-relaxed"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-muted-foreground">
                {postMortem ? 'Report ready for public transparency.' : 'No post-mortem written yet.'}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                >
                  {saving ? 'Saving...' : 'Publish Post-Mortem'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
