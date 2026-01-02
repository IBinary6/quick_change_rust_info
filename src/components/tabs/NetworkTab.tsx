import { useEffect, useState } from "react";
import { CargoConfig, NetConfig, HttpConfig, HttpsConfig, PROXY_PRESETS } from "@/types";

interface Props {
  config: CargoConfig;
  setConfig: (c: CargoConfig) => void;
  showToast: (msg: string, type: "success" | "error") => void;
}

export function NetworkTab({ config, setConfig, showToast }: Props) {
  const [httpProxyMode, setHttpProxyMode] = useState<"preset" | "custom">("preset");
  const [httpsProxyMode, setHttpsProxyMode] = useState<"preset" | "custom">("preset");
  const [customHttpProxy, setCustomHttpProxy] = useState("");
  const [customHttpsProxy, setCustomHttpsProxy] = useState("");

  useEffect(() => {
    const httpProxy = config.http?.proxy || "";
    const httpIsPreset = PROXY_PRESETS.some(p => p.value === httpProxy);
    if (httpProxy && !httpIsPreset) {
      setHttpProxyMode("custom");
      setCustomHttpProxy(httpProxy);
    } else {
      setHttpProxyMode("preset");
      setCustomHttpProxy("");
    }
  }, [config.http?.proxy]);

  useEffect(() => {
    const httpsProxy = config.https?.proxy || "";
    const httpsIsPreset = PROXY_PRESETS.some(p => p.value === httpsProxy);
    if (httpsProxy && !httpsIsPreset) {
      setHttpsProxyMode("custom");
      setCustomHttpsProxy(httpsProxy);
    } else {
      setHttpsProxyMode("preset");
      setCustomHttpsProxy("");
    }
  }, [config.https?.proxy]);

  const updateNet = (key: string, value: boolean) => {
    const newNet: NetConfig = { ...config.net };
    if (!value) {
      delete (newNet as any)[key];
    } else {
      (newNet as any)[key] = value;
    }
    setConfig({ ...config, net: Object.keys(newNet).length > 0 ? newNet : undefined });
  };

  const updateHttpProxy = (value: string) => {
    if (value === "custom") {
      setHttpProxyMode("custom");
    } else {
      setHttpProxyMode("preset");
      const newHttp: HttpConfig = { ...config.http };
      if (value) {
        newHttp.proxy = value;
      } else {
        delete newHttp.proxy;
      }
      setConfig({ ...config, http: Object.keys(newHttp).length > 0 ? newHttp : undefined });
    }
  };

  const updateHttpsProxy = (value: string) => {
    if (value === "custom") {
      setHttpsProxyMode("custom");
    } else {
      setHttpsProxyMode("preset");
      const newHttps: HttpsConfig = { ...config.https };
      if (value) {
        newHttps.proxy = value;
      } else {
        delete newHttps.proxy;
      }
      setConfig({ ...config, https: Object.keys(newHttps).length > 0 ? newHttps : undefined });
    }
  };

  const validateProxyFormat = (proxy: string): boolean => {
    if (!proxy) return true; // 允许清空
    // 验证格式：host:port 或 http://host:port 或 https://host:port
    const pattern = /^(https?:\/\/)?([\w.-]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/;
    return pattern.test(proxy);
  };

  const applyCustomHttpProxy = () => {
    if (customHttpProxy && !validateProxyFormat(customHttpProxy)) {
      showToast("代理格式无效，应为 host:port 格式", "error");
      return;
    }
    const newHttp = { ...config.http, proxy: customHttpProxy || undefined };
    setConfig({ ...config, http: newHttp });
    showToast("HTTP 代理已设置", "success");
  };

  const applyCustomHttpsProxy = () => {
    if (customHttpsProxy && !validateProxyFormat(customHttpsProxy)) {
      showToast("代理格式无效，应为 host:port 格式", "error");
      return;
    }
    const newHttps = { ...config.https, proxy: customHttpsProxy || undefined };
    setConfig({ ...config, https: newHttps });
    showToast("HTTPS 代理已设置", "success");
  };

  return (
     <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-blue)" }}>🌐</span> 基础设置</div>
        </div>
        <div className="card-content">
          <div className="form-row">
            <div><div className="form-label">离线模式</div><div className="form-hint">禁止所有网络请求</div></div>
            <div className={`switch ${config.net?.offline ? "active" : ""}`} onClick={() => updateNet("offline", !config.net?.offline)} />
          </div>
          <div className="form-row">
            <div><div className="form-label">使用 Git CLI</div><div className="form-hint">git-fetch-with-cli</div></div>
            <div className={`switch ${config.net?.["git-fetch-with-cli"] ? "active" : ""}`} onClick={() => updateNet("git-fetch-with-cli", !config.net?.["git-fetch-with-cli"])} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>🔗</span> HTTP 代理</div>
        </div>
        <div className="card-content">
          <select className="select" value={httpProxyMode === "custom" ? "custom" : (config.http?.proxy || "")} onChange={(e) => updateHttpProxy(e.target.value)}>
            {PROXY_PRESETS.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
          </select>
          {httpProxyMode === "custom" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input type="text" className="input" placeholder="如 127.0.0.1:8080" value={customHttpProxy} onChange={(e) => setCustomHttpProxy(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={applyCustomHttpProxy}>应用</button>
            </div>
          )}
          {config.http?.proxy && <p style={{ marginTop: 8, fontSize: 12, color: "var(--accent-green)" }}>✓ 当前: {config.http.proxy}</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-green)" }}>🔒</span> HTTPS 代理</div>
        </div>
        <div className="card-content">
          <select className="select" value={httpsProxyMode === "custom" ? "custom" : (config.https?.proxy || "")} onChange={(e) => updateHttpsProxy(e.target.value)}>
            {PROXY_PRESETS.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
          </select>
          {httpsProxyMode === "custom" && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input type="text" className="input" placeholder="如 127.0.0.1:8080" value={customHttpsProxy} onChange={(e) => setCustomHttpsProxy(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={applyCustomHttpsProxy}>应用</button>
            </div>
          )}
          {config.https?.proxy && <p style={{ marginTop: 8, fontSize: 12, color: "var(--accent-green)" }}>✓ 当前: {config.https.proxy}</p>}
        </div>
      </div>
    </>
  );
}
