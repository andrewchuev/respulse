mod ssh;
mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .plugin(tauri_plugin_biometric::init())
    .plugin(vault::init())
    .invoke_handler(tauri::generate_handler![
      ssh::ssh_test_connection,
      ssh::ssh_execute_command,
      ssh::open_external_ssh,
      vault::secret_get,
      vault::secret_set,
      vault::secret_delete,
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
