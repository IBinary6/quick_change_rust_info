import { CargoConfig, ProfileConfig } from "@/types";

interface Props {
  config: CargoConfig;
  setConfig: (c: CargoConfig) => void;
  profileType: "release" | "dev";
  setProfileType: (t: "release" | "dev") => void;
}

export function BuildTab({ config, setConfig, profileType, setProfileType }: Props) {
  const currentProfile = config.profile?.[profileType] || {};

  const updateProfile = (key: string, value: any) => {
    const newProfile: ProfileConfig = { ...currentProfile };
    if (value === "" || value === undefined || value === null) {
      delete newProfile[key];
    } else {
      newProfile[key] = value;
    }
    setConfig({ ...config, profile: { ...config.profile, [profileType]: newProfile } });
  };

  return (
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
          <input
            type="number"
            className="input"
            style={{ width: 180 }}
            placeholder="默认"
            min="1"
            max="256"
            value={currentProfile["codegen-units"] ?? ""}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : undefined;
              // 验证：必须大于0且小于等于256
              if (val !== undefined && (val <= 0 || val > 256)) {
                return;
              }
              updateProfile("codegen-units", val);
            }}
          />
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
  );
}
