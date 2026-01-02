use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Clone)]
pub struct BackupEntry {
    pub name: String,
    pub path: String,
    pub modified: u64,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct CargoConfig {
    pub source: Option<HashMap<String, SourceEntry>>,
    pub registry: Option<RegistryConfig>,
    pub net: Option<NetConfig>,
    pub http: Option<HttpConfig>,
    pub https: Option<HttpsConfig>,
    pub build: Option<BuildConfig>,
    pub target: Option<HashMap<String, TargetConfig>>,
    pub env: Option<HashMap<String, EnvValue>>,
    pub profile: Option<HashMap<String, ProfileConfig>>,
    #[serde(flatten)]
    pub other: HashMap<String, toml::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum EnvValue {
    Simple(String),
    Object(EnvObject),
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct EnvObject {
    pub value: String,
    pub force: Option<bool>,
    pub relative: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct SourceEntry {
    pub registry: Option<String>,
    #[serde(rename = "replace-with")]
    pub replace_with: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct RegistryConfig {
    pub default: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct NetConfig {
    pub offline: Option<bool>,
    #[serde(rename = "git-fetch-with-cli")]
    pub git_fetch_with_cli: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct HttpConfig {
    pub proxy: Option<String>,
    #[serde(rename = "check-revoke")]
    pub check_revoke: Option<bool>,
    pub multiplexing: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct HttpsConfig {
    pub proxy: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct BuildConfig {
    pub jobs: Option<u32>,
    pub target: Option<String>,
    #[serde(rename = "rustc-wrapper")]
    pub rustc_wrapper: Option<String>,
    pub rustflags: Option<Vec<String>>,
    pub rustdocflags: Option<Vec<String>>,
    #[serde(flatten)]
    pub other: HashMap<String, toml::Value>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct TargetConfig {
    pub linker: Option<String>,
    pub ar: Option<String>,
    pub rustflags: Option<Vec<String>>,
    pub runner: Option<String>,
    #[serde(flatten)]
    pub other: HashMap<String, toml::Value>,
}

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct ProfileConfig {
    #[serde(rename = "opt-level")]
    pub opt_level: Option<toml::Value>,
    pub lto: Option<toml::Value>,
    #[serde(rename = "codegen-units")]
    pub codegen_units: Option<u32>,
    pub debug: Option<toml::Value>,
    pub strip: Option<toml::Value>,
    pub panic: Option<String>,
    #[serde(flatten)]
    pub other: HashMap<String, toml::Value>,
}

fn get_home_dir() -> String {
    if cfg!(windows) {
        std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string())
    } else {
        std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
    }
}

pub fn get_cargo_config_path() -> PathBuf {
    Path::new(&get_home_dir())
        .join(".cargo")
        .join("config.toml")
}

pub fn get_backup_dir(config_path: Option<&str>) -> PathBuf {
    let config_path = resolve_config_path(config_path);
    let base_dir = config_path.parent().unwrap_or_else(|| Path::new("."));
    base_dir.join("quickchange-backups")
}

fn expand_tilde(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed == "~" {
        return get_home_dir();
    }
    if let Some(rest) = trimmed
        .strip_prefix("~/")
        .or_else(|| trimmed.strip_prefix("~\\"))
    {
        return Path::new(&get_home_dir())
            .join(rest)
            .to_string_lossy()
            .to_string();
    }
    trimmed.to_string()
}

#[cfg(windows)]
fn expand_env_vars(input: &str) -> String {
    let mut result = String::new();
    let mut chars = input.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '%' {
            let mut name = String::new();
            let mut closed = false;
            while let Some(next) = chars.next() {
                if next == '%' {
                    closed = true;
                    break;
                }
                name.push(next);
            }
            if closed && !name.is_empty() {
                match std::env::var(&name) {
                    Ok(val) => result.push_str(&val),
                    Err(_) => {
                        result.push('%');
                        result.push_str(&name);
                        result.push('%');
                    }
                }
            } else {
                result.push('%');
                result.push_str(&name);
            }
        } else {
            result.push(ch);
        }
    }
    result
}

#[cfg(not(windows))]
fn expand_env_vars(input: &str) -> String {
    let mut result = String::new();
    let mut chars = input.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '$' {
            if let Some('{') = chars.peek().copied() {
                chars.next();
                let mut name = String::new();
                while let Some(next) = chars.next() {
                    if next == '}' {
                        break;
                    }
                    name.push(next);
                }
                if !name.is_empty() {
                    match std::env::var(&name) {
                        Ok(val) => result.push_str(&val),
                        Err(_) => {
                            result.push_str("${");
                            result.push_str(&name);
                            result.push('}');
                        }
                    }
                } else {
                    result.push('$');
                }
            } else {
                let mut name = String::new();
                while let Some(next) = chars.peek().copied() {
                    if next.is_ascii_alphanumeric() || next == '_' {
                        chars.next();
                        name.push(next);
                    } else {
                        break;
                    }
                }
                if !name.is_empty() {
                    match std::env::var(&name) {
                        Ok(val) => result.push_str(&val),
                        Err(_) => {
                            result.push('$');
                            result.push_str(&name);
                        }
                    }
                } else {
                    result.push('$');
                }
            }
        } else {
            result.push(ch);
        }
    }
    result
}

pub fn expand_path(input: &str) -> PathBuf {
    let tilde_expanded = expand_tilde(input);
    let env_expanded = expand_env_vars(&tilde_expanded);
    PathBuf::from(env_expanded)
}

pub fn resolve_config_path(path_override: Option<&str>) -> PathBuf {
    match path_override {
        Some(path) if !path.trim().is_empty() => expand_path(path),
        _ => get_cargo_config_path(),
    }
}

fn ensure_backup_dir(config_path: Option<&str>) -> Result<PathBuf, String> {
    let dir = get_backup_dir(config_path);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create backup dir: {}", e))?;
    }
    Ok(dir)
}

fn sanitize_backup_label(label: &str) -> String {
    let mut out = String::new();
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    for ch in label.chars() {
        if ch.is_control() {
            continue;
        }
        if invalid_chars.contains(&ch) {
            out.push('-');
            continue;
        }
        if ch.is_whitespace() {
            out.push('-');
            continue;
        }
        out.push(ch);
    }
    let cleaned = out.trim_matches('-').to_string();
    if cleaned.is_empty() {
        "custom".to_string()
    } else {
        cleaned
    }
}

fn build_backup_name(label: Option<&str>) -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let prefix = match label {
        Some(value) => format!("manual-{}", sanitize_backup_label(value)),
        None => "auto".to_string(),
    };
    format!("{}-{}.toml", prefix, stamp)
}

fn modified_secs(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let tmp_path = dir.join(format!(".config.tmp-{}", stamp));
    fs::write(&tmp_path, content).map_err(|e| format!("Failed to write temp file: {}", e))?;
    match fs::rename(&tmp_path, path) {
        Ok(_) => Ok(()),
        Err(err) => {
            if path.exists() {
                let _ = fs::remove_file(path);
            }
            fs::rename(&tmp_path, path)
                .map_err(|e| format!("Failed to replace config: {} (original: {})", e, err))
        }
    }
}

pub fn load_config(path_override: Option<&str>) -> Result<CargoConfig, String> {
    let path = resolve_config_path(path_override);
    if !path.exists() {
        return Ok(CargoConfig::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {}", e))?;
    toml::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))
}

pub fn save_config(config: &CargoConfig, path_override: Option<&str>) -> Result<(), String> {
    let path = resolve_config_path(path_override);
    let content =
        toml::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {}", e))?;

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    atomic_write(&path, &content)
}

pub fn serialize_config(config: &CargoConfig) -> Result<String, String> {
    toml::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {}", e))
}

pub fn list_backups(config_path: Option<&str>) -> Result<Vec<BackupEntry>, String> {
    let dir = get_backup_dir(config_path);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut items = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("Failed to read backup dir: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read backup entry: {}", e))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if path.extension().and_then(|ext| ext.to_str()) != Some("toml") {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read backup metadata: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        items.push(BackupEntry {
            name,
            path: path.to_string_lossy().to_string(),
            modified: modified_secs(&metadata),
            size: metadata.len(),
        });
    }

    items.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(items)
}

pub fn create_backup(
    config_path: Option<&str>,
    label: Option<String>,
) -> Result<BackupEntry, String> {
    let config_path = resolve_config_path(config_path);
    if !config_path.exists() {
        return Err("配置文件不存在，无法备份".to_string());
    }

    let dir = ensure_backup_dir(config_path.to_str())?;
    let name = build_backup_name(label.as_deref());
    let dest_path = dir.join(&name);
    fs::copy(&config_path, &dest_path).map_err(|e| format!("Failed to copy backup: {}", e))?;
    let metadata = fs::metadata(&dest_path).map_err(|e| format!("Failed to read backup: {}", e))?;

    Ok(BackupEntry {
        name,
        path: dest_path.to_string_lossy().to_string(),
        modified: modified_secs(&metadata),
        size: metadata.len(),
    })
}

pub fn restore_backup(config_path: Option<&str>, name: String) -> Result<(), String> {
    let backup_dir = get_backup_dir(config_path);
    let file_name = Path::new(&name)
        .file_name()
        .ok_or_else(|| "Invalid backup name".to_string())?;
    let backup_path = backup_dir.join(file_name);
    if !backup_path.exists() {
        return Err("备份文件不存在".to_string());
    }

    let content =
        fs::read_to_string(&backup_path).map_err(|e| format!("Failed to read backup: {}", e))?;
    toml::from_str::<CargoConfig>(&content).map_err(|e| format!("备份文件解析失败: {}", e))?;

    let config_path = resolve_config_path(config_path);
    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    atomic_write(&config_path, &content)
}

pub fn import_config_from_path(path: &str) -> Result<CargoConfig, String> {
    let resolved = expand_path(path);
    let content =
        fs::read_to_string(&resolved).map_err(|e| format!("Failed to read file: {}", e))?;
    toml::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))
}

pub fn export_config_to_path(config: &CargoConfig, path: &str) -> Result<(), String> {
    let resolved = expand_path(path);
    let content =
        toml::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {}", e))?;
    if let Some(parent) = resolved.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }
    atomic_write(&resolved, &content)
}

pub fn get_current_target() -> String {
    #[cfg(all(target_os = "windows", target_arch = "x86_64", target_env = "msvc"))]
    return "x86_64-pc-windows-msvc".to_string();

    #[cfg(all(target_os = "windows", target_arch = "x86_64", target_env = "gnu"))]
    return "x86_64-pc-windows-gnu".to_string();

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "x86_64-unknown-linux-gnu".to_string();

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "x86_64-apple-darwin".to_string();

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "aarch64-apple-darwin".to_string();

    #[cfg(not(any(
        all(target_os = "windows", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "macos", target_arch = "aarch64")
    )))]
    return "unknown".to_string();
}

pub fn clear_backups(config_path: Option<&str>) -> Result<usize, String> {
    let backup_dir = get_backup_dir(config_path);
    if !backup_dir.exists() {
        return Ok(0);
    }

    let mut count = 0;
    let entries =
        fs::read_dir(&backup_dir).map_err(|e| format!("Failed to read backup dir: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|ext| ext.to_str()) == Some("toml") {
            fs::remove_file(&path)
                .map_err(|e| format!("Failed to remove {}: {}", path.display(), e))?;
            count += 1;
        }
    }

    Ok(count)
}

pub fn delete_backup(config_path: Option<&str>, name: String) -> Result<(), String> {
    let backup_dir = get_backup_dir(config_path);
    let file_name = Path::new(&name)
        .file_name()
        .ok_or_else(|| "Invalid backup name".to_string())?;
    let backup_path = backup_dir.join(file_name);

    if !backup_path.exists() {
        return Err("备份文件不存在".to_string());
    }

    fs::remove_file(&backup_path).map_err(|e| format!("Failed to delete backup: {}", e))?;
    Ok(())
}

pub fn rename_backup(
    config_path: Option<&str>,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let backup_dir = get_backup_dir(config_path);

    let old_file_name = Path::new(&old_name)
        .file_name()
        .ok_or_else(|| "Invalid old backup name".to_string())?;
    let old_path = backup_dir.join(old_file_name);

    if !old_path.exists() {
        return Err("备份文件不存在".to_string());
    }

    // 确保新文件名以 .toml 结尾
    let new_name_with_ext = if new_name.ends_with(".toml") {
        new_name
    } else {
        format!("{}.toml", new_name)
    };

    let new_path = backup_dir.join(&new_name_with_ext);

    if new_path.exists() {
        return Err("目标文件名已存在".to_string());
    }

    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to rename backup: {}", e))?;
    Ok(())
}
