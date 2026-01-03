
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

export function RegistryTab({ config, setConfig, selectedMirror, setSelectedMirror, showToast }: Props) {
  const registries = config.registries || {};
  const [newKey, setNewKey] = useState("");
  const [newIndex, setNewIndex] = useState("");
  const [newToken, setNewToken] = useState(""); // Optional

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

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>📦</span> 镜像源选择 (Replace-With)</div>
        </div>
        <div className="card-content">
          <select className="select" value={selectedMirror} onChange={(e) => setSelectedMirror(e.target.value)}>
            {MIRRORS.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
            当前源: {MIRRORS.find(m => m.id === selectedMirror)?.registry || "默认 (crates.io)"}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-blue)" }}>🔑</span> 私有注册表 (Registries)</div>
        </div>
        <div className="card-content">
          {/* List */}
          {Object.entries(registries).length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 16 }}>
              {Object.entries(registries).map(([key, entry]) => (
                <div key={key} style={{ 
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: 6,
                    background: "var(--bg-secondary)"
                }}>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                     <div style={{ fontWeight: 600, fontSize: 13 }}>{key}</div>
                     <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{entry.index}</div>
                     {entry.token && <div style={{ fontSize: 11, color: "var(--accent-green)" }}>🔑 Token 已设置</div>}
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ color: "var(--error-color)" }} onClick={() => removeRegistry(key)}>删除</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 12, textAlign: "center", color: "var(--text-secondary)", fontSize: 12, background: "rgba(0,0,0,0.05)", borderRadius: 6, marginBottom: 12 }}>
               无自定义注册表
            </div>
          )}

          {/* Add Form */}
           <div className="form-label" style={{ marginBottom: 8 }}>添加新注册表</div>
           <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
             <div style={{ display: "flex", gap: 8 }}>
               <input className="input" placeholder="名称 (如 my-reg)" style={{ flex: 1 }} value={newKey} onChange={(e) => setNewKey(e.target.value)} />
               <input className="input" placeholder="Index URL (如 https://...)" style={{ flex: 2 }} value={newIndex} onChange={(e) => setNewIndex(e.target.value)} />
             </div>
             <div style={{ display: "flex", gap: 8 }}>
               <input className="input" type="password" placeholder="Token (可选)" style={{ flex: 1 }} value={newToken} onChange={(e) => setNewToken(e.target.value)} />
               <button className="btn btn-primary" style={{ width: 80 }} onClick={addRegistry} disabled={!newKey || !newIndex}>添加</button>
             </div>
           </div>
        </div>
      </div>
    </>
  );
}
