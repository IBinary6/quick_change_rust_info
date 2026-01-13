import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AdminStatus, CargoConfig } from "./types";
import { MIRRORS } from "@/lib/mirrors";
import { store } from "@/lib/store";
import { cleanEmptyValues } from "@/lib/config";
import { ConfirmAction, ConfirmOptions, ConfirmTone } from "@/lib/confirm";

// Tabs
import { RegistryTab } from "@/components/tabs/RegistryTab";
import { BuildTab } from "@/components/tabs/BuildTab";
import { ToolsTab } from "@/components/tabs/ToolsTab";
import { LinkerTab } from "@/components/tabs/LinkerTab";
import { NetworkTab } from "@/components/tabs/NetworkTab";
import { EnvTab } from "@/components/tabs/EnvTab";
import { BackupTab } from "@/components/tabs/BackupTab";
import { AliasTab } from "@/components/tabs/AliasTab";
import { GlassOverlay } from "@/components/GlassOverlay";

type TabType = "registry" | "build" | "tools" | "linker" | "network" | "env" | "backup" | "alias";
type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  okLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
};

function App() {
  const [config, setConfig] = useState<CargoConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>((store.get("lastActiveTab", "registry") as TabType) || "registry");
  const [configPath, setConfigPath] = useState("");
  const [defaultConfigPath, setDefaultConfigPath] = useState("");
  const [currentTarget, setCurrentTarget] = useState("");
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  
  // Toast
  const [toast, setToast] = useState<{ show: boolean; title: string; message: string; type: "success" | "error" }>({
    show: false,
    title: "",
    message: "",
    type: "success"
  });

  // Registry state
  const [selectedMirror, setSelectedMirror] = useState("official");
  const [customCratesSource, setCustomCratesSource] = useState<{ replaceWith: string; registry?: string } | null>(null);
  
  // Build profile state
  const [profileType, setProfileType] = useState<"release" | "dev">("release");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    title: "",
    message: "",
    okLabel: "",
    cancelLabel: "",
    tone: "default"
  });
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const dirtyRef = useRef(false);
  const allowCloseRef = useRef(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const title = type === "success" ? "操作成功" : "操作失败";
    setToast({ show: true, title, message, type });
    setTimeout(() => setToast({ show: false, title: "", message: "", type: "success" }), 3200);
  };

  const stableStringify = (value: unknown) => {
    const seen = new WeakSet<object>();
    const normalize = (input: any): any => {
      if (input === null || typeof input !== "object") return input;
      if (seen.has(input)) return "[Circular]";
      seen.add(input);
      if (Array.isArray(input)) return input.map(normalize);
      const sorted: Record<string, any> = {};
      for (const key of Object.keys(input).sort()) {
        const next = input[key];
        if (next !== undefined) {
          sorted[key] = normalize(next);
        }
      }
      return sorted;
    };
    return JSON.stringify(normalize(value));
  };

  const currentSnapshot = useMemo(() => stableStringify(config), [config]);
  const isDirty = hasSnapshot && currentSnapshot !== savedSnapshot;

  const normalizePath = (value: string) => value.replace(/\\/g, "/");
  const isWindows = navigator.userAgent.toLowerCase().includes("windows");
  const normalizeComparePath = (value: string) => {
    const normalized = normalizePath(value).trim();
    return isWindows ? normalized.toLowerCase() : normalized;
  };
  const isSamePath = (left: string, right: string) =>
    normalizeComparePath(left) === normalizeComparePath(right);
  const getConfigFolderFromPath = (path: string) => {
    const normalized = normalizePath(path).trim();
    if (!normalized) return "";
    const lower = normalized.toLowerCase();
    if (lower.endsWith(".toml")) {
      const slash = normalized.lastIndexOf("/");
      return slash >= 0 ? normalized.slice(0, slash) : normalized;
    }
    return normalized.replace(/\/$/, "");
  };

  useEffect(() => {
    const init = async () => {
      await loadAdminStatus();
      const resolvedPath = await loadConfigPath();
      await loadConfig(resolvedPath);
      await loadCurrentTarget();
    };
    init();
  }, []);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  // 持久化 activeTab
  useEffect(() => {
    store.set("lastActiveTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    const replaceWith = config.source?.["crates-io"]?.["replace-with"];
    if (!replaceWith) {
      setSelectedMirror("official");
      setCustomCratesSource(null);
      return;
    }
    const mirror = MIRRORS.find(m => m.replaceWith === replaceWith);
    if (mirror) {
      setSelectedMirror(mirror.id);
      setCustomCratesSource(null);
    } else {
      setSelectedMirror("custom");
      setCustomCratesSource({
        replaceWith,
        registry: config.source?.[replaceWith]?.registry
      });
    }
  }, [config]);

  async function loadConfigPath() {
    try {
      const defaultPath = normalizePath(await invoke<string>("get_config_path"));
      setDefaultConfigPath(defaultPath);
      const storedPath = store.get("configPathOverride", "");
      const normalizedStored = storedPath ? normalizePath(storedPath) : "";
      const resolvedPath = normalizedStored && !isSamePath(normalizedStored, defaultPath)
        ? normalizedStored
        : defaultPath;
      if (normalizedStored && isSamePath(normalizedStored, defaultPath)) {
        store.set("configPathOverride", "");
      }
      setConfigPath(resolvedPath);
      return resolvedPath;
    } catch (e) {
      console.error(e);
      return "";
    }
  }

  const persistConfigPath = (path: string) => {
    if (path && defaultConfigPath && !isSamePath(path, defaultConfigPath)) {
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
    const normalized = normalizePath(defaultConfigPath);
    store.set("configPathOverride", "");
    setConfigPath(normalized);
    await loadConfig(normalized);
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

  async function loadAdminStatus() {
    setAdminLoading(true);
    try {
      const status = await invoke<AdminStatus>("get_admin_status");
      setAdminStatus(status);
    } catch (e) {
      console.error(e);
      setAdminStatus({
        is_admin: false,
        hint: "无法检测管理员权限，请以管理员权限启动。"
      });
    } finally {
      setAdminLoading(false);
    }
  }

  const adminBlocked = !!adminStatus && !adminStatus.is_admin;
  const adminHint = adminStatus?.hint || "";

  const confirmAction: ConfirmAction = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      if (confirmResolver.current) {
        confirmResolver.current(false);
      }
      confirmResolver.current = resolve;
      setConfirmState({
        open: true,
        title: options.title || "请确认",
        message: options.message,
        okLabel: options.okLabel || "确认",
        cancelLabel: options.cancelLabel || "取消",
        tone: options.tone || "default"
      });
    });
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    confirmResolver.current?.(result);
    confirmResolver.current = null;
    setConfirmState(prev => ({ ...prev, open: false }));
  }, []);

  const forceCloseWindow = useCallback(async () => {
    const window = getCurrentWindow();
    let destroyed = false;
    try {
      await window.destroy();
      destroyed = true;
    } catch (e) {
      console.error(e);
    }
    if (!destroyed) {
      try {
        await window.close();
      } catch (e) {
        console.error(e);
      }
    }
    try {
      await invoke("exit_app");
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setup = async () => {
      const window = getCurrentWindow();
      unlisten = await window.onCloseRequested(async (event) => {
        if (allowCloseRef.current) return;
        event.preventDefault();
        if (dirtyRef.current) {
          const confirmed = await confirmAction({
            title: "未保存的修改",
            message: "检测到未保存的修改。\n现在退出会丢失更改，是否仍然退出？",
            okLabel: "仍然退出",
            cancelLabel: "返回保存",
            tone: "danger"
          });
          if (!confirmed) return;
        }
        allowCloseRef.current = true;
        await forceCloseWindow();
      });
    };
    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, [confirmAction, forceCloseWindow]);

  async function loadConfig(pathOverride?: string) {
    setLoading(true);
    try {
      const resolvedPath = pathOverride || configPath || undefined;
      const c = await invoke<CargoConfig>("get_config", resolvedPath ? { path: resolvedPath } : undefined);
      setConfig(c);
      setSavedSnapshot(stableStringify(c));
      setHasSnapshot(true);
      showToast("配置已加载", "success");
    } catch (e) {
      showToast("加载失败: " + e, "error");
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = async (force = false) => {
    if (!force && isDirty) {
      const confirmed = await confirmAction({
        title: "放弃未保存修改？",
        message: "刷新会丢失当前未保存修改，是否继续？",
        okLabel: "放弃并刷新",
        cancelLabel: "返回保存",
        tone: "warning"
      });
      if (!confirmed) return;
    }
    await loadConfig();
  };

  async function saveConfig() {
    setSaving(true);
    try {
    const cleanConfig = buildConfigForExport();
    const resolvedPath = configPath || defaultConfigPath;
    if (resolvedPath) {
      const hasConfig = await invoke<boolean>("check_file_exists", { path: resolvedPath });
      if (hasConfig) {
        const shouldBackup = await confirmAction({
          title: "保存配置",
          message: "即将写入配置文件，建议先备份一份。\n是否先创建备份？",
          okLabel: "先备份",
          cancelLabel: "直接保存",
          tone: "warning"
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
    setSavedSnapshot(stableStringify(cleanConfig));
    setHasSnapshot(true);
    showToast("配置已保存", "success");
    } catch (e) {
      showToast("保存失败: " + e, "error");
    } finally {
      setSaving(false);
    }
  }

  const buildConfigForExport = () => {
    let newSource = { ...config.source };
    const managedMirrorKeys = MIRRORS.filter(m => m.id !== "official").map(m => m.replaceWith);
    const mirror = MIRRORS.find(m => m.id === selectedMirror);
    if (mirror && mirror.id !== "official") {
      newSource["crates-io"] = { "replace-with": mirror.replaceWith };
      newSource[mirror.replaceWith] = { registry: mirror.registry };
      for (const key of managedMirrorKeys) {
        if (key !== mirror.replaceWith) {
          delete newSource[key];
        }
      }
    } else if (selectedMirror === "custom") {
      // 保持用户自定义 source 不变
    } else {
      delete newSource["crates-io"];
      for (const key of managedMirrorKeys) {
        delete newSource[key];
      }
    }
    return cleanEmptyValues({ ...config, source: newSource }) || {};
  };

  async function openConfigFolder() {
    try {
      const resolvedPath = configPath || defaultConfigPath;
      const folder = getConfigFolderFromPath(resolvedPath);
      await invoke("open_folder", { path: folder || resolvedPath || undefined });
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
            <span>📦</span> 源与镜像
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
          display: "flex", flexDirection: "column", gap: 10,
          padding: "16px 24px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)"
        }}>
          <div className="header-row">
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 600 }}>
                {activeTab === "registry" && "源与镜像配置"}
                {activeTab === "build" && "编译优化"}
                {activeTab === "tools" && "常用工具 & 缓存"}
                {activeTab === "alias" && "命令别名"}
                {activeTab === "linker" && "链接器配置"}
                {activeTab === "env" && "环境变量配置"}
                {activeTab === "network" && "网络设置"}
                {activeTab === "backup" && "备份与恢复"}
              </h2>
              {adminStatus && (
                <div style={{ marginTop: 6, fontSize: 11, color: adminStatus.is_admin ? "var(--accent-green)" : "var(--error-color)" }}>
                  {adminStatus.is_admin ? "管理员模式" : "未授权（必须管理员运行）"}
                </div>
              )}
            </div>
            <div className={`header-actions ${isDirty ? "header-actions-alert" : ""}`}>
              {isDirty && <div className="dirty-badge">未保存</div>}
              <button className="btn btn-secondary" onClick={() => handleRefresh()} disabled={loading}>
                {loading ? "⏳" : "🔄"} 刷新
              </button>
              <button className={`btn btn-primary ${isDirty ? "save-attention" : ""}`} onClick={saveConfig} disabled={saving}>
                {saving ? "⏳" : "💾"} 保存配置
              </button>
            </div>
          </div>
          {isDirty && (
            <div className="save-strip">
              <div className="save-strip-main">检测到未保存修改，请先保存配置。</div>
              <div className="save-strip-sub">点击右侧“保存配置”即可生效</div>
            </div>
          )}
        </header>

        {/* 内容区 */}
        <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {adminStatus && !adminStatus.is_admin && (
            <div
              className="card"
              style={{
                marginBottom: 16,
                border: "1px solid rgba(239, 68, 68, 0.4)",
                background: "rgba(239, 68, 68, 0.06)"
              }}
            >
              <div className="card-header">
                <div className="card-title"><span style={{ color: "var(--error-color)" }}>⚠️</span> 需要管理员权限</div>
                <div className="card-desc">本应用必须以管理员权限启动</div>
              </div>
              <div className="card-content" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                <div style={{ marginBottom: 6 }}>
                  请以管理员权限启动，否则无法继续使用。
                </div>
                {adminHint && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span>手动方式：</span>
                    <span style={{ color: "var(--text-primary)" }}>{adminHint}</span>
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => void forceCloseWindow()}>
                      退出
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={loadAdminStatus} disabled={adminLoading}>
                      {adminLoading ? "检测中..." : "重新检测"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === "registry" && (
            <RegistryTab 
              config={config} 
              setConfig={setConfig} 
              selectedMirror={selectedMirror} 
              setSelectedMirror={setSelectedMirror}
              customCratesSource={customCratesSource}
              showToast={showToast}
              adminStatus={adminStatus}
              confirmAction={confirmAction}
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
              confirmAction={confirmAction}
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
              confirmAction={confirmAction}
            />
          )}
        </main>
      </div>
      
      <GlassOverlay active={adminBlocked} fullscreen>
        <div className="glass-panel stack">
          <div className="glass-title">需要管理员权限</div>
          <div className="glass-desc">
            本应用必须以管理员权限启动，拒绝将无法继续使用。
          </div>
          {adminHint && (
            <div className="glass-hint">手动方式：{adminHint}</div>
          )}
          <div className="glass-actions">
            <button className="btn btn-secondary" onClick={() => void forceCloseWindow()}>
              退出
            </button>
          </div>
        </div>
      </GlassOverlay>

      <GlassOverlay active={confirmState.open} fullscreen className="confirm-overlay">
        <div className="confirm-card">
          <div className={`confirm-icon ${confirmState.tone}`} />
          <div className="confirm-content">
            <div className="confirm-title">{confirmState.title}</div>
            <div className="confirm-message">{confirmState.message}</div>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button className={`btn ${confirmState.tone === "danger" ? "btn-danger" : "btn-primary"}`} onClick={() => closeConfirm(true)}>
                {confirmState.okLabel}
              </button>
            </div>
          </div>
        </div>
      </GlassOverlay>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes glassSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .toast {
          position: fixed;
          bottom: 18px;
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
          pointer-events: none;
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
        .glass-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 16, 22, 0.42);
          backdrop-filter: blur(14px) saturate(130%);
          border-radius: 14px;
          z-index: 20;
        }
        .glass-overlay.fullscreen {
          position: fixed;
          border-radius: 0;
          z-index: 2000;
        }
        .glass-overlay.loading {
          z-index: 2100;
        }
        .glass-overlay.confirm-overlay {
          background: radial-gradient(circle at 15% 10%, rgba(40, 80, 120, 0.35), rgba(8, 12, 16, 0.75));
          backdrop-filter: blur(18px) saturate(150%);
        }
        .confirm-card {
          display: flex;
          gap: 16px;
          width: min(520px, 90vw);
          padding: 18px 20px;
          border-radius: 16px;
          background: rgba(18, 24, 32, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
        }
        .confirm-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          background: rgba(56, 189, 248, 0.18);
          border: 1px solid rgba(56, 189, 248, 0.5);
          box-shadow: inset 0 0 16px rgba(56, 189, 248, 0.35);
        }
        .confirm-icon.warning {
          background: rgba(250, 204, 21, 0.15);
          border-color: rgba(250, 204, 21, 0.6);
          box-shadow: inset 0 0 16px rgba(250, 204, 21, 0.35);
        }
        .confirm-icon.danger {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.6);
          box-shadow: inset 0 0 16px rgba(239, 68, 68, 0.35);
        }
        .confirm-content {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
        }
        .confirm-title {
          font-size: 14px;
          font-weight: 600;
        }
        .confirm-message {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
          white-space: pre-line;
        }
        .confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 4px;
        }
        .btn-danger {
          background: var(--error-color);
          border-color: var(--error-color);
        }
        .btn-danger:hover {
          filter: brightness(1.05);
        }
        .dirty-badge {
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 999px;
          color: var(--error-color);
          border: 1px solid rgba(239, 68, 68, 0.45);
          background: rgba(239, 68, 68, 0.12);
        }
        .save-attention {
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.6), 0 16px 32px rgba(56, 189, 248, 0.28);
          animation: savePulse 1.4s ease-in-out infinite;
        }
        .save-attention::after {
          content: "";
          position: absolute;
          top: -40%;
          left: -60%;
          width: 60%;
          height: 180%;
          background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.7), transparent);
          opacity: 0.7;
          transform: translateX(-120%);
          animation: saveShimmer 1.6s linear infinite;
          pointer-events: none;
        }
        @keyframes savePulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.55), 0 16px 32px rgba(56, 189, 248, 0.25); }
          50% { box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.95), 0 20px 38px rgba(56, 189, 248, 0.4); }
        }
        @keyframes saveShimmer {
          to { transform: translateX(220%); }
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
          position: relative;
        }
        .header-actions-alert {
          padding: 6px 8px;
          border-radius: 12px;
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.45);
          overflow: hidden;
        }
        .header-actions-alert::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 14px;
          border: 1px solid rgba(56, 189, 248, 0.8);
          box-shadow: 0 0 18px rgba(56, 189, 248, 0.35);
          animation: headerPulse 1.6s ease-in-out infinite;
          pointer-events: none;
        }
        .header-actions-alert::after {
          content: "";
          position: absolute;
          top: -40%;
          left: -40%;
          width: 40%;
          height: 180%;
          background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.55), transparent);
          animation: headerSweep 1.6s linear infinite;
          pointer-events: none;
        }
        .save-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(56, 189, 248, 0.5);
          background: linear-gradient(120deg, rgba(56, 189, 248, 0.12), rgba(16, 24, 32, 0.7));
          position: relative;
          overflow: hidden;
        }
        .save-strip::after {
          content: "";
          position: absolute;
          top: 0;
          left: -30%;
          width: 40%;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.9), transparent);
          animation: stripScan 1.8s linear infinite;
          pointer-events: none;
        }
        .save-strip-main {
          font-size: 12px;
          font-weight: 600;
        }
        .save-strip-sub {
          font-size: 11px;
          color: var(--text-secondary);
        }
        @keyframes headerPulse {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        @keyframes headerSweep {
          to { transform: translateX(220%); }
        }
        @keyframes stripScan {
          to { transform: translateX(220%); }
        }
        .glass-panel {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          border-radius: 14px;
          background: rgba(20, 28, 36, 0.72);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
          color: var(--text-primary);
        }
        .glass-panel.stack {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          min-width: 320px;
          max-width: 420px;
        }
        .glass-title {
          font-size: 14px;
          font-weight: 600;
        }
        .glass-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .glass-hint {
          font-size: 11px;
          color: var(--text-secondary);
          word-break: break-all;
        }
        .glass-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .glass-spinner {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(255,255,255,0.15), var(--accent-cyan), rgba(255,255,255,0.15));
          position: relative;
          animation: glassSpin 1.1s linear infinite;
        }
        .glass-spinner::after {
          content: "";
          position: absolute;
          inset: 6px;
          border-radius: 50%;
          background: rgba(20, 28, 36, 0.85);
        }
        code { font-family: 'Consolas', 'Monaco', monospace; }
        textarea.input { padding: 10px 14px; line-height: 1.5; }
      `}</style>
    </div>
  );
}

export default App;
