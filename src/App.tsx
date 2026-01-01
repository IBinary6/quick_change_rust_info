import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CargoConfig } from "./types";
import { MIRRORS } from "@/lib/mirrors";
import { store } from "@/lib/store";

// Tabs
import { RegistryTab } from "@/components/tabs/RegistryTab";
import { BuildTab } from "@/components/tabs/BuildTab";
import { ToolchainTab } from "@/components/tabs/ToolchainTab";
import { LinkerTab } from "@/components/tabs/LinkerTab";
import { NetworkTab } from "@/components/tabs/NetworkTab";
import { EnvTab } from "@/components/tabs/EnvTab";

type TabType = "registry" | "build" | "toolchain" | "linker" | "network" | "env";

function App() {
  const [config, setConfig] = useState<CargoConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(store.get("lastActiveTab", "registry"));
  const [configPath, setConfigPath] = useState("");
  const [currentTarget, setCurrentTarget] = useState("");
  
  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  // Registry state
  const [selectedMirror, setSelectedMirror] = useState("official");
  
  // Build profile state
  const [profileType, setProfileType] = useState<"release" | "dev">("release");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  useEffect(() => {
    loadConfig();
    loadConfigPath();
    loadCurrentTarget();
  }, []);

  // 持久化 activeTab
  useEffect(() => {
    store.set("lastActiveTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (config.source?.["crates-io"]?.["replace-with"]) {
      const replaceWith = config.source["crates-io"]["replace-with"];
      const mirror = MIRRORS.find(m => m.replaceWith === replaceWith);
      if (mirror) setSelectedMirror(mirror.id);
    }
  }, [config]);

  async function loadConfigPath() {
    try {
      const path = await invoke<string>("get_config_path");
      setConfigPath(path);
    } catch (e) {
      console.error(e);
    }
  }

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

  async function loadConfig() {
    setLoading(true);
    try {
      const c = await invoke<CargoConfig>("get_config");
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
      let newSource = { ...config.source };
      const mirror = MIRRORS.find(m => m.id === selectedMirror);
      if (mirror && mirror.id !== "official") {
        newSource["crates-io"] = { "replace-with": mirror.replaceWith };
        newSource[mirror.replaceWith] = { registry: mirror.registry };
      } else {
        delete newSource["crates-io"];
      }
      
      const cleanConfig = cleanEmptyValues({ ...config, source: newSource });
      await invoke("save_config", { config: cleanConfig });
      setConfig(cleanConfig);
      showToast("✓ 配置保存成功", "success");
    } catch (e) {
      showToast("保存失败: " + e, "error");
    } finally {
      setSaving(false);
    }
  }

  function cleanEmptyValues(obj: any): any {
    if (obj === null || obj === undefined || obj === "") return undefined;
    if (Array.isArray(obj)) {
      const cleaned = obj.filter((v: any) => v !== null && v !== undefined && v !== "");
      return cleaned.length > 0 ? cleaned : undefined;
    }
    if (typeof obj === "object") {
      const cleaned: any = {};
      for (const key of Object.keys(obj)) {
        const value = cleanEmptyValues(obj[key]);
        if (value !== undefined) {
          cleaned[key] = value;
        }
      }
      return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
    return obj;
  }

  async function openConfigFolder() {
    try {
      await invoke("open_config_folder");
    } catch (e) {
      showToast("打开失败: " + e, "error");
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Toast */}
      {toast.show && (
        <div style={{
          position: "fixed",
          top: 20,
          right: 20,
          padding: "12px 20px",
          borderRadius: 8,
          background: toast.type === "success" ? "#10b981" : "#ef4444",
          color: "white",
          fontSize: 14,
          fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 1000,
          animation: "slideIn 0.3s ease"
        }}>
          {toast.message}
        </div>
      )}

      {/* 侧边栏 */}
      <div className="sidebar" style={{ position: "relative", paddingBottom: 100 }}>
        <div style={{ padding: "0 20px 20px", borderBottom: "1px solid var(--border-color)" }}>
          <h1 style={{ fontSize: "16px", fontWeight: 600, color: "var(--accent-cyan)" }}>
            Rust 配置工具
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: 4 }}>
            Cargo Config Manager
          </p>
        </div>
        
        <nav style={{ marginTop: 12 }}>
          <div className={`nav-item ${activeTab === "registry" ? "active" : ""}`} onClick={() => setActiveTab("registry")}>
            <span>📦</span> 下载源
          </div>
          <div className={`nav-item ${activeTab === "build" ? "active" : ""}`} onClick={() => setActiveTab("build")}>
            <span>⚡</span> 编译优化
          </div>
          <div className={`nav-item ${activeTab === "toolchain" ? "active" : ""}`} onClick={() => setActiveTab("toolchain")}>
            <span>🔧</span> 工具链
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
              {activeTab === "toolchain" && "工具链配置"}
              {activeTab === "linker" && "链接器配置"}
              {activeTab === "env" && "环境变量配置"}
              {activeTab === "network" && "网络设置"}
            </h2>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-secondary" onClick={loadConfig} disabled={loading}>
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

          {activeTab === "toolchain" && (
            <ToolchainTab 
              config={config} 
              setConfig={setConfig}
              showToast={showToast}
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
        </main>
      </div>
      
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        code { font-family: 'Consolas', 'Monaco', monospace; }
        textarea.input { padding: 10px 14px; line-height: 1.5; }
      `}</style>
    </div>
  );
}

export default App;
