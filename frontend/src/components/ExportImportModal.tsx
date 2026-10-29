import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { fetchExportConfig, importConfig } from '../api/client';
import { ResPulseExport, ImportSummary, UserProfile } from '../types';
import {
  Download,
  Upload,
  Copy,
  Check,
  FileJson,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  Bell,
  RefreshCw,
} from 'lucide-react';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  onImportSuccess?: () => void;
  defaultTab?: 'export' | 'import';
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onImportSuccess,
  defaultTab = 'export',
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(defaultTab);

  // Export State
  const [includeSecrets, setIncludeSecrets] = useState(currentUser?.role !== 'VIEWER');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportData, setExportData] = useState<ResPulseExport | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import State
  const [importJsonText, setImportJsonText] = useState('');
  const [parsedImport, setParsedImport] = useState<ResPulseExport | null>(null);
  const [hasMaskedSecrets, setHasMaskedSecrets] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'overwrite' | 'create_copy'>('skip');
  const [importMonitors, setImportMonitors] = useState(true);
  const [importChannels, setImportChannels] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const isViewer = currentUser?.role === 'VIEWER';

  // Synchronize default tab on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setImportSummary(null);
      setParseError(null);
      setHasMaskedSecrets(false);
      const withSecrets = currentUser?.role !== 'VIEWER';
      setIncludeSecrets(withSecrets);
      loadExport(withSecrets);
    }
  }, [isOpen, defaultTab, currentUser?.role]);

  const loadExport = async (withSecrets: boolean) => {
    setExportLoading(true);
    setExportError(null);
    try {
      const data = await fetchExportConfig(withSecrets);
      setExportData(data);
    } catch (err: any) {
      setExportError(err.message || 'Failed to load configuration export');
    } finally {
      setExportLoading(false);
    }
  };

  const handleToggleSecrets = (checked: boolean) => {
    setIncludeSecrets(checked);
    loadExport(checked);
  };

  const handleDownload = () => {
    if (!exportData) return;
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const teamSlug = exportData.team_name
      ? exportData.team_name.toLowerCase().replace(/[^a-z0-9]/g, '-')
      : 'respulse';
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `respulse-config-${teamSlug}-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!exportData) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  // Handle file input for Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      validateAndParseJson(content);
    };
    reader.readAsText(file);
  };

  const validateAndParseJson = (text: string) => {
    setParseError(null);
    setParsedImport(null);
    setImportSummary(null);
    setHasMaskedSecrets(false);

    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed);
      const monitors = parsed.monitors || [];
      const channels = parsed.notification_channels || parsed.channels || [];

      if (!Array.isArray(monitors) && !Array.isArray(channels)) {
        setParseError('Invalid format: file must contain "monitors" or "notification_channels" array.');
        return;
      }

      const masked = channels.some((c: any) =>
        c.config?.bot_token === '********' ||
        (typeof c.config?.webhook_url === 'string' && c.config.webhook_url.endsWith('...'))
      );
      setHasMaskedSecrets(masked);

      setParsedImport({
        version: parsed.version || 1,
        exported_at: parsed.exported_at || new Date().toISOString(),
        app: parsed.app || 'ResPulse',
        team_name: parsed.team_name || null,
        monitors,
        notification_channels: channels,
      });
    } catch (err: any) {
      setParseError('Failed to parse JSON file: ' + err.message);
    }
  };

  const handleImportSubmit = async () => {
    if (!parsedImport) return;
    setImportLoading(true);
    setImportSummary(null);

    try {
      const summary = await importConfig({
        monitors: importMonitors ? parsedImport.monitors : [],
        notification_channels: importChannels ? parsedImport.notification_channels : [],
        conflict_strategy: conflictStrategy,
        import_monitors: importMonitors,
        import_channels: importChannels,
      });

      setImportSummary(summary);
      if (onImportSuccess && (summary.monitors_imported > 0 || summary.monitors_updated > 0 || summary.channels_imported > 0 || summary.channels_updated > 0)) {
        onImportSuccess();
      }
    } catch (err: any) {
      setParseError(err.message || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/10 ring-1 ring-white/5 text-slate-100 p-6 sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <FileJson className="h-5 w-5 text-emerald-400" />
            Export & Import Configuration
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Backup your synthetic monitors and alert channels or restore them across environments.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border/70 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'export'
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            <span>Export Config</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'import'
                ? 'bg-background text-foreground shadow-sm border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload className="h-3.5 w-3.5 text-cyan-400" />
            <span>Import Config</span>
          </button>
        </div>

        {/* TAB 1: EXPORT */}
        {activeTab === 'export' && (
          <div className="space-y-4 pt-2">
            {exportError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{exportError}</span>
              </div>
            )}

            {/* Scope Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/40 border border-border/60 p-3 rounded-xl flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Monitors</div>
                  <div className="text-base font-bold text-white">
                    {exportLoading ? '...' : exportData?.monitors.length ?? 0} endpoints
                  </div>
                </div>
              </div>

              <div className="bg-secondary/40 border border-border/60 p-3 rounded-xl flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Alert Channels</div>
                  <div className="text-base font-bold text-white">
                    {exportLoading ? '...' : exportData?.notification_channels.length ?? 0} configured
                  </div>
                </div>
              </div>
            </div>

            {/* Security Options */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSecrets}
                  onChange={(e) => handleToggleSecrets(e.target.checked)}
                  disabled={isViewer || exportLoading}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-amber-400" />
                    Include sensitive credentials
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Includes basic auth passwords, webhook tokens and bot secrets in plain text. Leave unchecked for sanitized sharing or public backups.
                  </p>
                </div>
              </label>
            </div>

            {/* JSON Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px]">JSON Payload Preview</span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                    includeSecrets
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}>
                    {includeSecrets ? '🔒 Credentials Included' : '🛡️ Credentials Masked'}
                  </span>
                </div>
                <span className="text-[10px]">Version 1.0</span>
              </div>
              <div className="relative rounded-xl border border-white/10 bg-slate-950/80 p-3 overflow-hidden">
                <pre className="text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                  {exportLoading
                    ? '// Generating backup configuration...'
                    : JSON.stringify(exportData, null, 2)}
                </pre>
              </div>
            </div>

            {/* Export Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={exportLoading || !exportData}
                className="gap-1.5 text-xs text-slate-300 hover:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={exportLoading || !exportData}
                className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download JSON Backup</span>
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: IMPORT */}
        {activeTab === 'import' && (
          <div className="space-y-4 pt-2">
            {isViewer && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Requires Engineer role or higher to import configurations.</span>
              </div>
            )}

            {parseError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* File Upload Dropzone */}
            <div className="border-2 border-dashed border-border/80 hover:border-emerald-500/50 rounded-2xl p-4 text-center transition-all bg-secondary/20">
              <input
                type="file"
                id="config-file-input"
                accept=".json,application/json"
                onChange={handleFileUpload}
                disabled={isViewer}
                className="hidden"
              />
              <label htmlFor="config-file-input" className="cursor-pointer block space-y-2">
                <div className="h-10 w-10 mx-auto rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-white hover:text-cyan-300 transition-colors">Choose JSON file</span>
                  <span className="text-muted-foreground"> or drag & drop backup file</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">Accepts ResPulse JSON backup files</p>
              </label>
            </div>

            {/* Textarea for direct paste */}
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-medium">Or paste JSON content directly:</span>
              <textarea
                rows={3}
                value={importJsonText}
                onChange={(e) => {
                  setImportJsonText(e.target.value);
                  validateAndParseJson(e.target.value);
                }}
                disabled={isViewer}
                placeholder='{"version": 1, "monitors": [...], "notification_channels": [...]}'
                className="w-full text-xs font-mono bg-slate-950/80 border border-white/10 rounded-xl p-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Inspection / Detected Content Card */}
            {parsedImport && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Valid ResPulse Configuration Detected</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {parsedImport.team_name ? `From: ${parsedImport.team_name}` : 'v1.0'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/40 border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importMonitors}
                      onChange={(e) => setImportMonitors(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                    />
                    <span className="text-white font-medium">
                      Monitors ({parsedImport.monitors?.length ?? 0})
                    </span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/40 border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importChannels}
                      onChange={(e) => setImportChannels(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                    />
                    <span className="text-white font-medium">
                      Alert Channels ({parsedImport.notification_channels?.length ?? 0})
                    </span>
                  </label>
                </div>

                {/* Warning on Sanitized / Masked Secrets */}
                {hasMaskedSecrets && (
                  <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
                    <div className="text-[11px] leading-relaxed">
                      <span className="font-semibold block text-amber-200">Sanitized Backup File</span>
                      This file was exported without secrets (Telegram bot tokens or webhook URLs are masked with <code className="px-1 py-0.2 bg-black/40 rounded font-mono">********</code>). Channels will be imported, but you will need to edit them to provide real tokens before test alerts can be delivered.
                    </div>
                  </div>
                )}

                {/* Conflict Strategy Selector */}
                <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-200 block">Conflict Resolution (Duplicates):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <label className={`p-2 rounded-lg border cursor-pointer transition-all ${
                      conflictStrategy === 'skip'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                        : 'bg-slate-950/40 border-white/5 text-muted-foreground hover:text-white'
                    }`}>
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="skip"
                        checked={conflictStrategy === 'skip'}
                        onChange={() => setConflictStrategy('skip')}
                        className="sr-only"
                      />
                      <div className="font-medium text-xs">Skip existing</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">Keep current items</div>
                    </label>

                    <label className={`p-2 rounded-lg border cursor-pointer transition-all ${
                      conflictStrategy === 'overwrite'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                        : 'bg-slate-950/40 border-white/5 text-muted-foreground hover:text-white'
                    }`}>
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="overwrite"
                        checked={conflictStrategy === 'overwrite'}
                        onChange={() => setConflictStrategy('overwrite')}
                        className="sr-only"
                      />
                      <div className="font-medium text-xs">Overwrite</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">Update matching items</div>
                    </label>

                    <label className={`p-2 rounded-lg border cursor-pointer transition-all ${
                      conflictStrategy === 'create_copy'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                        : 'bg-slate-950/40 border-white/5 text-muted-foreground hover:text-white'
                    }`}>
                      <input
                        type="radio"
                        name="conflictStrategy"
                        value="create_copy"
                        checked={conflictStrategy === 'create_copy'}
                        onChange={() => setConflictStrategy('create_copy')}
                        className="sr-only"
                      />
                      <div className="font-medium text-xs">Create copies</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">Add with (copy) suffix</div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Import Summary Results */}
            {importSummary && (
              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-emerald-500/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Import Completed Successfully!</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-secondary/30">
                    <span className="text-muted-foreground block text-[10px] uppercase">Monitors</span>
                    <span className="text-emerald-400 font-bold">+{importSummary.monitors_imported}</span> created,{' '}
                    <span className="text-cyan-400">{importSummary.monitors_updated}</span> updated,{' '}
                    <span className="text-slate-400">{importSummary.monitors_skipped}</span> skipped
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/30">
                    <span className="text-muted-foreground block text-[10px] uppercase">Alert Channels</span>
                    <span className="text-emerald-400 font-bold">+{importSummary.channels_imported}</span> created,{' '}
                    <span className="text-cyan-400">{importSummary.channels_updated}</span> updated,{' '}
                    <span className="text-slate-400">{importSummary.channels_skipped}</span> skipped
                  </div>
                </div>
                {importSummary.errors.length > 0 && (
                  <div className="mt-2 text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                    <div className="font-semibold mb-1">Warnings / Errors:</div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {importSummary.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Import Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImportSubmit}
                disabled={isViewer || !parsedImport || importLoading || (!importMonitors && !importChannels)}
                className="gap-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50"
              >
                {importLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <span>{importLoading ? 'Importing...' : 'Start Import'}</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
