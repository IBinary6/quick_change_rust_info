import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CargoConfig, TARGET_PLATFORMS, WRAPPER_OPTIONS } from "@/types";

interface Props {
  config: CargoConfig;
  setConfig: (c: CargoConfig) => void;
  showToast: (msg: string, type: "success" | "error") => void;
}

export function ToolchainTab({ config, setConfig, showToast }: Props) {
  const [sccacheInstalled, setSccacheInstalled] = useState<boolean | null>(null);
  const [installedTargets, setInstalledTargets] = useState<string[]>([]);
  const [installingTarget, setInstallingTarget] = useState("");
  const [installingSccache, setInstallingSccache] = useState(false);

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

  return (
    <>
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
                  {installingTarget === config.build.target ? "⏳ 安装中..." : "📥 安装 Target"}
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
            <div><div className="form-label">编译器包装器 (rustc-wrapper)</div><div className="form-hint">推荐使用 sccache</div></div>
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
                   {installingSccache ? "⏳ 安装中..." : "📥 一键安装 sccache"}
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
