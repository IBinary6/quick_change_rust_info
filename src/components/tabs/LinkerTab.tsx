import { useState, useEffect } from "react";
// import { open } from "@tauri-apps/plugin-dialog"; // 注意：我们需要确认是否安装了 plugin-dialog，如果没有则暂时使用 input
import { invoke } from "@tauri-apps/api/core";
import { CargoConfig, TargetConfig, LINKER_OPTIONS, COMMON_RUSTFLAGS } from "@/types";

interface Props {
  config: CargoConfig;
  setConfig: (c: CargoConfig) => void;
  currentTarget: string;
}

export function LinkerTab({ config, setConfig, currentTarget }: Props) {
  const [linkerStatus, setLinkerStatus] = useState<boolean | null>(null);
  const [isManualCustom, setIsManualCustom] = useState(false);

  const getTargetLinker = () => {
    return config.target?.[currentTarget]?.linker || "";
  };

  // Check if current linker is custom (not in presets) and not empty
  const isCustomLinker = !LINKER_OPTIONS.some(l => l.value === getTargetLinker()) && getTargetLinker() !== "";
  
  // Sync manual state with prop changes
  useEffect(() => {
    if (isCustomLinker) {
      setIsManualCustom(true);
    }
  }, [isCustomLinker]);

  const showCustomInput = isCustomLinker || isManualCustom;

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

  const handleLinkerChange = (val: string) => {
    if (val === "custom") {
      setIsManualCustom(true);
      // Don't clear the value immediately, let user edit what might be there or start fresh if it was a preset
      // If it was a preset (e.g. lld), we might want to clear it? 
      // User Logic: "如果已经有自定义路径，保持现有值; 否则清空"
      if (!isCustomLinker) {
         updateTarget(currentTarget, "linker", "");
      }
      return;
    }
    // Preset selected
    setIsManualCustom(false);
    setLinkerStatus(null);
    updateTarget(currentTarget, "linker", val || undefined);
  };

  const checkCustomLinker = async () => {
    const pathToCheck = getTargetLinker();
    if (!pathToCheck) return;
    try {
      const exists = await invoke<boolean>("check_file_exists", { path: pathToCheck });
      setLinkerStatus(exists);
    } catch (e) {
      console.error(e);
      setLinkerStatus(false);
    }
  };

  const addRustflag = (flag: string) => {
    const currentFlags = config.target?.[currentTarget]?.rustflags || [];
    if (!currentFlags.includes(flag)) {
      updateTarget(currentTarget, "rustflags", [...currentFlags, flag]);
    }
  };

  const hasRustflag = (flag: string) => {
    const currentFlags = config.target?.[currentTarget]?.rustflags || [];
    return currentFlags.includes(flag);
  };
   
  const removeRustflag = (flag: string) => {
    const currentFlags = config.target?.[currentTarget]?.rustflags || [];
    const newFlags = currentFlags.filter(f => f !== flag);
    updateTarget(currentTarget, "rustflags", newFlags.length > 0 ? newFlags : undefined);
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-blue)" }}>🔗</span> 链接器选择</div>
          <div className="card-desc">当前目标: <code style={{ background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4 }}>{currentTarget}</code></div>
        </div>
        <div className="card-content">
          <div className="form-row">
            <div><div className="form-label">链接器</div><div className="form-hint">lld-link 比默认快 2-5 倍</div></div>
            <select 
              className="select" 
              style={{ width: 240 }} 
              value={showCustomInput ? "custom" : getTargetLinker()} 
              onChange={(e) => handleLinkerChange(e.target.value)}
            >
              {LINKER_OPTIONS.map(l => (<option key={l.value} value={l.value}>{l.label}</option>))}
              <option value="custom">自定义路径...</option>
            </select>
          </div>
          
          {showCustomInput && (
            <div style={{ marginTop: 12 }}>
               <div className="form-label" style={{marginBottom: 8}}>自定义链接器路径</div>
               <div style={{ display: "flex", gap: 8 }}>
                 <input
                   type="text"
                   className="input"
                   style={{ flex: 1 }}
                   value={getTargetLinker()}
                   onChange={(e) => {
                     const newPath = e.target.value;
                     setLinkerStatus(null);
                     updateTarget(currentTarget, "linker", newPath || undefined);
                   }}
                   placeholder="C:\Path\To\linker.exe 或 /usr/bin/mold"
                 />
                 <button
                   className="btn btn-secondary"
                   onClick={() => {
                     const pathToCheck = getTargetLinker();
                     if (!pathToCheck) return;
                     checkCustomLinker();
                   }}
                   disabled={!getTargetLinker()}
                 >
                   验证路径
                 </button>
               </div>
               {linkerStatus !== null && (
                 <p style={{ marginTop: 4, fontSize: 12, color: linkerStatus ? "var(--accent-green)" : "#ef4444" }}>
                   {linkerStatus ? "✅ 路径有效" : "❌ 路径无效或文件不存在"}
                 </p>
               )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>📝</span> Rustflags 参数</div>
          <div className="card-desc">高级编译器标志设置</div>
        </div>
        <div className="card-content">
          {/* 常用 Flags 列表 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
             {COMMON_RUSTFLAGS.map(flag => {
               const active = hasRustflag(flag.value);
               return (
                 <div 
                   key={flag.value}
                   style={{ 
                     display: "flex", alignItems: "center", justifyContent: "space-between",
                     padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 8,
                     background: "var(--bg-secondary)"
                   }}
                 >
                   <div>
                     <div style={{ fontWeight: 500, fontSize: 13 }}>{flag.label}</div>
                     <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                       <code style={{ background: "rgba(0,0,0,0.2)", padding: "2px 4px", borderRadius: 3 }}>{flag.value}</code> - {flag.desc}
                     </div>
                   </div>
                   <div 
                     className={`switch ${active ? "active" : ""}`} 
                     onClick={() => active ? removeRustflag(flag.value) : addRustflag(flag.value)} 
                     style={{ cursor: "pointer" }}
                   />
                 </div>
               );
             })}
          </div>

          <div className="form-label" style={{ marginBottom: 8 }}>自定义其他参数</div>
          <textarea 
            className="input" 
            style={{ width: "100%", height: 100, resize: "vertical", fontFamily: "monospace" }}
            placeholder="每行一个参数，例如:&#10;-C link-arg=-s&#10;-C target-cpu=native"
            value={(config.target?.[currentTarget]?.rustflags || []).filter(f => !COMMON_RUSTFLAGS.some(cf => cf.value === f)).join("\n")}
            onChange={(e) => {
              const customFlags = e.target.value.split("\n").filter(f => f.trim());
              const commonActiveFlags = COMMON_RUSTFLAGS.filter(cf => hasRustflag(cf.value)).map(cf => cf.value);
              const allFlags = [...commonActiveFlags, ...customFlags];
              updateTarget(currentTarget, "rustflags", allFlags.length > 0 ? allFlags : undefined);
            }}
          />
        </div>
      </div>
    </>
  );
}
