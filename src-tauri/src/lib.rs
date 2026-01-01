mod config;

use config::CargoConfig;

#[tauri::command]
fn get_config() -> Result<CargoConfig, String> {
    config::load_config()
}

#[tauri::command]
fn save_config(config: CargoConfig) -> Result<(), String> {
    config::save_config(&config)
}

#[tauri::command]
fn get_config_path() -> String {
    config::get_cargo_config_path()
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
fn get_current_target() -> String {
    config::get_current_target()
}

#[tauri::command]
fn open_config_folder() -> Result<(), String> {
    let path = config::get_cargo_config_path();
    if let Some(parent) = path.parent() {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::process::Command::new("open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            get_config_path,
            get_current_target,
            open_config_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
