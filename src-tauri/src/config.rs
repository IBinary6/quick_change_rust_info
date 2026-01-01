use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

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

pub fn get_cargo_config_path() -> PathBuf {
    let home = if cfg!(windows) {
        std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string())
    } else {
        std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
    };
    Path::new(&home).join(".cargo").join("config.toml")
}

pub fn load_config() -> Result<CargoConfig, String> {
    let path = get_cargo_config_path();
    if !path.exists() {
        return Ok(CargoConfig::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {}", e))?;
    toml::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))
}

pub fn save_config(config: &CargoConfig) -> Result<(), String> {
    let path = get_cargo_config_path();
    let content =
        toml::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {}", e))?;

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    fs::write(&path, content).map_err(|e| format!("Failed to write config: {}", e))
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
