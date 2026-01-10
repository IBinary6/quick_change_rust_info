# Change: 启动权限提升与全局性能优化

## Why
当前应用在普通权限启动时，涉及系统级配置（如系统级工具链源）会失败并让用户误以为已生效；同时多处长耗时操作会造成界面卡顿或“无响应”，影响体验与可靠性。需要明确权限边界并全面优化响应性。

## What Changes
- 启动即检测管理员权限，所有平台在非管理员启动时显示阻断提示并请求提权
- Windows 触发 UAC 一键提权并重启应用；macOS/Linux 使用系统授权方式提权并重启
- 用户拒绝提权时以普通模式继续，系统级功能明确受限
- 为长耗时并发操作引入毛玻璃 Loading 覆盖层（模块级优先），提升操作可感知性且不阻塞全局交互

## Impact
- Affected specs: enforce-elevation, optimize-operations
- Affected code: `src/App.tsx`, `src/components/tabs/RegistryTab.tsx`, `src/components/tabs/BackupTab.tsx`, `src/components/tabs/ToolsTab.tsx`, `src-tauri/src/lib.rs`, `src-tauri/src/config.rs`, 以及权限/进程启动相关模块
