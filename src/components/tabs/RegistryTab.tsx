import { CargoConfig } from "@/types";
import { MIRRORS } from "@/lib/mirrors";

interface Props {
  config: CargoConfig;
  setConfig: (c: CargoConfig) => void;
  selectedMirror: string;
  setSelectedMirror: (m: string) => void;
}

export function RegistryTab({ selectedMirror, setSelectedMirror }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>📦</span> 镜像源选择</div>
      </div>
      <div className="card-content">
        <select className="select" value={selectedMirror} onChange={(e) => setSelectedMirror(e.target.value)}>
          {MIRRORS.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}
        </select>
        <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
          当前源: {MIRRORS.find(m => m.id === selectedMirror)?.registry || "默认"}
        </p>
      </div>
    </div>
  );
}
