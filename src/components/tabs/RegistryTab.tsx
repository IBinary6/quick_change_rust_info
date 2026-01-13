
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AdminStatus, CargoConfig, RegistryEntry, RustupEnvStatus, RustupEnvWriteResult } from "@/types";
import { MIRRORS } from "@/lib/mirrors";
import { GlassOverlay } from "@/components/GlassOverlay";
import { ConfirmAction } from "@/lib/confirm";

interface Props {
  config: CargoConfig;
  setConfig: (c: CargoConfig) => void;
  selectedMirror: string;
  setSelectedMirror: (m: string) => void;
  customCratesSource: { replaceWith: string; registry?: string } | null;
  showToast?: (msg: string, type: "success" | "error") => void;
  adminStatus?: AdminStatus | null;
  confirmAction: ConfirmAction;
}

const RUSTUP_MIRRORS = [
  { id: "official", name: "Official (官方)", dist: "", root: "" },
  { id: "ustc", name: "USTC (中科大)", dist: "https://mirrors.ustc.edu.cn/rustup", root: "https://mirrors.ustc.edu.cn/rustup" },
  { id: "tuna", name: "TUNA (清华)", dist: "https://mirrors.tuna.tsinghua.edu.cn/rustup", root: "https://mirrors.tuna.tsinghua.edu.cn/rustup" },
  { id: "sjtu", name: "SJTU (上交)", dist: "https://mirrors.sjtug.sjtu.edu.cn/rust-static", root: "https://mirrors.sjtug.sjtu.edu.cn/rust-static/rustup" },
  { id: "rsproxy", name: "Rsproxy (字节)", dist: "https://rsproxy.cn/rustup", root: "https://rsproxy.cn/rustup" },
];

export function RegistryTab({
  config,
  setConfig,
  selectedMirror,
  setSelectedMirror,
  customCratesSource,
  showToast,
  adminStatus,
  confirmAction
}: Props) {
  const registries = config.registries || {};
  const [newKey, setNewKey] = useState("");
  const [newIndex, setNewIndex] = useState("");
  const [newToken, setNewToken] = useState("");
  const [rustupStatus, setRustupStatus] = useState<RustupEnvStatus | null>(null);
  const [rustupLoading, setRustupLoading] = useState(false);
  const [rustupWriting, setRustupWriting] = useState(false);
  const [rustupLastWrite, setRustupLastWrite] = useState<{ dist: string | null; root: string | null } | null>(null);
  const [rustupSystemError, setRustupSystemError] = useState<string | null>(null);
  const [showSystemErrorDetail, setShowSystemErrorDetail] = useState(false);

  const isAdmin = !!adminStatus?.is_admin;
  const adminHint = adminStatus?.hint || "";

  const sanitizeError = (value?: string | null) => {
    if (!value) return "";
    return value.replace(/\u0000/g, "").trim();
  };

  const addRegistry = () => {
    if (!newKey.trim() || !newIndex.trim()) return;
    const entry: RegistryEntry = { index: newIndex.trim() };
    if (newToken.trim()) entry.token = newToken.trim();
    
    const newRegistries = { ...registries, [newKey.trim()]: entry };
    setConfig({ ...config, registries: newRegistries });
    
    setNewKey("");
    setNewIndex("");
    setNewToken("");
    if (showToast) showToast("注册表已添加", "success");
  };

  const removeRegistry = (key: string) => {
    const newRegistries = { ...registries };
    delete newRegistries[key];
    setConfig({ ...config, registries: Object.keys(newRegistries).length > 0 ? newRegistries : undefined });
  };

  const applyCratesMirror = (mirrorId: string) => {
    setSelectedMirror(mirrorId);
    const newSource = { ...(config.source || {}) };
    if (mirrorId === "official") {
      delete newSource["crates-io"];
      for (const m of MIRRORS) {
        if (m.id !== "official") {
          delete newSource[m.replaceWith];
        }
      }
      setConfig({ ...config, source: Object.keys(newSource).length > 0 ? newSource : undefined });
      if (showToast) showToast("已重置为官方源", "success");
      return;
    }
    const mirror = MIRRORS.find(m => m.id === mirrorId);
    if (!mirror) return;
    newSource["crates-io"] = { "replace-with": mirror.replaceWith };
    newSource[mirror.replaceWith] = { registry: mirror.registry };
    for (const m of MIRRORS) {
      if (m.id !== "official" && m.replaceWith !== mirror.replaceWith) {
        delete newSource[m.replaceWith];
      }
    }
    setConfig({ ...config, source: newSource });
    if (showToast) showToast(`已切换到 ${mirror.name}`, "success");
  };

  const loadRustupStatus = async () => {
    setRustupLoading(true);
    try {
      const status = await invoke<RustupEnvStatus>("get_rustup_env_status");
      setRustupStatus(status);
    } catch (e) {
      if (showToast) showToast("读取 Rustup 镜像状态失败: " + e, "error");
    } finally {
      setRustupLoading(false);
    }
  };

  useEffect(() => {
    loadRustupStatus();
  }, []);

  const distUser = rustupStatus?.dist.user.value;
  const distSystem = rustupStatus?.dist.system.value;
  const rootUser = rustupStatus?.root.user.value;
  const rootSystem = rustupStatus?.root.system.value;
  const distEffective = distUser || distSystem || "";
  const rootEffective = rootUser || rootSystem || "";

  const distConflict = !!(distUser && distSystem && distUser !== distSystem);
  const rootConflict = !!(rootUser && rootSystem && rootUser !== rootSystem);
  const hasConflict = distConflict || rootConflict;
  const rustupBusy = rustupWriting || rustupLoading;

  const activeRustup = (() => {
    if (!distEffective && !rootEffective) return "official";
    const found = RUSTUP_MIRRORS.find(m => m.dist === distEffective && m.root === rootEffective);
    return found ? found.id : "custom";
  })();

  const applyRustupEnv = async (dist: string | null, root: string | null, successMessage: string) => {
    setRustupWriting(true);
    try {
      const result = await invoke<RustupEnvWriteResult>("set_rustup_env", { dist, root });
      const systemSkipped = !!result.system.skipped;
      setRustupLastWrite({ dist, root });
      if (!result.user.ok) {
        if (showToast) showToast(`用户级写入失败: ${result.user.error || "未知错误"}`, "error");
      }
      if (!systemSkipped && !result.system.ok) {
        const err = sanitizeError(result.system.error) || "系统级未生效";
        setRustupSystemError(err);
        setShowSystemErrorDetail(false);
        if (showToast) {
          const message = isAdmin
            ? "已写入用户级，系统级未生效，请检查权限或重试"
            : "已写入用户级，系统级需要管理员权限";
          showToast(message, "error");
        }
      } else {
        setRustupSystemError(null);
        if (result.user.ok && showToast) {
          const message = systemSkipped ? `${successMessage}（仅用户级）` : successMessage;
          showToast(message, "success");
        }
      }
      await loadRustupStatus();
    } catch (e) {
      if (showToast) showToast("写入 Rustup 配置失败: " + e, "error");
    } finally {
      setRustupWriting(false);
    }
  };

  const applyRustupMirror = async (mirrorId: string) => {
    const mirror = RUSTUP_MIRRORS.find(m => m.id === mirrorId);
    if (!mirror) return;
    const dist = mirrorId === "official" ? null : mirror.dist;
    const root = mirrorId === "official" ? null : mirror.root;
    const confirmMessage = isAdmin
      ? `即将修改 Rustup 镜像为 ${mirror.name}。\n将同时写入用户级与系统级环境变量。\n是否继续？`
      : `当前为普通权限，仅写入用户级环境变量。\n系统级修改需要管理员权限。\n是否继续？`;
    const confirmed = await confirmAction({
      title: "修改 Rustup 镜像",
      message: confirmMessage,
      okLabel: "确认修改",
      cancelLabel: "取消",
      tone: "warning"
    });
    if (!confirmed) return;

    await applyRustupEnv(dist, root, `已应用 ${mirror.name}`);
  };

  const resolveRustupConflict = async (direction: "systemToUser" | "userToSystem") => {
    const toUser = direction === "systemToUser";
    const dist = (toUser ? distSystem : distUser) || null;
    const root = (toUser ? rootSystem : rootUser) || null;
    if (!toUser && !isAdmin) {
      if (showToast) showToast("需要管理员权限才能写入系统级环境变量", "error");
      return;
    }
    const title = "统一 Rustup 配置";
    const desc = toUser
      ? "即将使用系统级配置覆盖用户级配置。"
      : "即将使用用户级配置覆盖系统级配置。";
    const confirmed = await confirmAction({
      title,
      message: `${desc}\n当前用户级: ${distUser || "-"} / ${rootUser || "-"}\n当前系统级: ${distSystem || "-"} / ${rootSystem || "-"}`,
      okLabel: "确认统一",
      cancelLabel: "取消",
      tone: "warning"
    });
    if (!confirmed) return;
    await applyRustupEnv(dist, root, "已统一 Rustup 配置");
  };

  const retryRustupSystem = async () => {
    if (!rustupLastWrite) return;
    if (!isAdmin) {
      if (showToast) showToast("需要管理员权限才能写入系统级环境变量", "error");
      return;
    }
    const confirmed = await confirmAction({
      title: "系统级重试",
      message: "将重试写入系统级环境变量（需要管理员权限）。是否继续？",
      okLabel: "继续",
      cancelLabel: "取消",
      tone: "warning"
    });
    if (!confirmed) return;
    setRustupWriting(true);
    try {
      const result = await invoke<RustupEnvWriteResult>("set_rustup_env", {
        dist: rustupLastWrite.dist,
        root: rustupLastWrite.root
      });
      if (!result.system.ok) {
        const err = sanitizeError(result.system.error) || "系统级未生效";
        setRustupSystemError(err);
        if (showToast) showToast("系统级仍未生效，请以管理员权限运行应用后重试", "error");
      } else {
        setRustupSystemError(null);
        if (showToast) showToast("系统级已写入", "success");
      }
      await loadRustupStatus();
    } catch (e) {
      if (showToast) showToast("系统级重试失败: " + e, "error");
    } finally {
      setRustupWriting(false);
    }
  };

  return (
    <>
      {/* 网络加速配置 (Unified Card) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>🚀</span> 网络加速 (Network Acceleration)</div>
        </div>
        <div className="card-content">
          
          {/* Section 1: Crates Mirror */}
          <div style={{ marginBottom: 20 }}>
             <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, width: 140 }}>📦 依赖下载源</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>替换 crates.io 默认源，加速依赖下载</span>
             </div>
             <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {MIRRORS.map(m => {
                  const isActive = selectedMirror === m.id;
                  return (
                    <button 
                      key={m.id}
                      className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
                      style={{ minWidth: 100, position: "relative" }}
                      onClick={() => applyCratesMirror(m.id)}
                    >
                      {m.name}
                      {isActive && <span style={{ position: "absolute", top: -4, right: -4, fontSize: 10 }}>✅</span>}
                    </button>
                  );
                })}
             </div>
             {selectedMirror === "custom" && customCratesSource && (
               <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, border: "1px dashed var(--border-color)", background: "var(--bg-tertiary)", fontSize: 12 }}>
                 <div style={{ fontWeight: 600, marginBottom: 4 }}>当前为自定义源</div>
                 <div style={{ color: "var(--text-secondary)" }}>
                   replace-with: <code>{customCratesSource.replaceWith}</code>
                 </div>
                 <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
                   registry: <code>{customCratesSource.registry || "-"}</code>
                 </div>
               </div>
             )}
          </div>

          <div style={{ height: 1, background: "var(--border-color)", marginBottom: 20 }}></div>

          {/* Section 2: Rustup Mirror */}
          <div style={{ position: "relative", overflow: "hidden", borderRadius: 10 }}>
             <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, width: 140 }}>🦀 工具链下载源</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>加速 rustup update 及 Toolchain 下载</span>
             </div>
             <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
               {RUSTUP_MIRRORS.map(m => {
                  const isActive = activeRustup === m.id;
                  return (
                    <button 
                      key={m.id}
                        className={`btn btn-sm ${isActive ? "btn-primary" : "btn-secondary"}`}
                        style={{ minWidth: 100, position: "relative" }}
                        onClick={() => applyRustupMirror(m.id)}
                        disabled={rustupWriting}
                      >
                      {m.name}
                      {isActive && <span style={{ position: "absolute", top: -4, right: -4, fontSize: 10 }}>✅</span>}
                    </button>
                  );
                })}
             </div>
             <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
               {activeRustup === "custom" && (distEffective || rootEffective) && (
                 <div style={{ marginBottom: 6 }}>
                   <span style={{ fontWeight: 600 }}>当前为自定义镜像</span>
                 </div>
               )}
               <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", rowGap: 4, columnGap: 8 }}>
                 <div>用户级</div>
                 <div>
                   {distUser || rootUser ? (
                     <>
                       <div>Dist: <code>{distUser || "-"}</code></div>
                       <div>Root: <code>{rootUser || "-"}</code></div>
                     </>
                   ) : (
                     <span>-</span>
                   )}
                 </div>
                 <div>系统级</div>
                 <div>
                   {distSystem || rootSystem ? (
                     <>
                       <div>Dist: <code>{distSystem || "-"}</code></div>
                       <div>Root: <code>{rootSystem || "-"}</code></div>
                     </>
                   ) : (
                     <span>-</span>
                   )}
                 </div>
               </div>
               {hasConflict && (
                 <div style={{ marginTop: 6 }}>
                   <div style={{ color: "var(--error-color)" }}>
                     用户级与系统级配置不一致
                   </div>
                   <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                     <button
                       className="btn btn-secondary btn-sm"
                       onClick={() => resolveRustupConflict("systemToUser")}
                       disabled={rustupWriting}
                     >
                       系统 → 用户
                     </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => resolveRustupConflict("userToSystem")}
                      disabled={!isAdmin || rustupWriting}
                    >
                      用户 → 系统
                    </button>
                  </div>
                </div>
              )}
               {rustupSystemError && (
                 <div
                   style={{
                     marginTop: 10,
                     padding: "10px 12px",
                     borderRadius: 8,
                     border: "1px solid var(--error-color)",
                     background: "rgba(239, 68, 68, 0.08)",
                     color: "var(--error-color)"
                   }}
                 >
                   <div style={{ fontWeight: 600, marginBottom: 4 }}>系统级写入未生效</div>
                   <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                     已保留用户级设置。
                     {isAdmin ? "请检查权限或重试系统级写入。" : "请以管理员权限启动后再试。"}
                   </div>
                   {!isAdmin && adminHint && (
                     <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                       管理员启动方式：<span style={{ color: "var(--text-primary)" }}>{adminHint}</span>
                     </div>
                   )}
                   <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowSystemErrorDetail(prev => !prev)}
                    >
                      {showSystemErrorDetail ? "隐藏详情" : "查看详情"}
                    </button>
                    {isAdmin && (
                      <button className="btn btn-secondary btn-sm" onClick={retryRustupSystem} disabled={rustupWriting}>
                        系统级重试
                       </button>
                     )}
                     <button className="btn btn-secondary btn-sm" onClick={loadRustupStatus} disabled={rustupLoading || rustupWriting}>
                       重新检测
                     </button>
                   </div>
                   {showSystemErrorDetail && (
                     <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                       错误详情：
                       <code style={{ marginLeft: 4, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                         {rustupSystemError}
                       </code>
                     </div>
                   )}
                 </div>
               )}
             <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
                <button className="btn btn-secondary btn-sm" onClick={loadRustupStatus} disabled={rustupLoading || rustupWriting}>
                  {rustupLoading ? "读取中..." : "刷新状态"}
                </button>
                {rustupWriting && (
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>应用中...</span>
                )}
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>修改后请重启终端以生效</span>
              </div>
            </div>
            <GlassOverlay active={rustupBusy}>
              <div className="glass-panel">
                <div className="glass-spinner" />
                <div>
                  <div className="glass-title">{rustupWriting ? "正在应用镜像" : "正在读取状态"}</div>
                  <div className="glass-desc">请稍候…</div>
                </div>
              </div>
            </GlassOverlay>
          </div>

        </div>
      </div>

      {/* 私有注册表 Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-blue)" }}>🔑</span> 私有注册表 (Private Registries)</div>
        </div>
        <div className="card-content">
          
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px auto", gap: 10, marginBottom: 8, padding: "0 10px", fontSize: 12, color: "var(--text-secondary)" }}>
             <div>名称 (Name)</div>
             <div>Index URL</div>
             <div>Token</div>
             <div>操作</div>
          </div>

          {Object.entries(registries).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {Object.entries(registries).map(([key, entry]) => (
                <div key={key} style={{ 
                    display: "grid", gridTemplateColumns: "120px 1fr 80px auto", gap: 10, alignItems: "center",
                    padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: 6,
                    background: "var(--bg-secondary)"
                }}>
                   <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }} title={key}>{key}</div>
                   <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={entry.index}>{entry.index}</div>
                   <div style={{ fontSize: 12 }}>{entry.token ? <span style={{ color: "var(--accent-green)" }}>● Set</span> : <span style={{ color: "var(--text-secondary)" }}>-</span>}</div>
                   <button className="btn btn-secondary btn-sm" style={{ color: "var(--error-color)", padding: "2px 8px" }} onClick={() => removeRegistry(key)}>删除</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 12, textAlign: "center", color: "var(--text-secondary)", fontSize: 12, background: "rgba(0,0,0,0.05)", borderRadius: 6, marginBottom: 16 }}>
               暂无私有注册表
            </div>
          )}

           <div style={{ height: 1, background: "var(--border-color)", marginBottom: 16 }}></div>

           <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>添加新注册表</div>
           <div style={{ 
              display: "grid", gridTemplateColumns: "120px 1fr 80px auto", gap: 10, alignItems: "center",
              padding: 10, background: "var(--bg-secondary)", borderRadius: 6, border: "1px solid var(--border-color)"
           }}>
             <input className="input" placeholder="Name" value={newKey} onChange={(e) => setNewKey(e.target.value)} style={{ width: "100%" }} />
             <input className="input" placeholder="Index URL" value={newIndex} onChange={(e) => setNewIndex(e.target.value)} style={{ width: "100%" }} />
             <input className="input" type="password" placeholder="Token" value={newToken} onChange={(e) => setNewToken(e.target.value)} style={{ width: "100%" }} />
             <button className="btn btn-primary btn-sm" onClick={addRegistry} disabled={!newKey || !newIndex}>添加</button>
           </div>
           
           {/* Usage Hint */}
           <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bg-tertiary)", borderRadius: 6, fontSize: 12, border: "1px dashed var(--border-color)" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 如何使用私有注册表？</div>
              <div style={{ color: "var(--text-secondary)", marginBottom: 6 }}>
                配置完成后，在项目的 <code>Cargo.toml</code> 中指定 <code>registry</code> 字段即可：
              </div>
              <div style={{ background: "var(--bg-primary)", padding: 8, borderRadius: 4, fontFamily: "monospace" }}>
                [dependencies]<br/>
                my-private-crate = &#123; version = "1.0", <span style={{ color: "var(--accent-blue)" }}>registry = "{newKey || "name"}"</span> &#125;
              </div>
           </div>
        </div>
      </div>
    </>
  );
}
