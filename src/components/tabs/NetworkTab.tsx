
import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
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

  const updateHttp = (key: string, value: any) => {
    const newHttp: HttpConfig = { ...config.http };
    if (value === undefined || value === "") {
        delete (newHttp as any)[key];
    } else {
        (newHttp as any)[key] = value;
    }
    setConfig({ ...config, http: Object.keys(newHttp).length > 0 ? newHttp : undefined });
  };

  const updateHttpProxy = (value: string) => {
    if (value === "custom") {
      setHttpProxyMode("custom");
    } else {
      setHttpProxyMode("preset");
      updateHttp("proxy", value || undefined);
    }
  };
  
  const applyCustomHttpProxy = () => {
    if (customHttpProxy && !validateProxyFormat(customHttpProxy)) {
      showToast("代理格式无效，应为 host:port", "error");
      return;
    }
    updateHttp("proxy", customHttpProxy || undefined);
    showToast("HTTP 代理已设置", "success");
  };

  const updateHttpsProxy = (value: string) => {
    if (value === "custom") {
      setHttpsProxyMode("custom");
    } else {
      setHttpsProxyMode("preset");
      const newHttps: HttpsConfig = { ...config.https };
      if (value) newHttps.proxy = value;
      else delete newHttps.proxy;
      setConfig({ ...config, https: Object.keys(newHttps).length > 0 ? newHttps : undefined });
    }
  };

  const applyCustomHttpsProxy = () => {
    if (customHttpsProxy && !validateProxyFormat(customHttpsProxy)) {
      showToast("代理格式无效，应为 host:port", "error");
      return;
    }
    const newHttps = { ...config.https, proxy: customHttpsProxy || undefined };
    setConfig({ ...config, https: newHttps });
    showToast("HTTPS 代理已设置", "success");
  };

  const validateProxyFormat = (proxy: string): boolean => {
    if (!proxy) return true;
    const pattern = /^(https?:\/\/)?([\w.-]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d{1,5})?$/;
    return pattern.test(proxy);
  };

  const selectCaFile = async () => {
      try {
          const selected = await openDialog({
              multiple: false,
              directory: false,
              filters: [{ name: "Certificates", extensions: ["pem", "crt", "cer", "ca-bundle"] }]
          });
          if (selected) {
              updateHttp("cainfo", selected);
          }
      } catch (e) {
          showToast("选择文件失败: " + e, "error");
      }
  };

  return (
     <div className="space-y-4">
      {/* 基础设置 (General) */}
      <div className="card">
         <div className="card-header">
            <div className="card-title flex items-center gap-2">
              <span className="text-cyan-500">⚙️</span> 基础设置 (General)
            </div>
         </div>
         <div className="card-content">
            <div className="form-row">
               <div>
                  <div className="form-label">离线模式 (offline)</div>
                  <div className="form-hint">禁止 Cargo 发出所有网络请求</div>
               </div>
               <div 
                  className={`switch ${config.net?.offline ? "active" : ""}`} 
                  onClick={() => updateNet("offline", !config.net?.offline)} 
               />
            </div>
            <div className="form-row">
               <div>
                  <div className="form-label">Git CLI (git-fetch-with-cli)</div>
                  <div className="form-hint">使用系统 Git 命令而非内置库</div>
               </div>
               <div 
                  className={`switch ${config.net?.["git-fetch-with-cli"] ? "active" : ""}`} 
                  onClick={() => updateNet("git-fetch-with-cli", !config.net?.["git-fetch-with-cli"])} 
               />
            </div>
            <div className="form-row">
               <div>
                  <div className="form-label">多路复用 (multiplexing)</div>
                  <div className="form-hint">HTTP/2 多路复用 (默认开启)</div>
               </div>
               <div 
                  className={`switch ${config.http?.multiplexing !== false ? "active" : ""}`} 
                  onClick={() => updateHttp("multiplexing", config.http?.multiplexing === false ? undefined : false)} 
               />
            </div>
         </div>
      </div>

      {/* 代理服务 (Proxy) */}
      <div className="card">
        <div className="card-header">
          <div className="card-title flex items-center gap-2">
            <span className="text-blue-500">🌐</span> 代理服务 (Proxy)
          </div>
        </div>
        <div className="card-content space-y-3">
           <div>
              <div className="form-label mb-1.5">HTTP 代理</div>
              <div className="flex gap-2">
                  <select 
                    className="select flex-1" 
                    value={httpProxyMode === "custom" ? "custom" : (config.http?.proxy || "")} 
                    onChange={(e) => updateHttpProxy(e.target.value)}
                  >
                    {PROXY_PRESETS.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                  {httpProxyMode === "custom" && (
                    <div className="flex gap-2 flex-1">
                      <input 
                        type="text" 
                        className="input flex-1" 
                        placeholder="host:port" 
                        value={customHttpProxy} 
                        onChange={(e) => setCustomHttpProxy(e.target.value)} 
                      />
                      <button className="btn btn-primary btn-sm" onClick={applyCustomHttpProxy}>Set</button>
                    </div>
                  )}
              </div>
           </div>
           
           <div>
              <div className="form-label mb-1.5">HTTPS 代理</div>
               <div className="flex gap-2">
                  <select 
                    className="select flex-1" 
                    value={httpsProxyMode === "custom" ? "custom" : (config.https?.proxy || "")} 
                    onChange={(e) => updateHttpsProxy(e.target.value)}
                  >
                    {PROXY_PRESETS.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                  {httpsProxyMode === "custom" && (
                    <div className="flex gap-2 flex-1">
                      <input 
                        type="text" 
                        className="input flex-1" 
                        placeholder="host:port" 
                        value={customHttpsProxy} 
                        onChange={(e) => setCustomHttpsProxy(e.target.value)} 
                      />
                      <button className="btn btn-primary btn-sm" onClick={applyCustomHttpsProxy}>Set</button>
                    </div>
                  )}
               </div>
           </div>
        </div>
      </div>

      {/* 连接与安全 (Connection & Security) */}
      <div className="card">
         <div className="card-header">
            <div className="card-title flex items-center gap-2">
              <span className="text-green-500">🛡️</span> 连接与安全 (Security)
            </div>
         </div>
         <div className="card-content">
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                   <div className="form-label mb-1.5">超时时间 (timeout)</div>
                   <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        className="input w-24" 
                        placeholder="30" 
                        value={config.http?.timeout ?? ""} 
                        onChange={(e) => updateHttp("timeout", e.target.value ? parseInt(e.target.value) : undefined)} 
                      />
                      <span className="text-xs text-base-content/70">秒</span>
                   </div>
                   <div className="form-hint mt-1">HTTP 请求超时设置</div>
                </div>
                <div>
                   <div className="form-label mb-1.5">低速限制 (low-speed-limit)</div>
                   <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        className="input w-24" 
                        placeholder="Bytes" 
                        value={config.http?.["low-speed-limit"] ?? ""} 
                        onChange={(e) => updateHttp("low-speed-limit", e.target.value ? parseInt(e.target.value) : undefined)} 
                      />
                      <span className="text-xs text-base-content/70">B/s</span>
                   </div>
                   <div className="form-hint mt-1">速度低于此值时断开</div>
                </div>
            </div>
            
            <div className="form-row">
               <div>
                  <div className="form-label">检查证书吊销 (check-revoke)</div>
                  <div className="form-hint">验证 SSL 证书是否被吊销 (仅 Windows)</div>
               </div>
               <div 
                  className={`switch ${config.http?.["check-revoke"] !== false ? "active" : ""}`} 
                  onClick={() => updateHttp("check-revoke", config.http?.["check-revoke"] === false ? undefined : false)} 
               />
            </div>

            <div className="mt-3">
                <div className="form-label mb-1.5">自定义 CA 证书 (cainfo)</div>
                <div className="flex gap-2">
                    <input 
                      className="input flex-1" 
                      placeholder="/path/to/cert.pem" 
                      value={config.http?.cainfo || ""} 
                      onChange={(e) => updateHttp("cainfo", e.target.value)} 
                    />
                    <button className="btn btn-secondary" onClick={selectCaFile}>📂 选择...</button>
                </div>
            </div>
         </div>
      </div>
     </div>
  );
}
