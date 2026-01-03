
import { useState } from "react";
import { CargoConfig, RegistryEntry } from "@/types";
import { MIRRORS } from "@/lib/mirrors";

interface Props {
  config: CargoConfig;
  setConfig: (c: CargoConfig) => void;
  selectedMirror: string;
  setSelectedMirror: (m: string) => void;
  showToast?: (msg: string, type: "success" | "error") => void;
}

const RUSTUP_MIRRORS = [
  { id: "official", name: "Official (官方)", dist: "", root: "" },
  { id: "ustc", name: "USTC (中科大)", dist: "https://mirrors.ustc.edu.cn/rustup", root: "https://mirrors.ustc.edu.cn/rustup" },
  { id: "tuna", name: "TUNA (清华)", dist: "https://mirrors.tuna.tsinghua.edu.cn/rustup", root: "https://mirrors.tuna.tsinghua.edu.cn/rustup" },
  { id: "sjtu", name: "SJTU (上交)", dist: "https://mirrors.sjtug.sjtu.edu.cn/rust-static", root: "https://mirrors.sjtug.sjtu.edu.cn/rust-static/rustup" },
  { id: "rsproxy", name: "Rsproxy (字节)", dist: "https://rsproxy.cn/rustup", root: "https://rsproxy.cn/rustup" },
];

export function RegistryTab({ config, setConfig, selectedMirror, setSelectedMirror, showToast }: Props) {
  const registries = config.registries || {};
  const [newKey, setNewKey] = useState("");
  const [newIndex, setNewIndex] = useState("");
  const [newToken, setNewToken] = useState("");

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

  const getActiveRustupMirror = () => {
    const dist = config.env?.["RUSTUP_DIST_SERVER"];
    const val = typeof dist === "object" ? dist.value : dist;
    if (!val) return "official";
    const found = RUSTUP_MIRRORS.find(m => m.dist === val);
    return found ? found.id : "custom";
  };
  
  const activeRustup = getActiveRustupMirror();

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
                      onClick={() => setSelectedMirror(m.id)}
                    >
                      {m.name}
                      {isActive && <span style={{ position: "absolute", top: -4, right: -4, fontSize: 10 }}>✅</span>}
                    </button>
                  );
                })}
             </div>
          </div>

          <div style={{ height: 1, background: "var(--border-color)", marginBottom: 20 }}></div>

          {/* Section 2: Rustup Mirror */}
          <div>
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
                      onClick={() => {
                          const newEnv = { ...(config.env || {}) };
                          if (m.id === "official") {
                             delete newEnv["RUSTUP_DIST_SERVER"];
                             delete newEnv["RUSTUP_UPDATE_ROOT"];
                             if (showToast) showToast("已重置为官方源", "success");
                          } else {
                             newEnv["RUSTUP_DIST_SERVER"] = { value: m.dist, force: true };
                             newEnv["RUSTUP_UPDATE_ROOT"] = { value: m.root, force: true };
                             if (showToast) showToast(`已应用 ${m.name}`, "success");
                          }
                          setConfig({ ...config, env: newEnv });
                      }}
                    >
                      {m.name}
                      {isActive && <span style={{ position: "absolute", top: -4, right: -4, fontSize: 10 }}>✅</span>}
                    </button>
                  );
                })}
             </div>
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
