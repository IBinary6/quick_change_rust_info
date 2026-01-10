## Context
- 需要让 Rustup 镜像设置真正生效，且对用户/系统级环境变量可见
- 需要在 UI 中展示用户级与系统级值并标记冲突
- 需要避免保存时重置自定义 crates 源

## Goals / Non-Goals
- Goals:
  - 跨平台（Windows/macOS/Linux）读取与写入 Rustup 镜像环境变量
  - UI 显示用户级/系统级值，冲突时明确标记
  - 修改 Rustup 镜像前必须确认；系统级失败时保留用户级并提供管理员重试
  - crates 源自定义状态可见且不会被重置
- Non-Goals:
  - 自动执行 rustup update 或安装工具链
  - 变更 rustup 自身配置或 Cargo Registry 机制
  - 管理所有系统环境变量（仅处理 Rustup 镜像相关键）

## Decisions
- 使用“受管块（managed block）”写入环境变量，避免覆盖用户自定义内容
- Windows:
  - 用户级写入 HKCU\Environment
  - 系统级写入 HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment
  - 写入后广播 WM_SETTINGCHANGE 以刷新环境（若失败仅提示）
- Linux:
  - 用户级写入 ~/.profile 中的受管块，并引用 ~/.config/quickchange/rustup.env
  - 系统级写入 /etc/profile.d/quickchange-rustup.sh
- macOS:
  - 用户级写入 ~/.zprofile（若不存在则退回 ~/.profile）
  - 系统级写入 /etc/zprofile
- Backend 返回结构化状态：用户级/系统级值、冲突标记、错误信息
- UI 修改 Rustup 镜像必须二次确认，系统级失败则保留用户级并提示管理员重试
- 不新增独立“同步”按钮，用户选择镜像即同时写入用户级与系统级
- 应用内 rustup 调用显式注入当前镜像环境变量，避免依赖系统环境刷新

## Alternatives Considered
- 仅在应用进程内设置环境变量：无法满足“全局生效”的目标
- 写入 ~/.cargo/env：该文件由 rustup 管理，可能被覆盖
- 仅支持 systemd environment.d：跨平台兼容性不足

## Risks / Trade-offs
- 修改 shell 启动文件可能与用户配置冲突：通过受管块减小风险
- 系统级写入需要管理员权限：失败时提示并提供重试入口
- 现有终端不会立刻生效：需要提示用户重启终端/会话

## Migration Plan
- 首次进入页面时读取现有用户级/系统级值并展示
- 在用户确认前不写入任何设置
- 冲突时通过选择镜像进行同步写入

## Open Questions
- 暂无
