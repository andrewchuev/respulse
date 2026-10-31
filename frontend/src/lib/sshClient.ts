/**
 * ResPulse SRE Mobile & Desktop Local SSH Client
 *
 * All credentials (passwords, private keys) are stored SOLELY on the user's local device, encrypted
 * by a key held in the OS keyring / Android Keystore, and are NEVER transmitted to ResPulse servers.
 */

export interface SshAuthPassword {
  type: 'Password';
  value: string;
}

export interface SshAuthPrivateKey {
  type: 'PrivateKey';
  value: {
    key: string;
    passphrase?: string;
  };
}

export interface SshAuthAgent {
  type: 'Agent';
}

export type SshAuth = SshAuthPassword | SshAuthPrivateKey | SshAuthAgent;

export interface SshProfile {
  monitor_id: string;
  monitor_name?: string;
  host: string;
  port: number;
  username: string;
  auth: SshAuth;
  service_name?: string;
  custom_commands?: Array<{ label: string; command: string }>;
  updated_at: string;
}

export interface SshTestResult {
  success: boolean;
  message: string;
  banner?: string;
  latency_ms: number;
}

export interface SshExecResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}

const STORAGE_KEY = 'respulse_local_ssh_profiles_v1';

/**
 * Check if the frontend is running inside Tauri 2 native desktop or mobile container
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window
  );
}

const NATIVE_ONLY_MSG = 'The SSH console is only available in the ResPulse desktop and mobile apps.';

/**
 * Credentials must never sit in browser storage, where any script on the origin can read them;
 * this wipes profiles saved by earlier web builds.
 */
export function purgeWebSshProfiles(): void {
  if (isTauri()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be blocked; nothing to purge then.
  }
}

const PROFILE_KEY_PREFIX = 'ssh_profile:';

async function vaultInvoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new Error(NATIVE_ONLY_MSG);
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    throw new Error(String(err));
  }
}

/**
 * Get the SSH profile of a monitor from the native encrypted vault (OS keyring / Android Keystore)
 */
export async function getSshProfile(monitorId: string): Promise<SshProfile | null> {
  // A profile may still sit in WebView storage on the first launch after an update.
  await migrateLegacySshProfiles();
  const raw = await vaultInvoke<string | null>('secret_get', { key: PROFILE_KEY_PREFIX + monitorId });
  return raw ? (JSON.parse(raw) as SshProfile) : null;
}

/**
 * Save an SSH profile into the native encrypted vault (Zero-Knowledge)
 */
export async function saveSshProfile(profile: SshProfile): Promise<SshProfile> {
  const stored = { ...profile, updated_at: new Date().toISOString() };
  await vaultInvoke('secret_set', {
    key: PROFILE_KEY_PREFIX + profile.monitor_id,
    value: JSON.stringify(stored),
  });
  return stored;
}

/**
 * Delete an SSH profile from the native encrypted vault
 */
export async function deleteSshProfile(monitorId: string): Promise<void> {
  await vaultInvoke('secret_delete', { key: PROFILE_KEY_PREFIX + monitorId });
}

/**
 * Moves profiles saved in WebView storage by earlier builds into the vault. The plaintext copy is
 * removed only after every profile was written, so a failed run is retried on the next launch.
 */
export function migrateLegacySshProfiles(): Promise<void> {
  migration ??= runLegacyMigration();
  return migration;
}

let migration: Promise<void> | null = null;

async function runLegacyMigration(): Promise<void> {
  if (!isTauri()) return;
  let legacy: Record<string, SshProfile>;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    legacy = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read legacy SSH profiles:', err);
    return;
  }

  try {
    for (const [monitorId, profile] of Object.entries(legacy)) {
      await vaultInvoke('secret_set', { key: PROFILE_KEY_PREFIX + monitorId, value: JSON.stringify(profile) });
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('SSH profile migration failed, will retry on next launch:', err);
  }
}

/**
 * Test SSH connection to target
 */
export async function testSshConnection(profile: SshProfile): Promise<SshTestResult> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<SshTestResult>('ssh_test_connection', {
        params: {
          host: profile.host,
          port: profile.port || 22,
          username: profile.username,
          auth: profile.auth,
          timeout_seconds: 8,
        },
      });
    } catch (err: any) {
      throw new Error(err.toString());
    }
  }

  throw new Error(NATIVE_ONLY_MSG);
}

/**
 * Execute an SSH command remotely
 */
export async function executeSshCommand(profile: SshProfile, command: string): Promise<SshExecResult> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<SshExecResult>('ssh_execute_command', {
        params: {
          host: profile.host,
          port: profile.port || 22,
          username: profile.username,
          auth: profile.auth,
          command,
          timeout_seconds: 15,
        },
      });
    } catch (err: any) {
      throw new Error(err.toString());
    }
  }

  throw new Error(NATIVE_ONLY_MSG);
}

/**
 * Launch external SSH terminal via deep-link URI
 */
export async function launchExternalSsh(profile: SshProfile): Promise<void> {
  const uri = `ssh://${encodeURIComponent(profile.username)}@${profile.host}:${profile.port || 22}`;

  if (!isTauri()) throw new Error(NATIVE_ONLY_MSG);

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_external_ssh', { uri });
  } catch (err) {
    console.warn('Tauri open_external_ssh failed, falling back to window.open:', err);
    window.open(uri, '_blank');
  }
}
