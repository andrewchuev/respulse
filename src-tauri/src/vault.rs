//! Encrypted on-device store for SSH credentials.
//!
//! All secrets live in one AES-256-GCM sealed file in the app data directory, so nothing sensitive
//! is kept in WebView storage. The key never touches disk in the clear: desktop and iOS keep it in
//! the OS keyring, Android seals the file inside a non-exportable Android Keystore key.

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Runtime, State};

type Secrets = BTreeMap<String, String>;

const VAULT_FILE: &str = "ssh-vault.bin";

/// Why a sealed blob could not be opened.
#[derive(Debug)]
enum OpenError {
    /// The key is gone or the data is damaged; the contents can never be recovered.
    Unrecoverable(String),
    /// The key store is temporarily unreachable; the data may still be fine.
    Unavailable(String),
}

trait Sealer: Send + Sync {
    fn seal(&self, plaintext: &[u8]) -> Result<Vec<u8>, String>;
    fn open(&self, sealed: &[u8]) -> Result<Vec<u8>, OpenError>;
}

pub struct Vault {
    path: PathBuf,
    sealer: Box<dyn Sealer>,
    // Serializes read-modify-write cycles so concurrent commands cannot drop each other's writes.
    guard: Mutex<()>,
}

impl Vault {
    fn new(path: PathBuf, sealer: Box<dyn Sealer>) -> Self {
        Self { path, sealer, guard: Mutex::new(()) }
    }

    fn load(&self) -> Result<Secrets, String> {
        let sealed = match fs::read(&self.path) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Secrets::new()),
            Err(e) => return Err(format!("Failed to read vault: {e}")),
        };

        match self.sealer.open(&sealed) {
            Ok(plain) => serde_json::from_slice(&plain).map_err(|e| format!("Vault is corrupted: {e}")),
            Err(OpenError::Unavailable(msg)) => Err(format!("Secure storage unavailable: {msg}")),
            Err(OpenError::Unrecoverable(msg)) => {
                // Keep the old file for inspection instead of silently overwriting it.
                log::warn!("SSH vault cannot be decrypted, starting empty: {msg}");
                let _ = fs::rename(&self.path, self.path.with_extension("bin.unreadable"));
                Ok(Secrets::new())
            }
        }
    }

    fn store(&self, secrets: &Secrets) -> Result<(), String> {
        let plain = serde_json::to_vec(secrets).map_err(|e| e.to_string())?;
        let sealed = self.sealer.seal(&plain)?;

        // Write-then-rename so a crash never leaves a half-written vault.
        let tmp = self.path.with_extension("bin.tmp");
        fs::write(&tmp, sealed).map_err(|e| format!("Failed to write vault: {e}"))?;
        fs::rename(&tmp, &self.path).map_err(|e| format!("Failed to replace vault: {e}"))
    }

    fn get(&self, key: &str) -> Result<Option<String>, String> {
        let _lock = self.guard.lock().unwrap_or_else(|e| e.into_inner());
        Ok(self.load()?.remove(key))
    }

    fn set(&self, key: String, value: String) -> Result<(), String> {
        let _lock = self.guard.lock().unwrap_or_else(|e| e.into_inner());
        let mut secrets = self.load()?;
        secrets.insert(key, value);
        self.store(&secrets)
    }

    fn delete(&self, key: &str) -> Result<(), String> {
        let _lock = self.guard.lock().unwrap_or_else(|e| e.into_inner());
        let mut secrets = self.load()?;
        if secrets.remove(key).is_some() {
            self.store(&secrets)?;
        }
        Ok(())
    }
}

#[tauri::command]
pub async fn secret_get(vault: State<'_, Vault>, key: String) -> Result<Option<String>, String> {
    vault.get(&key)
}

#[tauri::command]
pub async fn secret_set(vault: State<'_, Vault>, key: String, value: String) -> Result<(), String> {
    vault.set(key, value)
}

#[tauri::command]
pub async fn secret_delete(vault: State<'_, Vault>, key: String) -> Result<(), String> {
    vault.delete(&key)
}

/// Registers the vault state; on Android this also loads the Kotlin Keystore plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("vault")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            let sealer: Box<dyn Sealer> = Box::new(android::KeystoreSealer(
                api.register_android_plugin("online.respulse.app", "VaultPlugin")?,
            ));
            #[cfg(not(target_os = "android"))]
            let sealer: Box<dyn Sealer> = {
                let _ = &api;
                Box::new(keyring_sealer::KeyringSealer)
            };

            let dir = app.path().app_data_dir()?;
            fs::create_dir_all(&dir)?;
            app.manage(Vault::new(dir.join(VAULT_FILE), sealer));
            Ok(())
        })
        .build()
}

#[cfg(not(target_os = "android"))]
mod keyring_sealer {
    use super::{OpenError, Sealer};
    use aes_gcm::aead::{Aead, Generate, Key, KeyInit};
    use aes_gcm::{Aes256Gcm, Nonce};

    const SERVICE: &str = "online.respulse.app";
    const ACCOUNT: &str = "ssh-vault-master-key";
    const NONCE_LEN: usize = 12;

    pub struct KeyringSealer;

    impl KeyringSealer {
        fn entry() -> Result<keyring::Entry, String> {
            keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
        }

        fn existing_key() -> Result<Option<Vec<u8>>, String> {
            match Self::entry()?.get_secret() {
                Ok(key) => Ok(Some(key)),
                Err(keyring::Error::NoEntry) => Ok(None),
                Err(e) => Err(e.to_string()),
            }
        }
    }

    impl Sealer for KeyringSealer {
        fn seal(&self, plaintext: &[u8]) -> Result<Vec<u8>, String> {
            let key_bytes = match Self::existing_key()? {
                Some(key) => key,
                None => {
                    let key = Key::<Aes256Gcm>::generate();
                    Self::entry()?.set_secret(key.as_slice()).map_err(|e| e.to_string())?;
                    key.to_vec()
                }
            };
            let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| e.to_string())?;
            let nonce = Nonce::generate();
            let mut sealed = nonce.to_vec();
            sealed.extend(cipher.encrypt(&nonce, plaintext).map_err(|e| e.to_string())?);
            Ok(sealed)
        }

        fn open(&self, sealed: &[u8]) -> Result<Vec<u8>, OpenError> {
            let key_bytes = Self::existing_key()
                .map_err(OpenError::Unavailable)?
                .ok_or_else(|| OpenError::Unrecoverable("master key missing from keyring".into()))?;
            if sealed.len() <= NONCE_LEN {
                return Err(OpenError::Unrecoverable("vault file truncated".into()));
            }
            let (nonce, ciphertext) = sealed.split_at(NONCE_LEN);
            let cipher = Aes256Gcm::new_from_slice(&key_bytes)
                .map_err(|e| OpenError::Unrecoverable(e.to_string()))?;
            let nonce = Nonce::try_from(nonce).map_err(|_| OpenError::Unrecoverable("bad nonce".into()))?;
            cipher
                .decrypt(&nonce, ciphertext)
                .map_err(|_| OpenError::Unrecoverable("authentication failed".into()))
        }
    }
}

#[cfg(target_os = "android")]
mod android {
    use super::{OpenError, Sealer};
    use base64::{Engine, engine::general_purpose::STANDARD};
    use serde::{Deserialize, Serialize};
    use tauri::Runtime;
    use tauri::plugin::PluginHandle;
    use tauri::plugin::mobile::PluginInvokeError;

    #[derive(Serialize)]
    struct Payload {
        data: String,
    }

    #[derive(Deserialize)]
    struct Reply {
        data: String,
    }

    pub struct KeystoreSealer<R: Runtime>(pub PluginHandle<R>);

    impl<R: Runtime> KeystoreSealer<R> {
        fn call(&self, command: &str, data: &[u8]) -> Result<Vec<u8>, PluginInvokeError> {
            let reply: Reply = self.0.run_mobile_plugin(command, Payload { data: STANDARD.encode(data) })?;
            STANDARD
                .decode(reply.data)
                .map_err(|e| PluginInvokeError::CannotDeserializeResponse(serde::de::Error::custom(e)))
        }
    }

    impl<R: Runtime> Sealer for KeystoreSealer<R> {
        fn seal(&self, plaintext: &[u8]) -> Result<Vec<u8>, String> {
            self.call("seal", plaintext).map_err(|e| e.to_string())
        }

        fn open(&self, sealed: &[u8]) -> Result<Vec<u8>, OpenError> {
            self.call("open", sealed).map_err(|e| match &e {
                PluginInvokeError::InvokeRejected(r) if r.code.as_deref() == Some("unrecoverable") => {
                    OpenError::Unrecoverable(e.to_string())
                }
                _ => OpenError::Unavailable(e.to_string()),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::Arc;

    /// Reversible stand-in for real encryption: the tests cover vault logic, not the cipher.
    struct FakeSealer {
        mode: Arc<AtomicUsize>,
        sealed_calls: Arc<AtomicBool>,
    }

    const OK: usize = 0;
    const UNAVAILABLE: usize = 1;
    const UNRECOVERABLE: usize = 2;

    impl Sealer for FakeSealer {
        fn seal(&self, plaintext: &[u8]) -> Result<Vec<u8>, String> {
            self.sealed_calls.store(true, Ordering::SeqCst);
            Ok(plaintext.iter().map(|b| b ^ 0x5a).collect())
        }

        fn open(&self, sealed: &[u8]) -> Result<Vec<u8>, OpenError> {
            match self.mode.load(Ordering::SeqCst) {
                UNAVAILABLE => Err(OpenError::Unavailable("locked".into())),
                UNRECOVERABLE => Err(OpenError::Unrecoverable("key lost".into())),
                _ => Ok(sealed.iter().map(|b| b ^ 0x5a).collect()),
            }
        }
    }

    fn temp_vault(name: &str) -> (Vault, Arc<AtomicUsize>, PathBuf) {
        let dir = std::env::temp_dir().join(format!("respulse-vault-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let mode = Arc::new(AtomicUsize::new(OK));
        let sealer = FakeSealer { mode: mode.clone(), sealed_calls: Arc::new(AtomicBool::new(false)) };
        let path = dir.join(VAULT_FILE);
        (Vault::new(path.clone(), Box::new(sealer)), mode, path)
    }

    #[test]
    fn roundtrips_and_deletes_secrets() {
        let (vault, _, path) = temp_vault("roundtrip");
        assert_eq!(vault.get("a").unwrap(), None);

        vault.set("a".into(), "secret-1".into()).unwrap();
        vault.set("b".into(), "secret-2".into()).unwrap();
        assert_eq!(vault.get("a").unwrap().as_deref(), Some("secret-1"));
        assert_eq!(vault.get("b").unwrap().as_deref(), Some("secret-2"));

        // The plaintext must not be readable from the file.
        let on_disk = fs::read(&path).unwrap();
        assert!(!String::from_utf8_lossy(&on_disk).contains("secret-1"));

        vault.delete("a").unwrap();
        assert_eq!(vault.get("a").unwrap(), None);
        assert_eq!(vault.get("b").unwrap().as_deref(), Some("secret-2"));
    }

    #[test]
    fn unavailable_keystore_fails_without_touching_the_file() {
        let (vault, mode, path) = temp_vault("unavailable");
        vault.set("a".into(), "keep-me".into()).unwrap();
        let before = fs::read(&path).unwrap();

        mode.store(UNAVAILABLE, Ordering::SeqCst);
        assert!(vault.get("a").is_err());
        assert!(vault.set("b".into(), "x".into()).is_err());
        assert_eq!(fs::read(&path).unwrap(), before);

        mode.store(OK, Ordering::SeqCst);
        assert_eq!(vault.get("a").unwrap().as_deref(), Some("keep-me"));
    }

    #[test]
    fn unrecoverable_vault_is_quarantined_and_reset() {
        let (vault, mode, path) = temp_vault("unrecoverable");
        vault.set("a".into(), "lost".into()).unwrap();

        mode.store(UNRECOVERABLE, Ordering::SeqCst);
        assert_eq!(vault.get("a").unwrap(), None);
        assert!(path.with_extension("bin.unreadable").exists());
        assert!(!path.exists());
    }
}
