
import { useState } from "react";
import { CargoConfig } from "@/types";

interface Props {
  config: CargoConfig;
  setConfig: (c: CargoConfig) => void;
}

const COMMON_ALIASES = [
  { key: "b", value: "build", desc: "构建" },
  { key: "c", value: "check", desc: "检查" },
  { key: "t", value: "test", desc: "测试" },
  { key: "r", value: "run", desc: "运行" },
  { key: "rr", value: "run --release", desc: "运行发布版" },
  { key: "tree", value: "tree", desc: "依赖树 (需 cargo-tree)" },
];

export function AliasTab({ config, setConfig }: Props) {
  const aliases = config.alias || {};
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const addAlias = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    const newAliases = { ...aliases, [newKey.trim()]: newValue.trim() };
    setConfig({ ...config, alias: newAliases });
    setNewKey("");
    setNewValue("");
  };

  const removeAlias = (key: string) => {
    const newAliases = { ...aliases };
    delete newAliases[key];
    setConfig({ ...config, alias: Object.keys(newAliases).length > 0 ? newAliases : undefined });
  };

  const applyPreset = (key: string, value: string) => {
    const newAliases = { ...aliases, [key]: value };
    setConfig({ ...config, alias: newAliases });
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>⌨️</span> 别名配置 (Alias)</div>
        <div className="card-desc">配置 `cargo` 命令别名，例如 `cargo b` -&gt; `cargo build`</div>
      </div>
      <div className="card-content">
        
        {/* 现有别名列表 */}
        {Object.entries(aliases).length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {Object.entries(aliases).map(([key, value]) => (
              <div key={key} style={{ 
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: 6,
                  background: "var(--bg-secondary)"
              }}>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontWeight: 600, color: "var(--accent-cyan)", fontFamily: "monospace" }}>{key}</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>=</span>
                    <span style={{ fontSize: 12, fontFamily: "monospace", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>"{value}"</span>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ color: "var(--error-color)", padding: "2px 6px", height: 24, minHeight: 0 }} 
                  onClick={() => removeAlias(key)}
                  title="删除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "16px", color: "var(--text-secondary)", fontSize: 13, background: "rgba(0,0,0,0.05)", borderRadius: 6, marginBottom: 16 }}>
             暂无别名配置
          </div>
        )}

        {/* 添加新别名 */}
        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
           <div className="form-label" style={{ marginBottom: 8 }}>添加新别名</div>
           <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
             <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 6, paddingLeft: 8 }}>
               <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>cargo</span>
               <input 
                 className="input" 
                 placeholder="别名 (如 b)" 
                 style={{ border: "none", boxShadow: "none", padding: "8px 0", height: 32, flex: 1 }} 
                 value={newKey} 
                 onChange={(e) => setNewKey(e.target.value)} 
               />
             </div>
             <div style={{ display: "flex", alignItems: "center", padding: "0 4px" }}>=</div>
             <input 
               className="input" 
               placeholder="原命令 (如 build)" 
               style={{ flex: 2 }} 
               value={newValue} 
               onChange={(e) => setNewValue(e.target.value)} 
             />
             <button className="btn btn-primary" onClick={addAlias} disabled={!newKey || !newValue}>添加</button>
           </div>
           
           {/* 推荐别名 */}
           <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COMMON_ALIASES.map(preset => {
                 const exists = !!aliases[preset.key];
                 if (exists) return null;
                 return (
                   <button 
                     key={preset.key}
                     className="btn btn-secondary btn-sm"
                     style={{ fontSize: 11, padding: "2px 8px" }}
                     onClick={() => applyPreset(preset.key, preset.value)}
                     title={`添加 ${preset.value}`}
                   >
                     + {preset.key} ({preset.desc})
                   </button>
                 );
              })}
           </div>
        </div>
      </div>
    </div>
  );
}
