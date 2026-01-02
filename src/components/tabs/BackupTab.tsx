import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import { BackupEntry, CargoConfig } from "@/types";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';


interface Props {
  setConfig: (c: CargoConfig) => void;
  showToast: (msg: string, type: "success" | "error") => void;
  reloadConfig: () => Promise<void>;
  buildExportConfig: () => CargoConfig;
  configPath: string;
  defaultConfigPath: string;
  updateConfigPath: (path: string, shouldReload?: boolean) => Promise<void>;
  resetConfigPath: () => Promise<void>;
}

export function BackupTab({
  setConfig,
  showToast,
  reloadConfig,
  buildExportConfig,
  configPath,
  defaultConfigPath,
  updateConfigPath,
  resetConfigPath
}: Props) {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [backupDir, setBackupDir] = useState("");
  const [customName, setCustomName] = useState("");
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [working, setWorking] = useState(false);
  
  // Preview Hover State
  const [hoverPreview, setHoverPreview] = useState<string | null>(null);
  const [hoverLoading, setHoverLoading] = useState(false);
  const hoveringRef = useRef<string | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPreviewPanelHovered, setIsPreviewPanelHovered] = useState(false);
  
  // 预览缓存：path -> toml字符串
  const [previewCache, setPreviewCache] = useState<Map<string, string>>(new Map());
  
  // 重命名状态
  const [renamingEntry, setRenamingEntry] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const isCustomPath = !!configPath && !!defaultConfigPath && configPath !== defaultConfigPath;

  useEffect(() => {
    loadBackupDir();
    refreshBackups();
  }, [configPath]);

  // 预加载所有备份的配置内容
  async function preloadBackupPreviews(backupList: BackupEntry[]) {
    console.log("[Preview Cache] Preloading", backupList.length, "backups...");
    const newCache = new Map<string, string>();
    
    for (const entry of backupList) {
      try {
        const cfg = await invoke<CargoConfig>("import_config", { path: entry.path });
        const text = await invoke<string>("preview_config", { config: cfg });
        newCache.set(entry.path, text);
      } catch (e) {
        console.error("[Preview Cache] Failed to load", entry.name, e);
        newCache.set(entry.path, "// 加载失败\n" + e);
      }
    }
    
    setPreviewCache(newCache);
    console.log("[Preview Cache] Preloaded", newCache.size, "configs");
  }

  async function loadBackupDir() {
    try {
      const dir = await invoke<string>("get_backup_dir", { path: configPath || undefined });
      setBackupDir(dir);
    } catch (e) {
      console.error(e);
    }
  }

  async function refreshBackups() {
    setLoadingBackups(true);
    try {
      const items = await invoke<BackupEntry[]>("list_backups", { path: configPath || undefined });
      setBackups(items);
      // 预加载所有备份的配置内容
      await preloadBackupPreviews(items);
    } catch (e) {
      showToast("读取备份失败: " + e, "error");
    } finally {
      setLoadingBackups(false);
    }
  }

  async function handleCreateBackup(label?: string) {
    setWorking(true);
    try {
      const trimmedLabel = label?.trim();
      await invoke("create_backup", { path: configPath || undefined, label: trimmedLabel || undefined });
      setCustomName("");
      showToast("备份已创建", "success");
      await refreshBackups();
    } catch (e) {
      showToast("备份失败: " + e, "error");
    } finally {
      setWorking(false);
    }
  }

  async function handleClearBackups() {
    const confirmed = await confirm("确定要删除所有备份文件吗？此操作不可恢复。", {
      title: "清除备份",
      kind: "warning"
    });
    if (!confirmed) return;
    setWorking(true);
    try {
      const count = await invoke<number>("clear_backups", { path: configPath || undefined });
      showToast(`已清除 ${count} 个备份文件`, "success");
      await refreshBackups();
    } catch (e) {
      showToast("清除失败: " + e, "error");
    } finally {
      setWorking(false);
    }
  }

  async function handleRestore(entry: BackupEntry) {
    const confirmed = await confirm("将使用该备份覆盖当前配置，是否继续？", {
      title: "恢复备份",
      kind: "warning"
    });
    if (!confirmed) return;
    setWorking(true);
    try {
      await invoke("restore_backup", { path: configPath || undefined, name: entry.name });
      await reloadConfig();
      showToast("已恢复备份", "success");
    } catch (e) {
      showToast("恢复失败: " + e, "error");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteBackup(entry: BackupEntry) {
    const confirmed = await confirm(`确定要删除备份 "${entry.name}" 吗？此操作不可恢复。`, {
      title: "删除备份",
      kind: "warning"
    });
    if (!confirmed) return;
    setWorking(true);
    try {
      await invoke("delete_backup", { path: configPath || undefined, name: entry.name });
      showToast("备份已删除", "success");
      // 从缓存中移除
      setPreviewCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(entry.path);
        return newCache;
      });
      await refreshBackups();
    } catch (e) {
      showToast("删除失败: " + e, "error");
    } finally {
      setWorking(false);
    }
  }

  function startRename(entry: BackupEntry) {
    setRenamingEntry(entry.name);
    // 提取文件名（去掉 .toml后缀）
    const nameWithoutExt = entry.name.replace(/\.toml$/, "");
    setNewName(nameWithoutExt);
  }

  async function handleRename(entry: BackupEntry) {
    if (!newName.trim()) {
      showToast("新名称不能为空", "error");
      return;
    }
    setWorking(true);
    try {
      await invoke("rename_backup", { 
        path: configPath || undefined, 
        oldName: entry.name, 
        newName: newName.trim() 
      });
      showToast("重命名成功", "success");
      setRenamingEntry(null);
      setNewName("");
      // 刷新列表会重新加载缓存
      await refreshBackups();
    } catch (e) {
      showToast("重命名失败: " + e, "error");
    } finally {
      setWorking(false);
    }
  }

  function cancelRename() {
    setRenamingEntry(null);
    setNewName("");
  }


  async function handleImport() {
    try {
      const selected = await open({
        title: "导入配置文件",
        filters: [{ name: "TOML", extensions: ["toml"] }],
        multiple: false,
        directory: false
      });
      if (typeof selected === "string" && selected) {
        const imported = await invoke<CargoConfig>("import_config", { path: selected });
        setConfig(imported);
        showToast("配置已导入，请保存后写入磁盘", "success");
      }
    } catch (e) {
      showToast("导入失败: " + e, "error");
    }
  }

  async function handleExport() {
    try {
      const normalizedConfigPath = configPath ? configPath.replace(/\\/g, "/") : "";
      const lastSlash = normalizedConfigPath.lastIndexOf("/");
      const configDir = lastSlash >= 0 ? normalizedConfigPath.slice(0, lastSlash) : "";
      const defaultName = configDir ? `${configDir}/config-export.toml` : "config-export.toml";
      const path = await save({
        title: "导出配置文件",
        defaultPath: defaultName,
        filters: [{ name: "TOML", extensions: ["toml"] }]
      });
      if (typeof path === "string" && path) {
        await invoke("export_config", { path, config: buildExportConfig() });
        showToast("配置已导出", "success");
      }
    } catch (e) {
      showToast("导出失败: " + e, "error");
    }
  }

  async function handleChooseConfigDir() {
    try {
      const selected = await open({
        title: "选择配置目录",
        directory: true,
        multiple: false
      });
      if (typeof selected === "string" && selected) {
        const normalized = selected.replace(/\\/g, "/");
        await updateConfigPath(`${normalized}/config.toml`);
      }
    } catch (e) {
      showToast("选择目录失败: " + e, "error");
    }
  }

  async function handleChooseConfigFile() {
    try {
      const selected = await open({
        title: "选择配置文件",
        filters: [{ name: "TOML", extensions: ["toml"] }],
        multiple: false,
        directory: false
      });
      if (typeof selected === "string" && selected) {
        const normalized = selected.replace(/\\/g, "/");
        await updateConfigPath(normalized);
      }
    } catch (e) {
      showToast("选择文件失败: " + e, "error");
    }
  }

  async function handleOpenConfigFolder() {
    try {
      await invoke("open_config_folder", { path: configPath || undefined });
    } catch (e) {
      showToast("打开目录失败: " + e, "error");
    }
  }

  async function handleOpenConfigFile() {
    try {
      await invoke("open_config_file", { path: configPath || undefined });
    } catch (e) {
      showToast("打开文件失败: " + e, "error");
    }
  }

  async function handleOpenBackupDir() {
    try {
      if (!backupDir) return;
      await invoke("open_folder", { path: backupDir });
    } catch (e) {
      showToast("打开目录失败: " + e, "error");
    }
  }

  async function handleOpenBackupFile(entry: BackupEntry) {
    try {
      await invoke("open_config_file", { path: entry.path });
    } catch (e) {
      showToast("打开文件失败: " + e, "error");
    }
  }

  async function handleMouseEnterPreview(path: string) {
    console.log("[Preview] Mouse enter, path:", path);
    
    // 清除之前的自动关闭定时器
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    
    hoveringRef.current = path;
    
    // 优先从缓存读取
    const cached = previewCache.get(path);
    if (cached) {
      console.log("[Preview] Using cached preview");
      setHoverPreview(cached);
      setHoverLoading(false);
      
      // 5秒后自动关闭
      autoCloseTimerRef.current = setTimeout(() => {
        if (!isPreviewPanelHovered) {
          console.log("[Preview] Auto-closing preview");
          setHoverPreview(null);
          hoveringRef.current = null;
        }
      }, 5000);
      return;
    }
    
    // 缓存未命中，加载数据
    setHoverLoading(true);
    setHoverPreview(null);
    console.log("[Preview] Cache miss, loading...");
    
    try {
       const cfg = await invoke<CargoConfig>("import_config", { path });
       const text = await invoke<string>("preview_config", { config: cfg });
       console.log("[Preview] Preview loaded, length:", text?.length);
       
       // 更新缓存
       setPreviewCache(prev => new Map(prev).set(path, text));
       
       setHoverPreview(text);
       setHoverLoading(false);
       console.log("[Preview] Preview set, will auto-close in 5s");
       
       // 5秒后自动关闭
       autoCloseTimerRef.current = setTimeout(() => {
         if (!isPreviewPanelHovered) {
           console.log("[Preview] Auto-closing preview");
           setHoverPreview(null);
           hoveringRef.current = null;
        }
       }, 5000);
       
    } catch (e) {
       console.error("[Preview] Error:", e);
       const errorMsg = "// 读取失败或文件损坏\n" + e;
       setHoverPreview(errorMsg);
       setHoverLoading(false);
       // 缓存错误信息
       setPreviewCache(prev => new Map(prev).set(path, errorMsg));
    }
  }

  function handleMouseLeavePreview() {
     console.log("[Preview] Eye icon mouse leave (ignored)");
     // 不立即清除，让预览继续显示
  }

  const formatTime = (stamp: number) => {
    if (!stamp) return "-";
    return new Date(stamp * 1000).toLocaleString();
  };

  const formatSize = (size: number) => {
    if (!size) return "-";
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>⚙️</span> 配置位置</div>
          <div className="card-desc">管理配置文件存储位置与快速打开</div>
        </div>
        <div className="card-content">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>当前配置文件</div>
            <div style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-all" }}>
              {configPath || "-"}
            </div>
            {defaultConfigPath && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                默认路径: {defaultConfigPath}
              </div>
            )}
            <div style={{ fontSize: 12, color: isCustomPath ? "var(--accent-cyan)" : "var(--text-secondary)" }}>
              {isCustomPath ? "当前使用自定义路径" : "当前使用默认路径"}
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 12 }}>
            <div>
              <div className="form-label">快速打开</div>
              <div className="form-hint">直接定位到配置文件或目录</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={handleOpenConfigFolder} disabled={!configPath}>
                打开目录
              </button>
              <button className="btn btn-secondary" onClick={handleOpenConfigFile} disabled={!configPath}>
                打开文件
              </button>
            </div>
          </div>
          <div className="form-row">
            <div>
              <div className="form-label">切换位置</div>
              <div className="form-hint">支持自定义目录或指定文件</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-secondary" onClick={handleChooseConfigDir}>
                选择目录
              </button>
              <button className="btn btn-secondary" onClick={handleChooseConfigFile}>
                选择文件
              </button>
              <button className="btn btn-secondary" onClick={resetConfigPath} disabled={!isCustomPath}>
                恢复默认
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-blue)" }}>🛡️</span> 备份配置</div>
          <div className="card-desc">保存前建议先备份，便于随时回滚</div>
        </div>
        <div className="card-content">
          <div className="form-row">
            <div>
              <div className="form-label">默认备份</div>
              <div className="form-hint">自动命名，保存当前配置快照</div>
            </div>
            <button className="btn btn-primary" onClick={() => handleCreateBackup()} disabled={working}>
              立即备份
            </button>
          </div>
          <div className="form-row" style={{ alignItems: "center" }}>
            <div>
              <div className="form-label">自定义备份</div>
              <div className="form-hint">可输入名称，便于识别</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                style={{ width: 220 }}
                value={customName}
                placeholder="例如：发布前"
                onChange={(e) => setCustomName(e.target.value)}
              />
              <button
                className="btn btn-secondary"
                onClick={() => handleCreateBackup(customName)}
                disabled={!customName.trim() || working}
              >
                创建备份
              </button>
            </div>
          </div>
          {backupDir && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              备份目录: {backupDir}
            </p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-green)" }}>📦</span> 备份列表</div>
          <div className="card-desc">悬停眼睛图标查看预览</div>
        </div>
        <div className="card-content">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleClearBackups} disabled={!backups.length || working}>
              清除所有备份
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleOpenBackupDir} disabled={!backupDir}>
                打开目录
              </button>
              <button className="btn btn-secondary btn-sm" onClick={refreshBackups} disabled={loadingBackups}>
                {loadingBackups ? "刷新中..." : "刷新列表"}
              </button>
            </div>
          </div>
          {backups.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {backups.map(entry => {
                const isRenaming = renamingEntry === entry.name;
                const displayName = entry.name.replace(/\.toml$/, "");
                
                return (
                  <div
                    key={entry.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                      padding: "10px 12px 10px 16px"
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isRenaming ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              className="input"
                              style={{ width: 250, fontSize: 13 }}
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRename(entry);
                                if (e.key === "Escape") cancelRename();
                              }}
                              autoFocus
                              placeholder="输入新名称"
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => handleRename(entry)} disabled={working}>
                              确认
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={cancelRename} disabled={working}>
                              取消
                            </button>
                          </div>
                        ) : (
                          <>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{displayName}</span>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 11, padding: "2px 8px" }}
                              onClick={() => startRename(entry)}
                              disabled={working}
                              title="重命名"
                            >
                              ✏️ 重命名
                            </button>
                          </>
                        )}
                      </div>
                      {!isRenaming && (
                        <>
                          <div style={{ fontSize:12, color: "var(--text-secondary)" }}>
                            更新时间: {formatTime(entry.modified)} · 大小: {formatSize(entry.size)}
                          </div>
                        </>
                      )}
                    </div>
                    {!isRenaming && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div
                          onMouseEnter={() => handleMouseEnterPreview(entry.path)}
                          onMouseLeave={handleMouseLeavePreview}
                          style={{
                            fontSize: 18,
                            cursor: "help",
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: hoveringRef.current === entry.path ? "var(--accent-cyan)" : "rgba(100, 200, 255, 0.1)",
                            color: hoveringRef.current === entry.path ? "white" : "var(--accent-cyan)",
                            transition: "all 0.2s ease",
                            userSelect: "none"
                          }}
                          title="悬停预览配置"
                        >
                          👁️
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenBackupFile(entry)} disabled={working}>
                          查看文件
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleRestore(entry)} disabled={working}>
                          恢复
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => handleDeleteBackup(entry)} 
                          disabled={working}
                          style={{ color: "var(--error-color)", borderColor: "var(--error-color)" }}
                          title="删除备份"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-secondary)", fontStyle: "italic" }}>
              {loadingBackups ? "加载中..." : "暂无备份"}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><span style={{ color: "var(--accent-cyan)" }}>📁</span> 导入/导出</div>
          <div className="card-desc">支持外部配置文件流转</div>
        </div>
        <div className="card-content">
          <div className="form-row">
            <div>
              <div className="form-label">导入配置</div>
              <div className="form-hint">导入后需点击保存配置生效</div>
            </div>
            <button className="btn btn-secondary" onClick={handleImport} disabled={working}>
              选择文件导入
            </button>
          </div>
          <div className="form-row">
            <div>
              <div className="form-label">导出配置</div>
              <div className="form-hint">导出当前配置到文件</div>
            </div>
            <button className="btn btn-secondary" onClick={handleExport} disabled={working}>
              导出配置
            </button>
          </div>
        </div>
      </div>


      {/* Floating Preview Panel */}
      {(() => {
        const shouldShow = hoverPreview !== null || hoverLoading;
        console.log("[Preview Panel] Render check:", { 
          hoverPreview: hoverPreview?.substring(0, 50), 
          hoverLoading, 
          shouldShow 
        });
        return shouldShow;
      })() && (
        <div
          onMouseEnter={() => {
            console.log("[Preview] Panel mouse enter");
            setIsPreviewPanelHovered(true);
            if (autoCloseTimerRef.current) {
              clearTimeout(autoCloseTimerRef.current);
              autoCloseTimerRef.current = null;
            }
          }}
          onMouseLeave={() => {
            console.log("[Preview] Panel mouse leave - closing");
            setIsPreviewPanelHovered(false);
            setHoverPreview(null);
            hoveringRef.current = null;
          }}
          style={{
           position: "fixed",
           top: "50%",
           left: "calc(240px + (100vw - 240px) / 2)",
           transform: "translate(-50%, -50%)",
           width: "550px",
           maxWidth: "calc(100vw - 280px)",
           height: "65vh",
           maxHeight: "550px",
           background: "var(--bg-secondary)",
           border: "2px solid var(--accent-cyan)",
           borderRadius: 12,
           boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
           zIndex: 2000,
           display: "flex",
           flexDirection: "column",
           overflow: "hidden",
           backdropFilter: "blur(20px)",
           animation: "fadeIn 0.2s ease"
        }}>
           <div style={{
               padding: "12px 16px",
               borderBottom: "1px solid var(--border-color)",
               background: "rgba(0,0,0,0.3)",
               display: "flex",
               justifyContent: "space-between",
               alignItems: "center"
           }}>
              <span style={{ fontWeight: 600, color: "var(--accent-cyan)" }}>📝 配置预览</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>移开鼠标关闭</span>
           </div>
           <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
              {hoverLoading && !hoverPreview ? (
                 <div style={{
                     display: "flex", alignItems: "center", justifyContent: "center", height: "100%",
                     color: "var(--text-secondary)"
                 }}>
                     加载中...
                 </div>
              ) : (
                 <SyntaxHighlighter
                   language="toml"
                   style={vscDarkPlus}
                   customStyle={{
                     margin: 0,
                     padding: "16px",
                     background: "transparent",
                     fontSize: "13px",
                     lineHeight: "1.6",
                     height: "100%"
                   }}
                   showLineNumbers={true}
                   wrapLines={true}
                 >
                   {hoverPreview || ""}
                 </SyntaxHighlighter>
              )}
           </div>
        </div>
      )}

    </>
  );
}
