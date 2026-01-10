## ADDED Requirements
### Requirement: 识别并显示自定义 crates 源
系统 SHALL 在读取 `source.crates-io.replace-with` 时，若该值不匹配内置镜像列表，则 UI 显示“自定义”状态并展示当前值。

#### Scenario: 内置镜像
- **WHEN** `replace-with` 命中内置镜像列表
- **THEN** UI 显示对应内置镜像为已选

#### Scenario: 自定义镜像
- **WHEN** `replace-with` 未命中内置镜像列表
- **THEN** UI 显示“自定义”状态并保留该值

### Requirement: 保存时保留未知 source 条目
系统 MUST 在保存配置时保留 `source` 中非内置镜像的条目，不得删除用户自定义内容。

#### Scenario: 保存自定义
- **WHEN** 用户存在自定义 `source` 条目并执行保存
- **THEN** 保存后的配置仍包含这些条目

### Requirement: 切换内置镜像时仅管理内置条目
系统 SHALL 仅新增/更新/移除内置镜像相关条目，保持未知键不变。

#### Scenario: 切换为官方
- **WHEN** 用户选择官方源
- **THEN** 系统移除 `source.crates-io` 与内置镜像条目，但保留未知条目
