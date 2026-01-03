
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { CargoConfig, TARGET_PLATFORMS, WRAPPER_OPTIONS } from "@/types";

interface Props {
  config: CargoConfig;
  setConfig: (c: CargoConfig) => void;
  showToast: (msg: string, type: "success" | "error") => void;
}

interface CacheStats {
  registry_size: number;
  registry_path: string;
  git_size: number;
  git_path: string;
}

export function ToolsTab({ config, setConfig, showToast }: Props) {
  const [sccacheInstalled, setSccacheInstalled] = useState<boolean | null>(null);
  const [installedTargets, setInstalledTargets] = useState<string[]>([]);
  const [installingTarget, setInstallingTarget] = useState("");
  const [installingSccache, setInstallingSccache] = useState(false);
  
  // Cache Cleaning
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    checkTools();
  }, []);

  async function checkTools() {
    try {
      const hasSccache = await invoke<boolean>("check_command_exists", { cmd: "sccache" });
      setSccacheInstalled(hasSccache);
      
      const targets = await invoke<string[]>("get_installed_targets");
      setInstalledTargets(targets);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadCacheStats() {
    setLoadingCache(true);
    try {
      const stats = await invoke<CacheStats>("get_cargo_cache_stats");
      setCacheStats(stats);
    } catch (e) {
      showToast("获取缓存统计失败: " + e, "error");
    } finally {
      setLoadingCache(false);
    }
  }

  async function handleCleanup(target: "registry" | "git", size: number) {
    const sizeStr = formatSize(size);
    const confirmed = await confirm(`确定要清理 ${target} 缓存吗？\n这将释放 ${sizeStr} 空间。\n下次构建时需要重新下载依赖。`, {
      title: "清理缓存",
      kind: "warning"
    });
    if (!confirmed) return;

    setCleaning(true);
    try {
      await invoke("clean_cargo_cache", { target });
      showToast("清理完成", "success");
      await loadCacheStats(); // Refresh
    } catch (e) {
      showToast("清理失败: " + e, "error");
    } finally {
      setCleaning(false);
    }
  }

  async function handleInstallSccache() {
    setInstallingSccache(true);
    try {
      await invoke("install_sccache");
      setSccacheInstalled(true);
      showToast("sccache 安装成功", "success");
    } catch (e) {
      showToast("sccache 安装失败: " + e, "error");
    } finally {
      setInstallingSccache(false);
    }
  }

  async function handleInstallTarget(target: string) {
    if (!target) return;
    setInstallingTarget(target);
    try {
      await invoke("install_target", { target });
      await checkTools();
      showToast(`Target ${target} 安装成功`, "success");
    } catch (e) {
      showToast(`Target 安装失败: ${e}`, "error");
    } finally {
      setInstallingTarget("");
    }
  }
  


  const updateBuild = (key: string, value: any) => {
    const newBuild = { ...config.build };
    if (value === "" || value === undefined || value === null) {
      delete (newBuild as any)[key];
    } else {
      (newBuild as any)[key] = value;
    }
    setConfig({ ...config, build: newBuild });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <>
      {/* 缓存清理工具 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>🧹</span> 缓存清理工具</div>
        </div>
        <div className="card-content">
           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
             <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
               清理 `~/.cargo/registry` 和 `~/.cargo/git` 以释放磁盘空间
             </div>
             <button className="btn btn-primary btn-sm" onClick={loadCacheStats} disabled={loadingCache || cleaning}>
                {loadingCache ? "计算中..." : "📊 分析占用"}
             </button>
           </div>
           
           {cacheStats && (
             <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
               <div style={{ background: "var(--bg-secondary)", padding: 10, borderRadius: 6, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>📦 Registry 缓存</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", wordBreak: "break-all" }}>{cacheStats.registry_path}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                     <span style={{ fontSize: 14, color: "var(--accent-cyan)" }}>{formatSize(cacheStats.registry_size)}</span>
                     <div style={{ display: "flex", gap: 6 }}>
                       <button className="btn btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => invoke("open_folder", { path: cacheStats.registry_path })}>
                         📂 打开
                       </button>
                       <button className="btn btn-secondary btn-sm" style={{ color: "var(--error-color)", fontSize: 11, padding: "2px 8px" }} onClick={() => handleCleanup("registry", cacheStats.registry_size)} disabled={cleaning || cacheStats.registry_size === 0}>
                         清理
                       </button>
                     </div>
                  </div>
               </div>
               <div style={{ background: "var(--bg-secondary)", padding: 10, borderRadius: 6, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>🐙 Git 缓存</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", wordBreak: "break-all" }}>{cacheStats.git_path}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                     <span style={{ fontSize: 14, color: "var(--accent-blue)" }}>{formatSize(cacheStats.git_size)}</span>
                     <div style={{ display: "flex", gap: 6 }}>
                       <button className="btn btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => invoke("open_folder", { path: cacheStats.git_path })}>
                         📂 打开
                       </button>
                       <button className="btn btn-secondary btn-sm" style={{ color: "var(--error-color)", fontSize: 11, padding: "2px 8px" }} onClick={() => handleCleanup("git", cacheStats.git_size)} disabled={cleaning || cacheStats.git_size === 0}>
                         清理
                       </button>
                     </div>
                  </div>
               </div>
             </div>
           )}
        </div>
      </div>
      
      {/* Rustup Mirror Card Removed (Moved to RegistryTab) */}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>🔧</span> 交叉编译设置</div>
        </div>
        <div className="card-content">
          <div className="form-row">
            <div><div className="form-label">默认目标平台</div><div className="form-hint">cross-compile 时使用</div></div>
            <div style={{ display: "flex", gap: 8, flex: 1, justifyContent: "flex-end" }}>
              <select 
                className="select" 
                style={{ width: 240 }} 
                value={config.build?.target || ""} 
                onChange={(e) => updateBuild("target", e.target.value || undefined)}
              >
                {TARGET_PLATFORMS.map(t => {
                   const isInstalled = installedTargets.includes(t.value);
                   return (
                    <option key={t.value} value={t.value}>
                      {t.label} {t.value && !isInstalled ? "(未安装)" : ""}
                    </option>
                  );
                })}
              </select>
              {config.build?.target && !installedTargets.includes(config.build.target) && (
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => handleInstallTarget(config.build!.target!)}
                  disabled={!!installingTarget}
                >
                  {installingTarget === config.build.target ? "⏳..." : "📥 安装"}
                </button>
              )}
            </div>
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
          <div className="card-title"><span style={{ color: "var(--accent-green)" }}>⚡</span> 编译缓存 (sccache)</div>
        </div>
        <div className="card-content">
          <div className="form-row">
            <div><div className="form-label">Rustc Wrapper</div><div className="form-hint">推荐使用 sccache</div></div>
            <select className="select" style={{ width: 200 }} value={config.build?.["rustc-wrapper"] || ""} onChange={(e) => updateBuild("rustc-wrapper", e.target.value || undefined)}>
              {WRAPPER_OPTIONS.map(w => (<option key={w.value} value={w.value}>{w.label}</option>))}
            </select>
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span>状态:</span>
            {sccacheInstalled === null ? (
              <span className="text-secondary">检查中...</span>
            ) : sccacheInstalled ? (
              <span style={{ color: "var(--accent-green)" }}>✅ 已安装</span>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                 <span style={{ color: "var(--accent-cyan)" }}>⚠️ 未安装</span>
                 <button 
                  className="btn btn-primary btn-sm" 
                  onClick={handleInstallSccache}
                  disabled={installingSccache}
                 >
                   {installingSccache ? "⏳ 安装中..." : "📥 一键安装"}
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
