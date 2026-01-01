mod config;

use config::CargoConfig;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn create_hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

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
            Command::new("explorer")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            Command::new("open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open folder: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
fn check_command_exists(cmd: String) -> bool {
    // Windows logic
    if cfg!(target_os = "windows") {
        create_hidden_command("where")
            .arg(&cmd)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    } else {
        // Unix logic
        Command::new("which")
            .arg(&cmd)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

#[tauri::command]
fn check_file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
async fn install_sccache(_window: tauri::Window) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut cmd = create_hidden_command("powershell");
    #[cfg(target_os = "windows")]
    cmd.args(["-Command", "cargo install sccache --locked"]);

    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new("cargo");
    #[cfg(not(target_os = "windows"))]
    cmd.args(["install", "sccache", "--locked"]);

    let output = cmd.output().map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn get_installed_targets() -> Result<Vec<String>, String> {
    let mut cmd = if cfg!(target_os = "windows") {
        create_hidden_command("rustup")
    } else {
        Command::new("rustup")
    };

    let output = cmd
        .args(["target", "list", "--installed"])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let targets = stdout.lines().map(|s| s.trim().to_string()).collect();
        Ok(targets)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
async fn install_target(target: String) -> Result<(), String> {
    let mut cmd = if cfg!(target_os = "windows") {
        create_hidden_command("rustup")
    } else {
        Command::new("rustup")
    };

    let output = cmd
        .args(["target", "add", &target])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
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
            open_config_folder,
            check_command_exists,
            check_file_exists,
            install_sccache,
            get_installed_targets,
            install_target
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
