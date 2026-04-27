# TweetPilot 本地命令调用授权机制技术方案（融合版）

## 1. 文档目的

本文融合以下两份文档的内容，并以**单文档**形式给出最终建议：

- `docs/local-command-authorization-mechanism.md`
- `docs/local-command-authorization-mvp.md`

目标是把 TweetPilot 当前基于 `claurst` 的 AI 本地工具调用安全问题，在**一个文档里讲清楚**：

1. 当前风险在哪里
2. 为什么现有实现危险
3. 目标权限模型是什么
4. 第一阶段 MVP 应该怎么落地
5. 需要改哪些文件
6. 用户授权后，AI 可以做到什么程度

---

## 2. 核心结论

### 2.1 当前实现存在明显安全缺口

TweetPilot 当前已经接入 `claurst`，并启用了以下工具：

- `FileReadTool`
- `FileEditTool`
- `FileWriteTool`
- `BashTool`
- `GlobTool`
- `GrepTool`

但从现有代码看，权限机制实际上被**直接绕过**了：

- `src-tauri/src/claurst_session.rs` 中：
  - `config.permission_mode = PermissionMode::BypassPermissions`
  - `ToolContext.permission_mode = PermissionMode::BypassPermissions`
  - `permission_handler = AutoPermissionHandler(BypassPermissions)`
  - `pending_permissions = None`
  - `permission_manager = None`

这意味着：

1. AI 可以直接执行本地命令
2. AI 可以直接读写本地文件
3. 当前前端虽然能展示 tool call，但**没有真正的授权环节**
4. 风险不在“AI 可能乱想”，而在“工具层真的会直接执行”

### 2.2 问题根因不是缺少工作区概念，而是绕过了权限系统

当前架构其实已经有良好的基础：

- `ClaurstSession::new(...)` 会接收 `working_dir`
- `config.project_dir = Some(working_dir.clone())`

所以问题不在于 TweetPilot 完全不知道 workspace，而在于：

> **TweetPilot 当前集成 claurst 时，把原本应该存在的权限判定与用户授权流程短路掉了。**

### 2.3 本方案不再保留“WorkspaceWrite 模式”作为硬限制

本轮融合后的结论，按你的要求调整为：

- **不再把“只能写 workspace 内”作为产品级硬限制**
- 只要用户明确授权，AI **可以读取、写入、修改任意目录**
- 但必须满足一个前提：
  - **不能静默执行，必须先经过权限系统**

也就是说，新的核心原则不是：

- “只能改 workspace 内”

而是：

- **默认不直接放行高风险操作**
- **跨目录、外部目录、删除、危险命令都必须先授权**
- **授权通过后，允许执行**

这个变化非常重要：

> 本方案的重点从“工作区硬边界”调整为“用户授权优先级高于目录边界”。

---

## 3. 设计目标

本方案的目标不是单纯“加一个弹窗”，而是建立一套真正可靠的**本地命令与文件操作授权机制**。

### 3.1 基本目标

1. AI 不能再无条件执行本地命令
2. AI 不能再无条件读写本地文件
3. 危险操作必须显式授权
4. 用户授权后，AI 可以执行被授权的外部路径操作
5. 所有授权过程都可追踪、可解释、可扩展

### 3.2 用户体验目标

用户应能清楚看到：

- AI 想调用哪个工具
- 想执行什么命令
- 想读/写/删哪个路径
- 为什么需要权限
- 这次操作风险高不高

并能明确选择：

- 允许一次
- 本次会话允许
- 当前工作区持续允许此类操作（可选增强）
- 拒绝

### 3.3 安全目标

1. 不再允许任何“静默高风险操作”
2. 删除操作必须单独视为高风险
3. 危险命令不能因为 prompt 写得保守就被默认信任
4. 即使用户最终可以授权外部路径，也必须先让用户看见并确认

---

## 4. 新的权限模型

## 4.1 模式设计

融合后的版本，建议把本地工具模式收敛为两层：

```rust
pub enum LocalToolMode {
    ReadOnly,
    Interactive,
}
```

### ReadOnly
- 允许低风险只读操作
- 禁止写文件
- 禁止删除
- 禁止执行高风险 shell 命令

### Interactive
- 允许工具发起写入、修改、删除、外部路径访问等请求
- 但是否真正执行，由权限系统逐条或按规则授权
- **不是自动全放行**，而是“允许进入可授权流程”

也就是说：

- `ReadOnly`：只能做明显安全的读操作
- `Interactive`：可以请求更多权限，但要经过用户授权

> 不再保留 `WorkspaceWrite` 作为中间层模式。

---

## 4.2 权限域划分

建议把权限拆为以下类型：

### 文件类
- `file.read`
- `file.write`
- `file.delete`

### 命令类
- `command.readonly`
- `command.write`
- `command.destructive`
- `command.network`

### Git 类
- `git.readonly`
- `git.write`
- `git.destructive`

### 路径范围标签（不是硬限制，而是风险标签）
- `path.workspace`
- `path.external`
- `path.system_sensitive`

这里要特别强调：

- `path.external` 不再等于“直接禁止”
- 它表示“这是工作区外路径，需要更高风险级别和更明确授权”

---

## 4.3 默认策略矩阵

| 操作类型 | ReadOnly | Interactive |
|---|---|---|
| 读取 workspace 内文件 | 允许 | 允许 |
| 读取 workspace 外文件 | 询问/拒绝 | 询问 |
| 写入 workspace 内文件 | 拒绝 | 询问/允许 |
| 写入 workspace 外文件 | 拒绝 | 询问/允许 |
| 删除任意文件 | 拒绝 | 强制询问 |
| 低风险只读命令 | 允许 | 允许 |
| 可能写入的命令 | 拒绝 | 询问/允许 |
| 危险命令 | 拒绝 | 强制询问或直接拒绝 |

注意：

- `Interactive` 不是“自动允许一切”
- `Interactive` 的含义是：**系统允许 AI 发起高权限请求，但是否执行由用户决定**

---

## 4.4 权限决策链路

相比“列出要改哪些文件”，更稳定的设计重点其实是：

> **每一次工具调用，都必须先经过统一的风险判定，再决定是自动放行、请求授权，还是直接拒绝。**

建议把整条链路固定为下面 6 步：

1. **AI 发起工具调用请求**
   - 例如读文件、写文件、删除文件、执行 shell 命令
2. **工具层提取目标信息**
   - 文件类：目标路径、操作类型
   - 命令类：原始命令、推断出的目标路径、风险特征
3. **后端策略层做风险判断**
   - 路径分类：workspace / external / system_sensitive / symlink_escape
   - 命令分类：readonly / write / destructive / network / unknown
4. **根据模式和风险生成系统决策**
   - 自动允许
   - 请求用户授权
   - 直接拒绝
5. **若需要授权，则进入前端确认**
   - 前端只展示事实和收集决策，不负责做安全判断
6. **将最终结果返回工具执行层**
   - 允许：继续执行
   - 拒绝：中止执行，并把拒绝原因回传给 AI

这个链路里，真正稳定的边界有两个：

- **风险判断必须在执行前发生**
- **前端授权只能放行当前请求，不能替代后端策略判断**

这两个边界比“某个具体文件里怎么实现”更重要，因为即使后续代码目录调整，这套链路本身仍然成立。

---

## 5. 关于路径边界的新定位

## 5.1 仍然必须做路径分类，但不再把 workspace 外作为绝对禁止

虽然本次去掉了 `WorkspaceWrite` 限制，但路径分类仍然必须保留，因为它承担的是：

1. 风险提示
2. 授权文案
3. 安全审计
4. 防绕过判断

路径系统现在的职责不是“把外部路径硬挡住”，而是：

- 判断目标到底在哪里
- 识别是否为外部目录
- 识别是否为敏感路径
- 决定这次操作需要怎样的授权等级

## 5.2 必须处理的绕过场景

无论是否允许外部授权，以下场景都必须正确识别：

- `../` 路径逃逸
- 相对路径绕过
- 软链接跳出 workspace
- shell 重定向写文件
- 父目录不存在时的归属判断

建议新增模块：

- `src-tauri/src/services/path_guard.rs`

建议接口：

```rust
pub enum PathAccessClass {
    Workspace,
    External,
    SystemSensitive,
    SymlinkEscape,
    Unknown,
}

pub fn classify_path_access(workspace_root: &Path, target: &Path) -> Result<PathAccessClass, String>
```

### 5.3 推荐的敏感路径示例

以下路径不一定绝对禁止，但应默认标为**更高风险**：

- `~/.ssh/`
- `~/.aws/`
- `~/.config/`
- `~/Library/`
- `/etc/`
- `/usr/`
- `/System/`
- 系统 keychain / credential 相关目录
- 浏览器 profile 目录

对于这些路径，建议：

- 即使在 `Interactive` 模式下，也要求显式确认
- UI 上明确标为“系统敏感目录”

---

## 6. 命令风控模型

## 6.1 BashTool 不能继续裸奔

`BashTool` 仍然是本方案中风险最高的工具。

即使保留 claurst 自带 `BashTool`，也必须在真正执行前增加 TweetPilot 自己的风控层。

建议新增模块：

- `src-tauri/src/services/command_policy.rs`

建议结构：

```rust
pub enum CommandRiskLevel {
    ReadOnly,
    Write,
    Destructive,
    Network,
    Unknown,
}

pub struct CommandAssessment {
    pub risk: CommandRiskLevel,
    pub reasons: Vec<String>,
    pub touched_paths: Vec<PathBuf>,
}

pub fn assess_command(command: &str) -> CommandAssessment
```

## 6.2 MVP 级命令分类

### A. 可自动允许的低风险只读命令

- `pwd`
- `ls`
- `find`
- `rg`
- `grep`
- `git status`
- `git diff`
- `git log`
- `python --version`
- `node --version`

### B. 需要授权的命令

- `mkdir`
- `touch`
- `cp`
- `mv`
- `git add`
- `cargo fmt`
- `npm install`
- 任意包含 `>` / `>>` 的命令
- 任意命中外部路径的命令
- 无法可靠分类的命令

### C. 高风险命令

以下命令建议默认进入**高风险授权**，甚至部分命令直接拒绝：

- `rm`
- `rm -rf`
- `sudo`
- `chmod`
- `chown`
- `git reset --hard`
- `git clean`
- `git checkout -- .`
- `curl ... | sh`

## 6.3 关于“授权后能否执行高风险命令”

按你现在的要求，方案不再简单采用“workspace 外直接禁用”的思路。

因此建议区分两类高风险命令：

### 可授权高风险命令
用户明确看到风险并确认后，可以执行，例如：

- 删除指定临时文件
- 删除某个明确路径的文件或目录
- 修改指定外部配置文件

### 仍建议直接拒绝或二次确认的命令
即使用户授权，也建议提高门槛，例如：

- `curl ... | sh`
- `sudo ...`
- 批量删除系统敏感目录
- 对系统目录做递归改写

也就是说，新的原则不是“所有授权都等价”，而是：

- **普通授权**：允许常规文件和命令操作
- **高风险授权**：允许明显危险但仍可解释的操作
- **极高风险操作**：建议二次确认或保持拒绝

---

## 6.4 风险分层原则

为了避免文档随着代码结构变化而失效，风险模型应尽量写成**原则**，而不是零散规则表。

建议长期保持以下判断顺序：

### 第一层：先看是否会产生副作用

如果操作会造成以下任意结果，就不能再按低风险处理：

- 文件内容变化
- 文件/目录删除
- 文件权限变化
- git 状态变化
- 依赖安装或环境变化
- 网络下载并执行

也就是说，**“会不会改变本地状态”** 是第一分水岭。

### 第二层：再看影响范围

即使是同一种写入操作，影响范围不同，风险等级也不同：

- workspace 内明确文件
- workspace 外普通路径
- 系统敏感路径
- 无法可靠确定范围的路径或命令

也就是说，**“改什么”** 之外，还必须判断 **“改到哪里”**。

### 第三层：再看是否可解释、可回退

高风险不只来自“会写入”，还来自“用户是否容易理解后果”：

- 可解释、范围清晰、目标单一的操作，适合进入授权流程
- 范围模糊、批量递归、隐含副作用强的操作，应提高授权门槛
- 明显不可控或极易滥用的操作，可以直接拒绝

例如：

- `rm ./tmp.txt` 比 `rm -rf ~/Library` 更容易解释和授权
- `git add src/main.rs` 比 `git clean -fd` 更容易控制
- `curl ... | sh` 的风险不只是“会执行”，还在于执行内容不可见

### 第四层：默认保守，而不是默认信任

只要系统不能可靠判断，就应进入更严格分支：

- 无法解析的命令 → 询问或拒绝
- 无法确定归属的路径 → 按高风险处理
- 无法确认是否有副作用 → 按有副作用处理

MVP 的核心原则应该是：

> **宁可多请求一次授权，也不要因为分类不准而静默放行。**

---

## 7. 结合 claurst 的实现策略

## 7.1 推荐结论

从当前代码看，`claurst` 本身已经暴露了权限抽象接口：

- `PermissionMode`
- `AutoPermissionHandler`
- `pending_permissions`
- `permission_manager`

这说明它并不是完全不支持权限流，而是 TweetPilot 当前接入时没有把这一层用起来。

因此推荐结论是：

> **优先复用 claurst 的权限抽象，在 TweetPilot 侧补齐权限策略与授权交互，而不是完全绕开 claurst 重造工具协议。**

## 7.2 当前必须调整的地方

文件：`src-tauri/src/claurst_session.rs`

至少需要改：

1. 去掉 `PermissionMode::BypassPermissions`
2. 不再使用 `AutoPermissionHandler(BypassPermissions)`
3. 接入 TweetPilot 自定义 permission handler
4. 接通 `pending_permissions` / `permission_manager`

## 7.3 推荐新增自定义处理器

建议实现：

```rust
TweetPilotPermissionHandler
```

职责：

1. 接收 claurst 发出的权限请求
2. 先用后端策略自动判断
3. 低风险命中 allowlist 直接放行
4. 中高风险则向前端发起 `permission-request`
5. 等待用户确认
6. 把结果返回给 claurst

这个处理器是整个方案的核心。

---

## 8. 前后端交互设计

## 8.1 现有基础

当前已经有：

- `tool-call-start`
- `tool-call-end`
- `ai-status`

这说明不需要重造消息通道，只需要扩展事件类型。

## 8.2 建议新增事件

- `permission-request`
- `permission-resolved`
- `permission-expired`

## 8.3 `permission-request` 建议载荷

```json
{
  "request_id": "req-123",
  "permission_id": "perm-456",
  "tool": "bash",
  "action": "rm -rf ./build",
  "scope": "command.destructive",
  "mode": "Interactive",
  "reason": "命令将删除目录内容",
  "paths": ["/abs/path/build"],
  "path_class": "workspace",
  "risk": "high"
}
```

如果目标是外部目录，则：

```json
{
  "path_class": "external"
}
```

如果目标是系统敏感目录，则：

```json
{
  "path_class": "system_sensitive"
}
```

## 8.4 前端授权选项

建议支持：

- 允许一次
- 本次会话允许
- 当前工作区持续允许此类操作（第二阶段）
- 拒绝

MVP 最少只做：

- 允许一次
- 拒绝

## 8.5 建议新增 Tauri 命令

- `resolve_ai_permission(permission_id, decision)`

其中 `decision` 可为：

- `allow_once`
- `allow_session`
- `allow_workspace`
- `deny`

---

## 9. 建议新增的数据结构

## 9.1 模式结构

```rust
pub enum LocalToolMode {
    ReadOnly,
    Interactive,
}
```

## 9.2 待授权请求

```rust
pub struct PendingPermissionRequest {
    pub permission_id: String,
    pub window_label: String,
    pub request_id: String,
    pub tool: String,
    pub action: String,
    pub scope: String,
    pub reason: String,
    pub risk: String,
    pub paths: Vec<String>,
    pub path_class: String,
    pub created_at: i64,
}
```

## 9.3 用户决策

```rust
pub enum PermissionDecision {
    AllowOnce,
    AllowSession,
    Deny,
}
```

第二阶段再加：

```rust
AllowWorkspace
```

## 9.4 缓存结构

建议先支持两层：

1. 一次性授权
2. 会话级授权

工作区持久化规则可以放到第二阶段再做。

---

## 9.5 授权后的行为边界

用户授权之后，系统语义会发生变化，但这个变化必须被清楚限定。

### 授权真正改变的是什么

授权的本质是：

- 把原本不能直接执行的高风险请求
- 变成一次被用户明确确认过的可执行请求

也就是说，授权改变的是：

- **是否允许当前请求落地执行**
- **是否允许在当前会话内复用同类权限规则**（如果实现了 session 级授权）

### 授权不会改变的是什么

即使用户授权，也不应让系统失去这些基本约束：

1. **仍然要保留路径分类结果**
   - 外部路径不会因为授权就被伪装成 workspace 路径
2. **仍然要保留风险标签**
   - destructive 就是 destructive，不能因为用户点了允许而降级成普通操作
3. **仍然要保留可审计信息**
   - 至少要知道：请求了什么、用户如何决定、最终是否执行
4. **仍然可以对极高风险操作保持更高门槛或拒绝**
   - 授权不是无限放权

### 为什么这点很重要

如果不强调这个边界，系统很容易退化成另一种形式的“BypassPermissions”：

- 表面上多了一个弹窗
- 实际上只要点一次允许，后面就缺少分类、缺少约束、缺少审计

这不是我们要的模型。

我们要的是：

> **授权是对具体高风险请求的受控放行，而不是把系统重新切回无条件信任。**

---

## 10. MVP 范围

本轮 MVP 只做最关键的止血闭环，不追求一次到位。

### 10.1 MVP 的目标

MVP 不是要把所有命令理解到极致，而是先保证以下事情成立：

1. 高风险工具调用不再静默执行
2. 用户真的能看到并决定关键权限请求
3. 用户拒绝后，执行会被可靠中止
4. 用户允许后，执行可以按预期继续

换句话说，MVP 首先解决的是：

> **“先把执行前授权这条链路做真。”**

### 10.2 纳入 MVP 的内容

1. 去掉 `BypassPermissions`
2. 实现 `TweetPilotPermissionHandler`
3. 文件读写先接入权限流
4. BashTool 先接入最小命令风控
5. 前端增加最小授权弹窗
6. 支持 `allow once / deny`
7. 支持最基础的会话级允许（可选增强）

### 10.3 不纳入 MVP 的内容

- 完整 shell AST 解析
- 工作区持久化权限规则
- 自定义 BashTool 全量替换 claurst BashTool
- 复杂命令学习系统
- 多窗口复杂权限编排
- 审计日志可视化界面

### 10.4 为什么要这样切分

如果第一阶段就试图同时解决：

- 精细命令解析
- 全量持久化规则
- 完整审计系统
- 多窗口复杂状态同步

结果往往会变成：

- 设计很完整
- 但“真正拦住危险操作”这件事迟迟落不了地

所以更合理的推进顺序是：

1. **先建立真实授权闭环**
2. **再提升分类精度**
3. **最后再做权限记忆、审计与体验优化**

这也是为什么本文更强调“权限判定逻辑和执行边界”，而不是过早细化大量易过时的工程分工清单。

---

## 11. MVP 成功标准

### 安全标准

1. AI 不能再静默执行高风险命令
2. AI 不能再静默删除文件
3. AI 不能再静默访问外部敏感目录
4. 对外部路径和敏感路径的操作必须明确弹窗
5. 用户拒绝后，工具调用必须中止

### 功能标准

6. 用户允许后，AI 可以继续执行对应文件/命令操作
7. 已授权的外部目录读写可以真正执行
8. 现有 AI 会话、消息流、tool-call 展示机制不被破坏

### 工程标准

9. 改动尽量集中在 AI 权限与工具执行相关模块
10. 第一轮不引入大规模无关重构

---

## 12. 需要修改和新增的代码位置

## 12.1 重点修改文件

### `src-tauri/src/claurst_session.rs`

这是本次方案最核心的入口。

需要做：

- 去掉 `BypassPermissions`
- 接入自定义 permission handler
- 为工具上下文挂接权限状态
- 把文件工具和 BashTool 纳入统一授权流程

### `src-tauri/src/commands/ai.rs`

需要做：

- 增加 pending permission 状态管理
- 增加 `resolve_ai_permission` 命令
- 负责窗口事件分发

### `src/services/ai/tauri.ts`

需要做：

- 监听 `permission-request`
- 暴露 `resolvePermission(...)`
- 传递授权结果

### `src/components/ChatInterface.tsx`

需要做：

- 增加授权弹窗或授权面板
- 展示工具、路径、风险、原因
- 提供 allow once / deny 按钮

## 12.2 建议新增文件

- `src-tauri/src/services/ai_permissions.rs`
- `src-tauri/src/services/command_policy.rs`
- `src-tauri/src/services/path_guard.rs`
- `src/types/ai-permissions.ts`

---

## 13. MVP 实施步骤

## 第一步：去掉 BypassPermissions

### 目标
先停止当前“工具直接裸执行”的状态。

### 改动点
文件：`src-tauri/src/claurst_session.rs`

需要处理：
- `config.permission_mode`
- `ToolContext.permission_mode`
- `permission_handler`

### 预期结果
- 不再默认自动通过所有工具请求
- 权限流程可以被 TweetPilot 接管

---

## 第二步：实现 TweetPilotPermissionHandler

### 目标
让 claurst 权限请求进入 TweetPilot 自己的授权闭环。

### 逻辑
1. 收到工具权限请求
2. 使用 `path_guard` / `command_policy` 做后端风险判断
3. 低风险直接放行
4. 中高风险向前端发 `permission-request`
5. 等待用户选择
6. 将结果返回 claurst

### 关键原则
风险判断在后端完成，前端只负责展示和收集用户决策。

---

## 第三步：先接入文件权限流

### 目标
优先让文件读写受控。

### 建议策略

#### 读取文件
- workspace 内普通文件：可自动允许
- workspace 外文件：提示授权
- 系统敏感路径：高风险授权

#### 写入文件
- 任意路径写入：都不再静默直接执行
- workspace 内普通写入：中风险，可授权
- workspace 外普通写入：中高风险，可授权
- 敏感目录写入：高风险授权

#### 删除文件
- 一律不自动放行
- 必须高风险授权

注意：

- 这里不再做“workspace 外硬阻断”
- 但必须有充分的风险提示与授权流程

---

## 第四步：接入 BashTool 最小风控

### 目标
先拦住最危险的命令，再让可解释命令进入授权流程。

### MVP 规则

#### 自动允许
- `pwd`
- `ls`
- `rg`
- `grep`
- `git status`
- `git diff`
- `git log`

#### 需要授权
- `mkdir`
- `touch`
- `cp`
- `mv`
- `git add`
- 任意带 `>` / `>>` 的命令
- 任意写入型命令
- 任意外部路径操作
- 无法可靠分类的命令

#### 高风险授权或拒绝
- `rm`
- `rm -rf`
- `chmod`
- `chown`
- `git reset --hard`
- `git clean`
- `git checkout -- .`
- `curl ... | sh`
- `sudo`

### 关键原则

MVP 宁可多拦，不可继续全放。

---

## 第五步：前端最小授权 UI

### 目标
把后端权限请求真实展示给用户。

### 最小展示内容
- 工具类型
- 完整动作
- 风险等级
- 路径分类（workspace / external / system_sensitive）
- 原因说明

### 最小按钮
- 允许一次
- 拒绝

### 可选增强
- 本次会话允许

---

## 第六步：把拒绝结果反馈给 AI

### 目标
让 AI 明确区分：
- 命令执行失败
- 用户拒绝授权
- 系统策略拦截

建议返回信息例如：

- `Permission denied by user`
- `Permission denied: destructive command`
- `Permission denied: sensitive path requires approval`

这样 AI 后续更容易：
- 改用更小范围方案
- 先解释并向用户请求许可
- 放弃危险做法

---

## 14. 推荐测试用例

### 文件测试
1. 读取 workspace 内文件 → 自动允许
2. 读取 workspace 外普通文件 → 弹窗
3. 写入 workspace 内文件 → 弹窗或按规则执行
4. 写入 workspace 外普通文件 → 弹窗
5. 写入敏感目录文件 → 高风险弹窗
6. 删除任意文件 → 高风险弹窗
7. 通过 `../` 访问外部路径 → 应被正确识别为外部路径
8. 通过软链接访问外部路径 → 应被正确识别

### 命令测试
1. `pwd` → 自动允许
2. `git status` → 自动允许
3. `mkdir test-dir` → 弹窗
4. `touch /tmp/a.txt` → 弹窗
5. `rm -rf test-dir` → 高风险授权或拒绝
6. `git reset --hard` → 高风险授权或拒绝
7. `echo hi > /tmp/x` → 弹窗
8. `curl xxx | sh` → 高风险授权或拒绝

### 交互测试
1. 用户允许一次 → 工具继续执行
2. 用户拒绝 → 工具中止
3. 用户超时不处理 → 默认拒绝

---

## 15. 与系统提示词的关系

系统提示词仍然有价值，但它的定位必须明确：

### 可以做的
- 告诉 AI 默认不要越权
- 鼓励 AI 优先使用低风险只读工具
- 让 AI 在高风险操作前先向用户解释

### 不能替代的
- 不能替代工具层权限控制
- 不能替代路径判定
- 不能替代用户授权弹窗

因此最终原则应当是：

> **系统提示词只负责行为约束，真正安全边界必须落在工具执行层。**

---

## 16. 推荐实施顺序

为了尽量减少返工，建议按以下顺序推进：

1. **先打通权限事件通路**
   - 后端可发权限请求
   - 前端可回传决策
2. **再去掉 BypassPermissions**
   - 防止工具继续裸执行
3. **先接入文件权限流**
   - 文件路径判断最确定，收益最高
4. **再接入 BashTool 最小风控**
   - 先止血，再逐步增强
5. **最后补会话缓存和工作区持久化规则**
   - 作为第二阶段优化

---

## 17. 最终结论

融合两份文档并结合本轮调整后，最终建议如下：

1. TweetPilot 当前本地工具调用存在明显安全缺口，根因是 `claurst` 权限机制被 `BypassPermissions` 绕过
2. 后续方案不再采用“WorkspaceWrite 模式”作为硬限制
3. 新模型改为：
   - `ReadOnly`
   - `Interactive`
4. 在 `Interactive` 模式下，只要用户明确授权，AI 可以对**任意目录**执行读写、修改、删除、命令调用
5. 但所有高风险操作必须先经过：
   - 路径分类
   - 命令风险判断
   - 前端授权确认
6. MVP 的第一目标不是完美，而是尽快消除“AI 本地命令无条件执行”的现状

这意味着本方案的产品原则已经统一为：

> **不是限制 AI 永远只能操作 workspace，而是要求 AI 对任何高风险本地操作都必须先获得用户授权。**
