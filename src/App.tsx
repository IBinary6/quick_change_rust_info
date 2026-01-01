import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CargoConfig, TARGET_PLATFORMS, LINKER_OPTIONS, WRAPPER_OPTIONS, TargetConfig } from "./types";
import { MIRRORS } from "@/lib/mirrors";

// 预设代理列表
const PROXY_PRESETS = [
  { label: "无代理", value: "" },
  { label: "Clash (7890)", value: "127.0.0.1:7890" },
  { label: "Clash (7891)", value: "127.0.0.1:7891" },
  { label: "V2Ray (10808)", value: "127.0.0.1:10808" },
  { label: "V2Ray (1080)", value: "127.0.0.1:1080" },
  { label: "自定义...", value: "custom" },
];

type TabType = "registry" | "build" | "toolchain" | "linker" | "network";

function App() {
  const [config, setConfig] = useState<CargoConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("registry");
  const [configPath, setConfigPath] = useState("");
  const [currentTarget, setCurrentTarget] = useState("");
  
  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  // Registry
  const [selectedMirror, setSelectedMirror] = useState("official");
  
  // Build profile
  const [profileType, setProfileType] = useState<"release" | "dev">("release");
  
  // Proxy
  const [httpProxyMode, setHttpProxyMode] = useState<"preset" | "custom">("preset");
  const [httpsProxyMode, setHttpsProxyMode] = useState<"preset" | "custom">("preset");
  const [customHttpProxy, setCustomHttpProxy] = useState("");
  const [customHttpsProxy, setCustomHttpsProxy] = useState("");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  useEffect(() => {
    loadConfig();
    loadConfigPath();
    loadCurrentTarget();
  }, []);

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
      setCurrentTarget(target);
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
      
      // 清理空值
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

  // 递归清理空值
  function cleanEmptyValues(obj: any): any {
    if (obj === null || obj === undefined || obj === "") return undefined;
    if (Array.isArray(obj)) {
      const cleaned = obj.filter(v => v !== null && v !== undefined && v !== "");
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

  const currentProfile = config.profile?.[profileType] || {};

  const updateProfile = (key: string, value: any) => {
    const newProfile = { ...currentProfile };
    if (value === "" || value === undefined || value === null) {
      delete newProfile[key];
    } else {
      newProfile[key] = value;
    }
    setConfig({ ...config, profile: { ...config.profile, [profileType]: newProfile } });
  };

  const updateBuild = (key: string, value: any) => {
    const newBuild = { ...config.build };
    if (value === "" || value === undefined || value === null) {
      delete (newBuild as any)[key];
    } else {
      (newBuild as any)[key] = value;
    }
    setConfig({ ...config, build: newBuild });
  };

  const updateTarget = (targetName: string, key: string, value: any) => {
    const targets = { ...config.target };
    const targetConfig: TargetConfig = { ...targets[targetName] };
    if (value === "" || value === undefined || value === null) {
      delete (targetConfig as any)[key];
    } else {
      (targetConfig as any)[key] = value;
    }
    if (Object.keys(targetConfig).length === 0) {
      delete targets[targetName];
    } else {
      targets[targetName] = targetConfig;
    }
    setConfig({ ...config, target: Object.keys(targets).length > 0 ? targets : undefined });
  };

  const updateNet = (key: string, value: boolean) => {
    const newNet = { ...config.net };
    if (!value) {
      delete (newNet as any)[key];
    } else {
      (newNet as any)[key] = value;
    }
    setConfig({ ...config, net: Object.keys(newNet).length > 0 ? newNet : undefined });
  };

  const updateHttpProxy = (value: string) => {
    if (value === "custom") {
      setHttpProxyMode("custom");
    } else {
      setHttpProxyMode("preset");
      const newHttp = { ...config.http };
      if (value) {
        newHttp.proxy = value;
      } else {
        delete newHttp.proxy;
      }
      setConfig({ ...config, http: Object.keys(newHttp).length > 0 ? newHttp : undefined });
    }
  };

  const updateHttpsProxy = (value: string) => {
    if (value === "custom") {
      setHttpsProxyMode("custom");
    } else {
      setHttpsProxyMode("preset");
      const newHttps = { ...config.https };
      if (value) {
        newHttps.proxy = value;
      } else {
        delete newHttps.proxy;
      }
      setConfig({ ...config, https: Object.keys(newHttps).length > 0 ? newHttps : undefined });
    }
  };

  const applyCustomHttpProxy = () => {
    const newHttp = { ...config.http, proxy: customHttpProxy || undefined };
    setConfig({ ...config, http: newHttp });
    showToast("HTTP 代理已设置", "success");
  };

  const applyCustomHttpsProxy = () => {
    const newHttps = { ...config.https, proxy: customHttpsProxy || undefined };
    setConfig({ ...config, https: newHttps });
    showToast("HTTPS 代理已设置", "success");
  };

  // 获取当前目标的链接器配置
  const getTargetLinker = () => {
    return config.target?.[currentTarget]?.linker || "";
  };

  // 检查是否有静态CRT标志
  const hasStaticCrt = () => {
    const flags = config.target?.[currentTarget]?.rustflags || [];
    return flags.some(f => f.includes("crt-static"));
  };

  const toggleStaticCrt = (enable: boolean) => {
    const flags = config.target?.[currentTarget]?.rustflags || [];
    const filtered = flags.filter(f => !f.includes("crt-static"));
    if (enable) {
      filtered.push("-C target-feature=+crt-static");
    }
    updateTarget(currentTarget, "rustflags", filtered.length > 0 ? filtered : undefined);
  };

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
          
          {/* 下载源配置 */}
          {activeTab === "registry" && (
            <div className="card">
              <div className="card-header">
                <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>📦</span> 镜像源选择</div>
                <div className="card-desc">选择 Cargo 包下载镜像，国内推荐使用中科大或字节跳动源</div>
              </div>
              <div className="card-content">
                <select className="select" value={selectedMirror} onChange={(e) => setSelectedMirror(e.target.value)}>
                  {MIRRORS.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
                <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                  当前源: {MIRRORS.find(m => m.id === selectedMirror)?.registry || "默认"}
                </p>
              </div>
            </div>
          )}

          {/* 编译优化 */}
          {activeTab === "build" && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div className="card-title"><span style={{ color: "var(--accent-green)" }}>⚡</span> 编译优化选项</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className={`btn btn-sm ${profileType === "release" ? "btn-primary" : "btn-secondary"}`} onClick={() => setProfileType("release")}>Release</button>
                    <button className={`btn btn-sm ${profileType === "dev" ? "btn-primary" : "btn-secondary"}`} onClick={() => setProfileType("dev")}>Dev</button>
                  </div>
                </div>
                <div className="card-desc">配置 {profileType === "release" ? "发布" : "开发"} 模式的编译参数</div>
              </div>
              <div className="card-content">
                <div className="form-row">
                  <div><div className="form-label">优化等级 (opt-level)</div><div className="form-hint">数值越高优化越激进</div></div>
                  <select className="select" style={{ width: 180 }} value={String(currentProfile["opt-level"] ?? "")} onChange={(e) => updateProfile("opt-level", e.target.value || undefined)}>
                    <option value="">默认</option>
                    <option value="0">0 - 无优化</option>
                    <option value="1">1 - 基础</option>
                    <option value="2">2 - 常规</option>
                    <option value="3">3 - 最大</option>
                    <option value="s">s - 体积优先</option>
                    <option value="z">z - 最小体积</option>
                  </select>
                </div>
                <div className="form-row">
                  <div><div className="form-label">链接时优化 (LTO)</div><div className="form-hint">可显著减小二进制体积</div></div>
                  <select className="select" style={{ width: 180 }} value={String(currentProfile["lto"] ?? "")} onChange={(e) => updateProfile("lto", e.target.value || undefined)}>
                    <option value="">默认</option>
                    <option value="false">关闭</option>
                    <option value="true">开启</option>
                    <option value="thin">Thin</option>
                    <option value="fat">Fat</option>
                  </select>
                </div>
                <div className="form-row">
                  <div><div className="form-label">剥离符号 (Strip)</div><div className="form-hint">移除调试信息减小体积</div></div>
                  <select className="select" style={{ width: 180 }} value={String(currentProfile["strip"] ?? "")} onChange={(e) => updateProfile("strip", e.target.value || undefined)}>
                    <option value="">默认</option>
                    <option value="true">全部剥离</option>
                    <option value="false">不剥离</option>
                    <option value="debuginfo">仅调试信息</option>
                    <option value="symbols">仅符号</option>
                  </select>
                </div>
                <div className="form-row">
                  <div><div className="form-label">并发编译单元</div><div className="form-hint">设为1可最大化优化但编译慢</div></div>
                  <input type="number" className="input" style={{ width: 180 }} placeholder="默认"
                    value={currentProfile["codegen-units"] ?? ""}
                    onChange={(e) => updateProfile("codegen-units", e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
                <div className="form-row">
                  <div><div className="form-label">Panic 处理</div><div className="form-hint">panic=abort 可减小体积</div></div>
                  <select className="select" style={{ width: 180 }} value={String(currentProfile["panic"] ?? "")} onChange={(e) => updateProfile("panic", e.target.value || undefined)}>
                    <option value="">默认 (unwind)</option>
                    <option value="unwind">unwind</option>
                    <option value="abort">abort (更小体积)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 工具链配置 */}
          {activeTab === "toolchain" && (
            <>
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>🔧</span> 构建设置</div>
                  <div className="card-desc">配置默认编译目标和并行任务</div>
                </div>
                <div className="card-content">
                  <div className="form-row">
                    <div><div className="form-label">默认目标平台</div><div className="form-hint">cross-compile 时使用</div></div>
                    <select className="select" style={{ width: 240 }} value={config.build?.target || ""} onChange={(e) => updateBuild("target", e.target.value || undefined)}>
                      {TARGET_PLATFORMS.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
                    </select>
                  </div>
                  <div className="form-row">
                    <div><div className="form-label">并行任务数 (jobs)</div><div className="form-hint">留空使用 CPU 核心数</div></div>
                    <input type="number" className="input" style={{ width: 120 }} placeholder="自动"
                      value={config.build?.jobs ?? ""}
                      onChange={(e) => updateBuild("jobs", e.target.value ? parseInt(e.target.value) : undefined)} />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title"><span style={{ color: "var(--accent-green)" }}>⚡</span> 编译缓存</div>
                  <div className="card-desc">使用 sccache 加速重复编译</div>
                </div>
                <div className="card-content">
                  <div className="form-row">
                    <div><div className="form-label">编译器包装器 (rustc-wrapper)</div><div className="form-hint">推荐使用 sccache</div></div>
                    <select className="select" style={{ width: 200 }} value={config.build?.["rustc-wrapper"] || ""} onChange={(e) => updateBuild("rustc-wrapper", e.target.value || undefined)}>
                      {WRAPPER_OPTIONS.map(w => (<option key={w.value} value={w.value}>{w.label}</option>))}
                    </select>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 12 }}>
                    💡 使用前需先安装: <code style={{ background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>cargo install sccache</code>
                  </p>
                </div>
              </div>
            </>
          )}

          {/* 链接器配置 */}
          {activeTab === "linker" && (
            <>
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <div className="card-title"><span style={{ color: "var(--accent-blue)" }}>🔗</span> 链接器选择</div>
                  <div className="card-desc">当前目标: <code style={{ background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>{currentTarget}</code></div>
                </div>
                <div className="card-content">
                  <div className="form-row">
                    <div><div className="form-label">链接器</div><div className="form-hint">lld-link 比默认快 2-5 倍</div></div>
                    <select className="select" style={{ width: 240 }} value={getTargetLinker()} onChange={(e) => updateTarget(currentTarget, "linker", e.target.value || undefined)}>
                      {LINKER_OPTIONS.map(l => (<option key={l.value} value={l.value}>{l.label}</option>))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <div className="card-title"><span style={{ color: "var(--accent-green)" }}>⚙️</span> 链接选项</div>
                </div>
                <div className="card-content">
                  <div className="form-row">
                    <div><div className="form-label">静态链接 CRT</div><div className="form-hint">Windows: 不依赖 VC++ 运行时</div></div>
                    <div className={`switch ${hasStaticCrt() ? "active" : ""}`} onClick={() => toggleStaticCrt(!hasStaticCrt())} />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>📝</span> 自定义 Rustflags</div>
                  <div className="card-desc">高级编译器参数</div>
                </div>
                <div className="card-content">
                  <textarea 
                    className="input" 
                    style={{ width: "100%", height: 80, resize: "vertical", fontFamily: "monospace" }}
                    placeholder="每行一个参数，例如:&#10;-C link-arg=-s&#10;-C target-cpu=native"
                    value={(config.target?.[currentTarget]?.rustflags || []).join("\n")}
                    onChange={(e) => {
                      const flags = e.target.value.split("\n").filter(f => f.trim());
                      updateTarget(currentTarget, "rustflags", flags.length > 0 ? flags : undefined);
                    }}
                  />
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                    💡 常用参数: <code>-C link-arg=-s</code> (strip), <code>-C target-cpu=native</code> (优化当前CPU)
                  </p>
                </div>
              </div>
            </>
          )}

          {/* 网络设置 */}
          {activeTab === "network" && (
            <>
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <div className="card-title"><span style={{ color: "var(--accent-blue)" }}>🌐</span> 基础设置</div>
                </div>
                <div className="card-content">
                  <div className="form-row">
                    <div><div className="form-label">离线模式</div><div className="form-hint">禁止所有网络请求</div></div>
                    <div className={`switch ${config.net?.offline ? "active" : ""}`} onClick={() => updateNet("offline", !config.net?.offline)} />
                  </div>
                  <div className="form-row">
                    <div><div className="form-label">使用 Git CLI</div><div className="form-hint">git-fetch-with-cli</div></div>
                    <div className={`switch ${config.net?.["git-fetch-with-cli"] ? "active" : ""}`} onClick={() => updateNet("git-fetch-with-cli", !config.net?.["git-fetch-with-cli"])} />
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>🔗</span> HTTP 代理</div>
                </div>
                <div className="card-content">
                  <select className="select" value={httpProxyMode === "custom" ? "custom" : (config.http?.proxy || "")} onChange={(e) => updateHttpProxy(e.target.value)}>
                    {PROXY_PRESETS.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                  {httpProxyMode === "custom" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <input type="text" className="input" placeholder="如 192.168.1.1:8080" value={customHttpProxy} onChange={(e) => setCustomHttpProxy(e.target.value)} style={{ flex: 1 }} />
                      <button className="btn btn-primary btn-sm" onClick={applyCustomHttpProxy}>应用</button>
                    </div>
                  )}
                  {config.http?.proxy && <p style={{ marginTop: 8, fontSize: 12, color: "var(--accent-green)" }}>✓ 当前: {config.http.proxy}</p>}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title"><span style={{ color: "var(--accent-green)" }}>🔒</span> HTTPS 代理</div>
                </div>
                <div className="card-content">
                  <select className="select" value={httpsProxyMode === "custom" ? "custom" : (config.https?.proxy || "")} onChange={(e) => updateHttpsProxy(e.target.value)}>
                    {PROXY_PRESETS.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                  {httpsProxyMode === "custom" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <input type="text" className="input" placeholder="如 192.168.1.1:8080" value={customHttpsProxy} onChange={(e) => setCustomHttpsProxy(e.target.value)} style={{ flex: 1 }} />
                      <button className="btn btn-primary btn-sm" onClick={applyCustomHttpsProxy}>应用</button>
                    </div>
                  )}
                  {config.https?.proxy && <p style={{ marginTop: 8, fontSize: 12, color: "var(--accent-green)" }}>✓ 当前: {config.https.proxy}</p>}
                </div>
              </div>
            </>
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
