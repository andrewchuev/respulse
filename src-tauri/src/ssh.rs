use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::io::Read;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum SshAuth {
    Password(String),
    PrivateKey {
        key: String,
        passphrase: Option<String>,
    },
    Agent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnectParams {
    pub host: String,
    pub port: Option<u16>,
    pub username: String,
    pub auth: SshAuth,
    pub timeout_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshExecParams {
    pub host: String,
    pub port: Option<u16>,
    pub username: String,
    pub auth: SshAuth,
    pub command: String,
    pub timeout_seconds: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshTestResult {
    pub success: bool,
    pub message: String,
    pub banner: Option<String>,
    pub latency_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SshExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

fn connect_and_auth(
    host: &str,
    port: u16,
    username: &str,
    auth: &SshAuth,
    timeout_seconds: Option<u64>,
) -> Result<(Session, u64), String> {
    let start = Instant::now();
    let timeout = Duration::from_secs(timeout_seconds.unwrap_or(10));
    let addr_str = format!("{}:{}", host, port);

    let addrs: Vec<_> = addr_str
        .to_socket_addrs()
        .map_err(|e| format!("Failed to resolve host '{}': {}", host, e))?
        .collect();

    let socket = if let Some(addr) = addrs.first() {
        TcpStream::connect_timeout(addr, timeout)
            .map_err(|e| format!("Failed to connect to {}:{}: {}", host, port, e))?
    } else {
        return Err(format!("No IP address found for host '{}'", host));
    };

    let mut sess = Session::new().map_err(|e| format!("Failed to create SSH session: {}", e))?;
    sess.set_timeout(timeout.as_millis().min(u32::MAX as u128) as u32);
    sess.set_tcp_stream(socket);
    sess.handshake()
        .map_err(|e| format!("SSH handshake failed with {}:{}: {}", host, port, e))?;

    match auth {
        SshAuth::Password(pass) => {
            sess.userauth_password(username, pass)
                .map_err(|e| format!("Authentication failed with password for user '{}': {}", username, e))?;
        }
        SshAuth::PrivateKey { key, passphrase } => {
            sess.userauth_pubkey_memory(username, None, key.as_str(), passphrase.as_deref())
                .map_err(|e| format!("Public key authentication failed for user '{}': {}", username, e))?;
        }
        SshAuth::Agent => {
            let mut agent = sess
                .agent()
                .map_err(|e| format!("Failed to access SSH agent: {}", e))?;
            agent
                .connect()
                .map_err(|e| format!("Failed to connect to local SSH agent: {}", e))?;
            agent
                .list_identities()
                .map_err(|e| format!("Failed to list identities from SSH agent: {}", e))?;

            let mut authenticated = false;
            for identity in agent
                .identities()
                .map_err(|e| format!("Failed to query agent identities: {}", e))?
            {
                if agent.userauth(username, &identity).is_ok() {
                    authenticated = true;
                    break;
                }
            }

            if !authenticated {
                return Err(format!("No matching SSH key found in agent for user '{}'", username));
            }
        }
    }

    if !sess.authenticated() {
        return Err(format!("Authentication rejected for user '{}@{}'", username, host));
    }

    let elapsed = start.elapsed().as_millis() as u64;
    Ok((sess, elapsed))
}

#[tauri::command]
pub async fn ssh_test_connection(params: SshConnectParams) -> Result<SshTestResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let port = params.port.unwrap_or(22);
        match connect_and_auth(&params.host, port, &params.username, &params.auth, params.timeout_seconds) {
            Ok((sess, latency_ms)) => {
                let banner = sess.banner().map(|b| b.to_string());
                Ok(SshTestResult {
                    success: true,
                    message: format!("Successfully authenticated as {}@{}:{}", params.username, params.host, port),
                    banner,
                    latency_ms,
                })
            }
            Err(e) => Err(e),
        }
    })
    .await
    .map_err(|e| format!("SSH task panicked: {}", e))?
}

#[tauri::command]
pub async fn ssh_execute_command(params: SshExecParams) -> Result<SshExecResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let port = params.port.unwrap_or(22);
        let start = Instant::now();
        let (sess, _) = connect_and_auth(&params.host, port, &params.username, &params.auth, params.timeout_seconds)?;

        let mut channel = sess
            .channel_session()
            .map_err(|e| format!("Failed to open SSH channel: {}", e))?;

        channel
            .exec(&params.command)
            .map_err(|e| format!("Failed to send command to remote shell: {}", e))?;

        let mut stdout = String::new();
        channel.read_to_string(&mut stdout).ok();

        let mut stderr = String::new();
        channel.stderr().read_to_string(&mut stderr).ok();

        channel.wait_close().ok();
        let exit_code = channel.exit_status().unwrap_or(0);
        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(SshExecResult {
            stdout,
            stderr,
            exit_code,
            duration_ms,
        })
    })
    .await
    .map_err(|e| format!("SSH task panicked: {}", e))?
}

#[tauri::command]
pub async fn open_external_ssh(uri: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        open::that(&uri).map_err(|e| format!("Failed to launch default SSH client: {}", e))
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}
