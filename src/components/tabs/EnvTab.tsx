import { useState } from "react";
import { CargoConfig, EnvObject } from "@/types";

interface Props {
  config: CargoConfig;
  setConfig: (c: CargoConfig) => void;
}

export function EnvTab({ config, setConfig }: Props) {
  const env = config.env || {};
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  
  const addEnv = () => {
    if (!newKey.trim()) return;
    const newEnv = { ...env, [newKey.trim()]: newValue };
    setConfig({ ...config, env: newEnv });
    setNewKey("");
    setNewValue("");
  };

  const removeEnv = (key: string) => {
    const newEnv = { ...env };
    delete newEnv[key];
    setConfig({ ...config, env: Object.keys(newEnv).length > 0 ? newEnv : undefined });
  };
  
  const updateEnvValue = (key: string, value: string) => {
      // 检查当前值是字符串还是对象
      const current = env[key];
      if (typeof current === 'object') {
          const newEnv = { ...env, [key]: { ...current, value } };
          setConfig({ ...config, env: newEnv });
      } else {
          const newEnv = { ...env, [key]: value };
          setConfig({ ...config, env: newEnv });
      }
  };

  const toggleEnvOption = (key: string, option: 'force' | 'relative') => {
      const current = env[key];
      let newObj: EnvObject;
      
      if (typeof current === 'string') {
          newObj = { value: current, [option]: true };
      } else {
          newObj = { ...current, [option]: !current[option] };
          // 清理 false 值
          if (!newObj[option]) delete newObj[option];
      }
      
      const newEnv = { ...env, [key]: newObj };
      setConfig({ ...config, env: newEnv });
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>🔨</span> 环境变量配置</div>
      </div>
      <div className="card-content">
        {/* 现有环境列表 */}
        {Object.entries(env).length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {Object.entries(env).map(([key, value]) => {
              const strVal = typeof value === 'string' ? value : value.value;
              const isObj = typeof value === 'object';
              const force = isObj && value.force;
              const relative = isObj && value.relative;
              
              return (
                <div key={key} style={{ 
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: 12, border: "1px solid var(--border-color)", borderRadius: 8,
                    background: "var(--bg-secondary)"
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{key}</div>
                    <input 
                      className="input" 
                      style={{ width: "100%", height: 32 }}
                      value={strVal} 
                      onChange={(e) => updateEnvValue(key, e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!force} onChange={() => toggleEnvOption(key, 'force')} />
                            强制覆盖 (force)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input type="checkbox" checked={!!relative} onChange={() => toggleEnvOption(key, 'relative')} />
                            相对路径 (relative)
                        </label>
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ color: "#ef4444", marginTop: 4 }} onClick={() => removeEnv(key)}>删除</button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)", fontStyle: "italic" }}>
             暂无环境变量配置
          </div>
        )}
        
        {/* 添加新变量 */}
        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
           <div className="form-label" style={{ marginBottom: 8 }}>添加新变量</div>
           <div style={{ display: "flex", gap: 8 }}>
             <input className="input" placeholder="KEY" style={{ flex: 1 }} value={newKey} onChange={(e) => setNewKey(e.target.value)} />
             <input className="input" placeholder="VALUE" style={{ flex: 2 }} value={newValue} onChange={(e) => setNewValue(e.target.value)} />
             <button className="btn btn-primary" onClick={addEnv} disabled={!newKey}>添加</button>
           </div>
        </div>
      </div>
    </div>
  );
}
