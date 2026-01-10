## ADDED Requirements
### Requirement: 启动时展示 Rustup 镜像环境变量
系统 SHALL 在应用启动或进入“工具链下载源”区域时读取 `RUSTUP_DIST_SERVER` 与 `RUSTUP_UPDATE_ROOT` 的用户级与系统级值，并在 UI 中分别展示。

#### Scenario: 同时存在且不同
- **WHEN** 用户级与系统级值不一致
- **THEN** UI 显示冲突标记并分别展示两者

#### Scenario: 均未设置
- **WHEN** 两个作用域均未设置
- **THEN** UI 显示为官方/未设置状态

### Requirement: 修改 Rustup 镜像前需确认
系统 SHALL 在用户尝试修改 Rustup 镜像时弹出确认提示。

#### Scenario: 用户确认
- **WHEN** 用户确认修改
- **THEN** 系统尝试同时写入用户级与系统级

#### Scenario: 用户取消
- **WHEN** 用户取消修改
- **THEN** 系统不写入任何作用域

### Requirement: 系统级写入失败处理
系统 MUST 保留用户级写入结果，并提示系统级未生效，同时提供管理员权限重试入口。

#### Scenario: 系统级失败
- **WHEN** 用户级写入成功但系统级写入失败
- **THEN** UI 显示警告并提供重试操作

### Requirement: 应用内 rustup 调用使用当前镜像
系统 SHALL 在调用 rustup 命令时注入当前选择的 `RUSTUP_DIST_SERVER` 与 `RUSTUP_UPDATE_ROOT`。

#### Scenario: 系统级未刷新
- **WHEN** 系统级写入失败或尚未刷新环境
- **THEN** 应用内 rustup 仍使用当前选择的镜像
