import { isTauri } from './sshClient';
import { checkStatus, authenticate, BiometryType } from '@tauri-apps/plugin-biometric';

const BIOMETRIC_ENABLED_KEY = 'respulse_biometric_enabled';
const SAVED_BIOMETRIC_SESSION = 'respulse_biometric_session';

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: BiometryType;
  error?: string;
}

/**
 * Checks if biometric authentication (fingerprint / face) is supported and enrolled on the device.
 */
export async function getBiometricStatus(): Promise<BiometricStatus> {
  if (!isTauri()) {
    return { isAvailable: false, biometryType: BiometryType.None };
  }
  try {
    const status = await checkStatus();
    return {
      isAvailable: !!status.isAvailable,
      biometryType: status.biometryType ?? BiometryType.None,
      error: status.error,
    };
  } catch (err: any) {
    console.warn('Biometric status check failed:', err);
    return { isAvailable: false, biometryType: BiometryType.None, error: err?.message };
  }
}

/**
 * Prompts the user with the native system fingerprint / biometric dialog.
 */
export async function promptBiometricAuth(reason = 'Подтвердите личность для входа в ResPulse'): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await authenticate(reason, {
      title: 'ResPulse',
      subtitle: 'Вход по отпечатку пальца',
      allowDeviceCredential: true,
      cancelTitle: 'Отмена',
    });
    return true;
  } catch (err) {
    console.warn('Biometric auth cancelled or failed:', err);
    return false;
  }
}

export function isBiometricEnabledLocally(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBiometricEnabledLocally(enabled: boolean, token?: string | null) {
  try {
    if (enabled) {
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      if (token) {
        localStorage.setItem(SAVED_BIOMETRIC_SESSION, token);
      }
    } else {
      localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      localStorage.removeItem(SAVED_BIOMETRIC_SESSION);
    }
  } catch {}
}

export function getSavedBiometricSession(): string | null {
  try {
    return localStorage.getItem(SAVED_BIOMETRIC_SESSION) || localStorage.getItem('respulse_jwt_token');
  } catch {
    return null;
  }
}
