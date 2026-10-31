import React, { useState, useEffect } from 'react';
import {
  MonitorWithStats,
} from '../types';
import {
  SshProfile,
  getSshProfile,
  saveSshProfile,
  deleteSshProfile,
  testSshConnection,
  executeSshCommand,
  launchExternalSsh,
} from '../lib/sshClient';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Terminal,
  Play,
  RotateCw,
  Key,
  ShieldCheck,
  ExternalLink,
  Copy,
  Trash2,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  Laptop,
} from 'lucide-react';

interface SshConsolePanelProps {
  monitor: MonitorWithStats;
}

function extractDefaultHost(rawUrl: string): string {
  try {
    if (!rawUrl.includes('://')) {
      const parts = rawUrl.split(':');
      return parts[0] || 'localhost';
    }
    const parsed = new URL(rawUrl);
    return parsed.hostname;
  } catch {
    return rawUrl.replace(/^https?:\/\//, '').split('/')[0].split(':')[0] || 'localhost';
  }
}

export const SshConsolePanel: React.FC<SshConsolePanelProps> = ({ monitor }) => {
  const [profile, setProfile] = useState<SshProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'Password' | 'PrivateKey' | 'Agent'>('Password');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [serviceName, setServiceName] = useState('');

  // Execution states
  const [customCommand, setCustomCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [activeActionLabel, setActiveActionLabel] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [outputMeta, setOutputMeta] = useState<{ exitCode: number; durationMs: number; timestamp: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency_ms?: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const existing = getSshProfile(monitor.id);
    if (existing) {
      setProfile(existing);
      setHost(existing.host);
      setPort(existing.port);
      setUsername(existing.username);
      setServiceName(existing.service_name || '');
      if (existing.auth.type === 'Password') {
        setAuthType('Password');
        setPassword(existing.auth.value);
      } else if (existing.auth.type === 'PrivateKey') {
        setAuthType('PrivateKey');
        setPrivateKey(existing.auth.value.key);
        setPassphrase(existing.auth.value.passphrase || '');
      } else {
        setAuthType('Agent');
      }
      setIsEditing(false);
    } else {
      const defHost = extractDefaultHost(monitor.url);
      setHost(defHost);
      setPort(22);
      setUsername('root');
      setServiceName(monitor.name.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
      setProfile(null);
      setIsEditing(true);
    }
    setOutput(null);
    setOutputMeta(null);
    setTestResult(null);
  }, [monitor.id, monitor.url, monitor.name]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim() || !username.trim()) return;

    let authPayload: SshProfile['auth'];
    if (authType === 'Password') {
      authPayload = { type: 'Password', value: password };
    } else if (authType === 'PrivateKey') {
      authPayload = {
        type: 'PrivateKey',
        value: { key: privateKey, passphrase: passphrase || undefined },
      };
    } else {
      authPayload = { type: 'Agent' };
    }

    const newProfile: SshProfile = {
      monitor_id: monitor.id,
      monitor_name: monitor.name,
      host: host.trim(),
      port: Number(port) || 22,
      username: username.trim(),
      auth: authPayload,
      service_name: serviceName.trim() || undefined,
      updated_at: new Date().toISOString(),
    };

    saveSshProfile(newProfile);
    setProfile(newProfile);
    setIsEditing(false);
    setTestResult(null);
  };

  const handleDeleteProfile = () => {
    if (confirm('Remove local SSH credentials for this endpoint?')) {
      deleteSshProfile(monitor.id);
      setProfile(null);
      setIsEditing(true);
      setOutput(null);
      setTestResult(null);
    }
  };

  const handleTestConnection = async () => {
    if (!profile) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSshConnection(profile);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRunCommand = async (cmd: string, label?: string) => {
    if (!profile || !cmd.trim()) return;
    setRunning(true);
    setActiveActionLabel(label || null);
    try {
      const res = await executeSshCommand(profile, cmd.trim());
      const displayOut = res.stderr ? `${res.stdout}\n[STDERR]:\n${res.stderr}` : res.stdout;
      setOutput(displayOut || '(command executed successfully with no output)');
      setOutputMeta({
        exitCode: res.exit_code,
        durationMs: res.duration_ms,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setOutput(`[SSH EXECUTION ERROR]: ${err.message || err.toString()}`);
      setOutputMeta({
        exitCode: 1,
        durationMs: 0,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setRunning(false);
      setActiveActionLabel(null);
    }
  };

  const handleLaunchTerminal = async () => {
    if (!profile) return;
    await launchExternalSsh(profile);
  };

  const handleCopyOutput = () => {
    if (output) {
      navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const svc = profile?.service_name || monitor.name.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'service';

  const quickRunbooks = [
    { label: 'Systemd Status', cmd: `systemctl status ${svc} --no-pager` },
    { label: 'Recent Logs', cmd: `journalctl -u ${svc} -n 50 --no-pager 2>/dev/null || tail -n 50 /var/log/syslog` },
    { label: 'Resource Usage', cmd: 'uptime && echo "--- MEMORY ---" && free -h && echo "--- DISK ---" && df -h' },
    { label: 'Top Processes', cmd: 'ps aux --sort=-%mem | head -n 12' },
    { label: 'Docker Containers', cmd: 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"' },
    { label: 'Restart Service', cmd: `sudo systemctl restart ${svc} && systemctl status ${svc} --no-pager` },
  ];

  return (
    <div className="space-y-4">
      {/* Platform & Zero-Knowledge Banner */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold text-white">Zero-Knowledge Client Storage</span>
            <span className="text-slate-400 block text-[11px]">
              SSH keys and passwords are stored solely on this device and are never sent to ResPulse servers.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
          <Laptop className="h-3 w-3 text-cyan-400" />
          <span>Tauri 2 Native Client</span>
        </div>
      </div>

      {/* VIEW: CONFIGURATION FORM */}
      {isEditing ? (
        <form onSubmit={handleSaveProfile} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div className="font-semibold text-white text-sm flex items-center gap-2">
              <Key className="h-4 w-4 text-emerald-400" />
              <span>Configure SRE SSH Profile for {monitor.name}</span>
            </div>
            {profile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="h-7 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-mono text-slate-300">Host / IP</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="e.g. 192.168.1.100 or api.example.com"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">SSH Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                placeholder="22"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="root / ubuntu / devops"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300">Service Name (optional)</label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. nginx, postgresql, app"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-300">Authentication Method</label>
            <div className="flex gap-2">
              {(['Password', 'PrivateKey', 'Agent'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAuthType(type)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border font-mono transition-colors ${
                    authType === type
                      ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-300 font-semibold'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                  }`}
                >
                  {type === 'Password' ? 'Password' : type === 'PrivateKey' ? 'Private Key (PEM)' : 'SSH Agent'}
                </button>
              ))}
            </div>

            {authType === 'Password' && (
              <div className="pt-1">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter SSH password..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {authType === 'PrivateKey' && (
              <div className="space-y-2 pt-1">
                <textarea
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  rows={4}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-[11px] text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Key passphrase (optional)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 px-4"
            >
              Save SSH Profile
            </Button>
          </div>
        </form>
      ) : (
        /* VIEW: ACTIVE CONSOLE & RUNBOOKS */
        <div className="space-y-3">
          {/* Active Profile Info Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-2.5">
              <Server className="h-4 w-4 text-emerald-400" />
              <div>
                <div className="font-mono text-xs font-semibold text-white flex items-center gap-1.5">
                  <span>{profile?.username}@{profile?.host}:{profile?.port}</span>
                  <Badge variant="outline" className="text-[9px] bg-slate-950 text-emerald-400 border-emerald-500/30">
                    {profile?.auth.type}
                  </Badge>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Service target: <span className="text-slate-300 font-semibold">{svc}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
                className="h-8 text-xs border-slate-800 hover:bg-slate-800 text-slate-300 gap-1"
              >
                {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                Test
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLaunchTerminal}
                className="h-8 text-xs border-slate-800 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 gap-1 font-mono"
                title="Launch in Terminal app or Termius (ssh://)"
              >
                <ExternalLink className="h-3 w-3" />
                Terminal
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                title="Edit connection profile"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteProfile}
                className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                title="Remove local profile"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Test connection alert */}
          {testResult && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                testResult.success
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/30 border-red-500/40 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.latency_ms !== undefined && (
                <span className="font-mono text-[10px] text-slate-400">{testResult.latency_ms} ms</span>
              )}
            </div>
          )}

          {/* One-Click SRE Runbook Actions */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Play className="h-3 w-3 text-cyan-400" />
              <span>One-Click SRE Runbooks</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quickRunbooks.map((rb, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleRunCommand(rb.cmd, rb.label)}
                  disabled={running}
                  className="p-2 text-left rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs transition-colors flex flex-col justify-between group disabled:opacity-50"
                >
                  <div className="font-semibold text-slate-200 group-hover:text-cyan-300 flex items-center justify-between">
                    <span>{rb.label}</span>
                    {running && activeActionLabel === rb.label && (
                      <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate mt-1">
                    {rb.cmd}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Command Input Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Run Custom Command
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2 font-mono text-xs text-emerald-400">$</span>
                <input
                  type="text"
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRunCommand(customCommand, 'Custom Command');
                  }}
                  placeholder="e.g. docker ps, systemctl restart nginx, htop, curl localhost:8080..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleRunCommand(customCommand, 'Custom Command')}
                disabled={running || !customCommand.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs h-8 px-4 gap-1.5"
              >
                {running && activeActionLabel === 'Custom Command' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Terminal className="h-3.5 w-3.5" />
                )}
                Run
              </Button>
            </div>
          </div>

          {/* Terminal Console Output */}
          {output && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">Console Output:</span>
                  {outputMeta && (
                    <>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          outputMeta.exitCode === 0
                            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-red-400 border-red-500/30 bg-red-500/10'
                        }`}
                      >
                        exit: {outputMeta.exitCode}
                      </Badge>
                      <span className="text-slate-500">{outputMeta.durationMs}ms</span>
                      <span className="text-slate-600">at {outputMeta.timestamp}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyOutput}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutput(null);
                      setOutputMeta(null);
                    }}
                    className="hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="bg-black/90 rounded-xl border border-slate-800 p-3 font-mono text-xs text-emerald-400 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed shadow-inner">
                {output}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
