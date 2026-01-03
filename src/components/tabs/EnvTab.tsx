
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
          if (!newObj[option] && !newObj[option === 'force' ? 'relative' : 'force']) {
             // 如果选项都为 false，是否退回字符串？
             // 为了简化，保持为对象，只是字段为 undefined (cleanEmptyValues 会处理)
             delete newObj[option];
          }
      }
      
      const newEnv = { ...env, [key]: newObj };
      setConfig({ ...config, env: newEnv });
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>🔨</span> 环境变量配置 (Environment)</div>
      </div>
      <div className="card-content">
        
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px auto", gap: 10, marginBottom: 8, padding: "0 10px", fontSize: 12, color: "var(--text-secondary)" }}>
             <div>键 (Key)</div>
             <div>值 (Value)</div>
             <div>选项 (Options)</div>
             <div>操作</div>
        </div>

        {Object.entries(env).length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {Object.entries(env).map(([key, value]) => {
              const strVal = typeof value === 'string' ? value : value.value;
              const isObj = typeof value === 'object';
              const force = isObj && value.force;
              const relative = isObj && value.relative;
              
              return (
                <div key={key} style={{ 
                    display: "grid", gridTemplateColumns: "180px 1fr 160px auto", gap: 10, alignItems: "center",
                    padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: 6,
                    background: "var(--bg-secondary)"
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }} title={key}>{key}</div>
                  
                  <input 
                      className="input" 
                      style={{ width: "100%", height: 30, fontSize: 13 }}
                      value={strVal} 
                      onChange={(e) => updateEnvValue(key, e.target.value)}
                  />

                  <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", userSelect: "none" }} title="强制覆盖现有环境变量">
                          <input type="checkbox" checked={!!force} onChange={() => toggleEnvOption(key, 'force')} />
                          Force
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", userSelect: "none" }} title="相对于 config.toml 的路径">
                          <input type="checkbox" checked={!!relative} onChange={() => toggleEnvOption(key, 'relative')} />
                          Relative
                      </label>
                  </div>
                  
                  <button className="btn btn-secondary btn-sm" style={{ color: "var(--error-color)", padding: "2px 8px" }} onClick={() => removeEnv(key)}>删除</button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 12, textAlign: "center", color: "var(--text-secondary)", fontSize: 12, background: "rgba(0,0,0,0.05)", borderRadius: 6, marginBottom: 16 }}>
             暂无配置的环境变量
          </div>
        )}
        
        <div style={{ height: 1, background: "var(--border-color)", marginBottom: 16 }}></div>
        
        {/* 添加新变量 */}
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>添加新变量</div>
        <div style={{ 
           display: "grid", gridTemplateColumns: "180px 1fr 160px auto", gap: 10, alignItems: "center",
           padding: 10, background: "var(--bg-secondary)", borderRadius: 6, border: "1px solid var(--border-color)"
        }}>
           <input className="input" placeholder="KEY (e.g. RUST_LOG)" value={newKey} onChange={(e) => setNewKey(e.target.value)} style={{ width: "100%" }} />
           <input className="input" placeholder="VALUE (e.g. debug)" value={newValue} onChange={(e) => setNewValue(e.target.value)} style={{ width: "100%" }} />
           <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>默认选项</div>
           <button className="btn btn-primary btn-sm" onClick={addEnv} disabled={!newKey}>添加</button>
        </div>

        {/* Usage Hint */}
        <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bg-tertiary)", borderRadius: 6, fontSize: 12, border: "1px dashed var(--border-color)" }}>
           <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 环境变量 (Environment Variables)</div>
           <div style={{ color: "var(--text-secondary)", marginBottom: 6 }}>
             设置 Cargo 构建和运行过程中的环境变量。常用场景：
           </div>
           <ul style={{ paddingLeft: 16, margin: 0, color: "var(--text-secondary)", lineHeight: 1.5 }}>
             <li><code>RUST_LOG=debug</code>: 开启详细日志</li>
             <li><code>RUSTFLAGS=-C target-cpu=native</code>: 传递编译器标志 (如果不使用 build.rustflags)</li>
             <li><code>HTTP_PROXY=...</code>: 设置构建过程的代理</li>
           </ul>
           <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-tertiary)" }}>
             * <b>Force</b>: 强制覆盖系统中已存在的同名变量 <br/>
             * <b>Relative</b>: 标记值为路径，并将相对于 `.cargo/config.toml` 所在目录解析
           </div>
        </div>

      </div>
    </div>
  );
}
