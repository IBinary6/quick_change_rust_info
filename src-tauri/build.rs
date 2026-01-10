fn main() {
    #[cfg(target_os = "windows")]
    {
        println!("cargo:rerun-if-changed=manifest.xml");
        let windows = tauri_build::WindowsAttributes::new()
            .app_manifest(include_str!("manifest.xml"));
        tauri_build::try_build(tauri_build::Attributes::new().windows_attributes(windows))
            .expect("failed to run tauri build");
    }

    #[cfg(not(target_os = "windows"))]
    {
        tauri_build::build()
    }
}
