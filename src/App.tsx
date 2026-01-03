import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { CargoConfig } from "./types";
import { MIRRORS } from "@/lib/mirrors";
import { store } from "@/lib/store";
import { cleanEmptyValues } from "@/lib/config";

// Tabs
import { RegistryTab } from "@/components/tabs/RegistryTab";
import { BuildTab } from "@/components/tabs/BuildTab";
import { ToolsTab } from "@/components/tabs/ToolsTab";
import { LinkerTab } from "@/components/tabs/LinkerTab";
import { NetworkTab } from "@/components/tabs/NetworkTab";
import { EnvTab } from "@/components/tabs/EnvTab";
import { BackupTab } from "@/components/tabs/BackupTab";
import { AliasTab } from "@/components/tabs/AliasTab";

type TabType = "registry" | "build" | "tools" | "linker" | "network" | "env" | "backup" | "alias";

function App() {
  const [config, setConfig] = useState<CargoConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>((store.get("lastActiveTab", "registry") as TabType) || "registry");
  const [configPath, setConfigPath] = useState("");
  const [defaultConfigPath, setDefaultConfigPath] = useState("");
  const [currentTarget, setCurrentTarget] = useState("");
  
  // Toast
  const [toast, setToast] = useState<{ show: boolean; title: string; message: string; type: "success" | "error" }>({
    show: false,
    title: "",
    message: "",
    type: "success"
  });

  // Registry state
  const [selectedMirror, setSelectedMirror] = useState("official");
  
  // Build profile state
  const [profileType, setProfileType] = useState<"release" | "dev">("release");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const title = type === "success" ? "操作成功" : "操作失败";
    setToast({ show: true, title, message, type });
    setTimeout(() => setToast({ show: false, title: "", message: "", type: "success" }), 3200);
  };

  const normalizePath = (value: string) => value.replace(/\\/g, "/");

  useEffect(() => {
    const init = async () => {
      const resolvedPath = await loadConfigPath();
      await loadConfig(resolvedPath);
      await loadCurrentTarget();
    };
    init();
  }, []);

  // 持久化 activeTab
  useEffect(() => {
    store.set("lastActiveTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    const replaceWith = config.source?.["crates-io"]?.["replace-with"];
    if (!replaceWith) {
      setSelectedMirror("official");
      return;
    }
    const mirror = MIRRORS.find(m => m.replaceWith === replaceWith);
    setSelectedMirror(mirror ? mirror.id : "official");
  }, [config]);

  async function loadConfigPath() {
    try {
      const defaultPath = normalizePath(await invoke<string>("get_config_path"));
      setDefaultConfigPath(defaultPath);
      const storedPath = store.get("configPathOverride", "");
      const resolvedPath = storedPath ? normalizePath(storedPath) : defaultPath;
      setConfigPath(resolvedPath);
      return resolvedPath;
    } catch (e) {
      console.error(e);
      return "";
    }
  }

  const persistConfigPath = (path: string) => {
    if (path && defaultConfigPath && path !== defaultConfigPath) {
      store.set("configPathOverride", path);
    } else {
      store.set("configPathOverride", "");
    }
  };

  const updateConfigPath = async (path: string, shouldReload = true) => {
    const normalized = normalizePath(path);
    setConfigPath(normalized);
    persistConfigPath(normalized);
    if (shouldReload) {
      await loadConfig(normalized);
    }
  };

  const resetConfigPath = async () => {
    if (!defaultConfigPath) return;
    await updateConfigPath(defaultConfigPath);
  };

  async function loadCurrentTarget() {
    try {
      const target = await invoke<string>("get_current_target");
      if (target !== "unknown") {
          setCurrentTarget(target);
      } else {
          // 如果无法检测，默认 windows
          setCurrentTarget("x86_64-pc-windows-msvc"); 
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadConfig(pathOverride?: string) {
    setLoading(true);
    try {
      const resolvedPath = pathOverride || configPath || undefined;
      const c = await invoke<CargoConfig>("get_config", resolvedPath ? { path: resolvedPath } : undefined);
      setConfig(c);
      showToast("配置已加载", "success");
    } catch (e) {
      showToast("加载失败: " + e, "error");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
    const cleanConfig = buildConfigForExport();
    const resolvedPath = configPath || defaultConfigPath;
    if (resolvedPath) {
      const hasConfig = await invoke<boolean>("check_file_exists", { path: resolvedPath });
      if (hasConfig) {
        const shouldBackup = await confirm("即将写入配置文件，建议先备份一份。是否先创建备份？", {
          title: "保存配置",
          okLabel: "先备份",
          cancelLabel: "直接保存"
        });
        if (shouldBackup) {
          try {
            await invoke("create_backup", { path: resolvedPath });
          } catch (e) {
            showToast("备份失败，已取消保存: " + e, "error");
            return;
          }
        }
      }
    }
    await invoke("save_config", { config: cleanConfig, path: resolvedPath || undefined });
      setConfig(cleanConfig);
    showToast("配置已保存", "success");
    } catch (e) {
      showToast("保存失败: " + e, "error");
    } finally {
      setSaving(false);
    }
  }

  const buildConfigForExport = () => {
    let newSource = { ...config.source };
    const mirror = MIRRORS.find(m => m.id === selectedMirror);
    if (mirror && mirror.id !== "official") {
      newSource["crates-io"] = { "replace-with": mirror.replaceWith };
      newSource[mirror.replaceWith] = { registry: mirror.registry };
    } else {
      delete newSource["crates-io"];
    }
    return cleanEmptyValues({ ...config, source: newSource }) || {};
  };

  async function openConfigFolder() {
    try {
      const resolvedPath = configPath || defaultConfigPath;
      await invoke("open_config_folder", { path: resolvedPath || undefined });
    } catch (e) {
      showToast("打开失败: " + e, "error");
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Toast */}
      {toast.show && (
        <div className={`toast ${toast.type}`}>
          <div className="toast-icon">{toast.type === "success" ? "OK" : "ERR"}</div>
          <div>
            <div className="toast-title">{toast.title}</div>
            <div className="toast-message">{toast.message}</div>
          </div>
        </div>
      )}

      {/* 侧边栏 */}
      <div className="sidebar" style={{ position: "relative", paddingBottom: 100 }}>
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid var(--border-color)" }}>
          <h1 style={{ fontSize: "16px", fontWeight: 600, color: "var(--accent-cyan)" }}>
            Cargo Assistant
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: 4 }}>
            Rust 配置助手 v1.0.0
          </p>
        </div>
        
        <nav style={{ marginTop: 12 }}>
          <div className={`nav-item ${activeTab === "registry" ? "active" : ""}`} onClick={() => setActiveTab("registry")}>
            <span>📦</span> 下载源
          </div>
          <div className={`nav-item ${activeTab === "build" ? "active" : ""}`} onClick={() => setActiveTab("build")}>
            <span>⚡</span> 编译优化
          </div>
          <div className={`nav-item ${activeTab === "tools" ? "active" : ""}`} onClick={() => setActiveTab("tools")}>
            <span>🔧</span> 常用工具
          </div>
          <div className={`nav-item ${activeTab === "alias" ? "active" : ""}`} onClick={() => setActiveTab("alias")}>
            <span>⌨️</span> 别名配置
          </div>
          <div className={`nav-item ${activeTab === "linker" ? "active" : ""}`} onClick={() => setActiveTab("linker")}>
            <span>🔗</span> 链接器
          </div>
          <div className={`nav-item ${activeTab === "env" ? "active" : ""}`} onClick={() => setActiveTab("env")}>
            <span>🔨</span> 环境变量
          </div>
          <div className={`nav-item ${activeTab === "network" ? "active" : ""}`} onClick={() => setActiveTab("network")}>
            <span>🌐</span> 网络设置
          </div>
          <div className={`nav-item ${activeTab === "backup" ? "active" : ""}`} onClick={() => setActiveTab("backup")}>
            <span>🗂️</span> 备份恢复
          </div>
        </nav>

        <div style={{ 
          position: "absolute", 
          bottom: 0, 
          left: 0, 
          right: 0, 
          padding: "16px 20px",
          borderTop: "1px solid var(--border-color)",
          background: "var(--bg-secondary)"
        }}>
          <button className="btn btn-secondary" style={{ width: "100%", fontSize: 12 }} onClick={openConfigFolder}>
            📂 打开配置目录
          </button>
          <p style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 8, wordBreak: "break-all" }}>
            {configPath}
          </p>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* 顶部栏 */}
        <header style={{ 
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)"
        }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 600 }}>
              {activeTab === "registry" && "下载源配置"}
              {activeTab === "build" && "编译优化"}
              {activeTab === "tools" && "常用工具 & 缓存"}
              {activeTab === "alias" && "命令别名"}
              {activeTab === "linker" && "链接器配置"}
              {activeTab === "env" && "环境变量配置"}
              {activeTab === "network" && "网络设置"}
              {activeTab === "backup" && "备份与恢复"}
            </h2>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-secondary" onClick={() => loadConfig()} disabled={loading}>
              {loading ? "⏳" : "🔄"} 刷新
            </button>
            <button className="btn btn-primary" onClick={saveConfig} disabled={saving}>
              {saving ? "⏳" : "💾"} 保存配置
            </button>
          </div>
        </header>

        {/* 内容区 */}
        <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {activeTab === "registry" && (
            <RegistryTab 
              config={config} 
              setConfig={setConfig} 
              selectedMirror={selectedMirror} 
              setSelectedMirror={setSelectedMirror}
              showToast={showToast}
            />
          )}

          {activeTab === "build" && (
            <BuildTab 
              config={config} 
              setConfig={setConfig} 
              profileType={profileType} 
              setProfileType={setProfileType} 
            />
          )}

          {activeTab === "tools" && (
            <ToolsTab 
              config={config} 
              setConfig={setConfig}
              showToast={showToast}
            />
          )}

          {activeTab === "alias" && (
             <AliasTab 
               config={config} 
               setConfig={setConfig}
             />
           )}

          {activeTab === "linker" && (
            <LinkerTab 
              config={config} 
              setConfig={setConfig}
              currentTarget={currentTarget}
            />
          )}

          {activeTab === "env" && (
            <EnvTab 
              config={config} 
              setConfig={setConfig} 
            />
          )}

          {activeTab === "network" && (
            <NetworkTab 
              config={config} 
              setConfig={setConfig}
              showToast={showToast}
            />
          )}

          {activeTab === "backup" && (
            <BackupTab
              setConfig={setConfig}
              showToast={showToast}
              reloadConfig={loadConfig}
              buildExportConfig={buildConfigForExport}
              configPath={configPath}
              defaultConfigPath={defaultConfigPath}
              updateConfigPath={updateConfigPath}
              resetConfigPath={resetConfigPath}
            />
          )}
        </main>
      </div>
      
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .toast {
          position: fixed;
          top: 18px;
          right: 20px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          box-shadow: 0 6px 18px rgba(0,0,0,0.2);
          z-index: 1000;
          min-width: 220px;
          max-width: 320px;
          animation: slideIn 0.25s ease;
        }
        .toast.success {
          border-left: 4px solid var(--accent-green);
        }
        .toast.error {
          border-left: 4px solid #ef4444;
        }
        .toast-icon {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 6px;
          border-radius: 6px;
          background: rgba(0,0,0,0.25);
          color: #fff;
          line-height: 1;
        }
        .toast-title {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .toast-message {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        code { font-family: 'Consolas', 'Monaco', monospace; }
        textarea.input { padding: 10px 14px; line-height: 1.5; }
      `}</style>
    </div>
  );
}

export default App;
