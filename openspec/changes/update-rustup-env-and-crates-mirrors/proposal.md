# Change: 全局 Rustup 镜像与 crates 源自定义展示

## Why
当前“工具链下载源”仅写入 Cargo 的 [env]，不会影响 rustup；并且自定义 crates 源在保存时会被重置，造成用户配置丢失。

## What Changes
- Rustup 镜像改为全局环境变量管理（用户级 + 系统级），启动时读取并展示
- UI 显示用户级/系统级值，冲突时标记并提示
- 修改 Rustup 镜像前需确认；系统级写入失败时保留用户级并提示管理员重试
- crates 源支持“自定义”状态显示，保存时保留未知 source 条目
- 应用内 rustup 调用使用当前镜像环境变量以确保即时生效

## Impact
- Affected specs: manage-rustup-env, manage-cargo-sources
- Affected code: src/components/tabs/RegistryTab.tsx, src/App.tsx, src-tauri/src/lib.rs, src-tauri/src/config.rs, src/types.ts, src/lib/mirrors.ts
