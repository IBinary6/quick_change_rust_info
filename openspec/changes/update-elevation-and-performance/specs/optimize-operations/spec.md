## ADDED Requirements
### Requirement: 长耗时操作异步执行
应用 MUST 将可能耗时的任务在后台执行，并保持 UI 可交互，同时提供可见的进行中状态。

#### Scenario: 工具链/目标安装
- **WHEN** 用户安装 toolchain/target 或 sccache
- **THEN** UI 显示进行中状态且界面保持可操作

#### Scenario: 缓存统计
- **WHEN** 用户请求缓存占用统计
- **THEN** 统计在后台执行并显示计算中状态

### Requirement: 毛玻璃 Loading 覆盖层
应用 MUST 在长耗时或并发操作期间显示毛玻璃风格的 Loading 覆盖层，并提供明确的任务提示。

#### Scenario: 单任务执行
- **WHEN** 用户触发单个长耗时操作
- **THEN** 在对应模块显示毛玻璃 Loading 覆盖层与任务提示

#### Scenario: 并发任务执行
- **WHEN** 多个长耗时任务同时运行
- **THEN** 各自模块显示独立 Loading 覆盖层且互不阻塞

### Requirement: Loading 覆盖层范围
应用 MUST 默认使用模块级覆盖层，不阻塞无关区域；仅在全局性操作（如提权重启）时使用全局遮罩。

#### Scenario: 模块级覆盖
- **WHEN** 单个模块内触发长耗时操作
- **THEN** 仅该模块显示覆盖层，其他区域可继续操作

#### Scenario: 全局覆盖
- **WHEN** 触发全局性操作（如即将重启）
- **THEN** 显示全局覆盖层并提示即将重启

### Requirement: 备份预览按需加载与限流
应用 MUST 在需要时加载备份预览，并限制并发或空闲预取以避免卡顿。

#### Scenario: 刷新备份列表
- **WHEN** 备份列表刷新完成
- **THEN** 不阻塞 UI，预览内容仅按需或分批加载

#### Scenario: 悬停预览
- **WHEN** 用户悬停预览入口
- **THEN** 应用加载并缓存该备份的预览内容

### Requirement: 可恢复的操作反馈
应用 MUST 为长耗时或失败的操作提供清晰的状态与重试入口。

#### Scenario: 后台任务失败
- **WHEN** 后台任务失败
- **THEN** 显示失败原因并提供重试入口
