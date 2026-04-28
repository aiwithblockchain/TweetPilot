# 任务卡：Phase A 本地工具授权底座实现

## 1. 任务目标

本任务卡用于指导另一位 AI/开发者完成 TweetPilot **第一阶段（Phase A）本地工具授权底座** 的实现。

本阶段目标非常明确：

> **先建立通用授权底座，并只保护普通聊天 AI session；不处理 scheduled task 的 preauthorized/trusted automation 落地。**

也就是说，这次修改的重点不是“把整个权限系统一次性做完”，而是：

1. 去掉当前 `claurst` 的全局裸放行 (`BypassPermissions`)
2. 建立统一的后端风险判断模型
3. 为普通聊天 session 打通最小授权请求闭环
4. 前端提供最小授权确认 UI

---

## 2. 严格范围约束

### 2.1 本任务**必须完成**的内容

- 建立通用权限模型
- 建立路径风险判断模块
- 建立命令风险判断模块
- 让 `claurst` 的工具调用先进入统一策略判断
- 为普通聊天 session 打通：
  - `permission-request`
  - `resolve_ai_permission(...)`
- 前端最小支持：
  - allow once
  - deny

### 2.2 本任务**明确不要做**的内容

以下内容属于后续阶段，**本任务禁止顺手实现**：

- scheduled task 的 `PreAuthorized` 落地
- task 表新增 `session_auth_policy` / `preauthorized_scope`
- task runtime 注入授权策略
- task 配置页 trusted automation UI
- task execution history 的授权审计展示
- session 级长期授权记忆
- workspace 级持久授权规则
- 完整 shell AST 解析
- 为了“更优雅”去大改现有 task 系统

### 2.3 设计原则

- 只做最小可用闭环
- 风险判断必须发生在执行前
- 无法可靠判断时，走保守分支
- 授权是受控放行，不是恢复另一种形式的 `BypassPermissions`
- 当前阶段只支持普通聊天 session

---

## 3. 必须阅读的现有文档

开始编码前，先阅读并遵守以下文档：

1. `docs/local-command-authorization-mechanism.md`
   - 这是本地工具授权的总设计文档
   - 本任务必须与文档中的风险模型和决策链路保持一致

2. `docs/ai-scheduled-task-session-refactor-brief.md`
   - 这里已经明确：scheduled task session 后续可能支持不同授权策略
   - 但本任务**不要**把这部分做进实现
   - 只需要保证当前代码结构未来能兼容 `InteractiveApproval / PreAuthorized`

---

## 4. 需要重点参考的当前代码

### 后端核心入口
- `src-tauri/src/claurst_session.rs`
- `src-tauri/src/commands/ai.rs`
- `src-tauri/src/main.rs`

### 服务模块
- `src-tauri/src/services/mod.rs`

### 前端 AI bridge / UI
- `src/services/ai/tauri.ts`
- `src/components/ChatInterface.tsx`

### 当前风险背景
已知当前代码存在类似以下问题（请在实际代码中确认具体位置）：

- `config.permission_mode = PermissionMode::BypassPermissions`
- `ToolContext.permission_mode = PermissionMode::BypassPermissions`
- `permission_handler = AutoPermissionHandler(BypassPermissions)`
- `pending_permissions = None`
- `permission_manager = None`

本任务的核心就是结束这种“工具调用直接裸执行”的现状。

---

## 5. 本次允许修改 / 新增的文件范围

### 5.1 允许修改的现有文件
- `src-tauri/src/claurst_session.rs`
- `src-tauri/src/commands/ai.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/services/mod.rs`
- `src/services/ai/tauri.ts`
- `src/components/ChatInterface.tsx`

### 5.2 允许新增的文件
- `src-tauri/src/services/ai_permissions.rs`
- `src-tauri/src/services/path_guard.rs`
- `src-tauri/src/services/command_policy.rs`

### 5.3 本任务尽量不要碰的文件
- `src-tauri/src/task_database.rs`
- `src-tauri/src/task_commands.rs`
- `src-tauri/src/task_executor.rs`
- `src-tauri/src/unified_timer/...`
- task 配置页及 task 详情相关前端

如果你认为必须修改这些文件，请先停下并说明理由，而不是直接扩散改动范围。

---

## 6. 具体任务拆分

---

## 任务 A：建立通用权限模型

### 文件
- `src-tauri/src/services/ai_permissions.rs`

### 必做内容
定义最小可用的数据结构，至少包括：

#### 1. Session 授权策略枚举
```rust
pub enum SessionAuthorizationPolicy {
    InteractiveApproval,
    PreAuthorized,
    LockedDown,
}
```

说明：
- 当前阶段只会真正使用 `InteractiveApproval`
- `PreAuthorized` / `LockedDown` 先保留结构位，供未来兼容
- 不要在本任务里把 scheduled task 的逻辑接进来

#### 2. 权限决策相关枚举
建议至少有：

```rust
pub enum PolicyDecision {
    Allow,
    Ask,
    Deny,
}

pub enum PermissionDecision {
    AllowOnce,
    Deny,
}
```

#### 3. 待授权请求结构
至少包含：
- `permission_id`
- `request_id`
- `tool`
- `action`
- `scope`
- `reason`
- `risk`
- `paths`
- `path_class`
- `created_at`

可以命名为：
```rust
pub struct PendingPermissionRequest { ... }
```

### 完成标准
- 这些结构可以被 `claurst_session.rs` 和 `commands/ai.rs` 直接引用
- 没有混入 task 专属字段
- 没有加入超出本阶段的缓存或持久化抽象

---

## 任务 B：建立路径风险判断模块

### 文件
- `src-tauri/src/services/path_guard.rs`

### 必做内容
实现最小路径分类能力。

#### 1. 定义路径分类枚举
```rust
pub enum PathAccessClass {
    Workspace,
    External,
    SystemSensitive,
    SymlinkEscape,
    Unknown,
}
```

#### 2. 提供最小分类函数
建议接口：
```rust
pub fn classify_path_access(workspace_root: &Path, target: &Path) -> Result<PathAccessClass, String>
```

#### 3. 第一阶段至少覆盖以下场景
- workspace 内路径
- workspace 外路径
- 系统敏感路径
- `../` 相对路径逃逸
- 无法可靠判断时返回更保守的结果

#### 4. 建议识别的敏感路径示例
- `~/.ssh/`
- `~/.aws/`
- `~/.config/`
- `~/Library/`
- `/etc/`
- `/usr/`
- `/System/`

### 不要做的事
- 不要写非常复杂的软链接图遍历系统
- 不要为了“完美分类”把改动扩得太大
- 只要保证：**分类不明时不静默信任**

### 完成标准
- 给定 `workspace_root` 和 `target`，能返回稳定分类
- 工作区外路径不会被误判为工作区内路径
- 敏感路径能被正确标高风险

---

## 任务 C：建立命令风险判断模块

### 文件
- `src-tauri/src/services/command_policy.rs`

### 必做内容
#### 1. 定义命令风险枚举
```rust
pub enum CommandRiskLevel {
    ReadOnly,
    Write,
    Destructive,
    Network,
    Unknown,
}
```

#### 2. 定义评估结果
```rust
pub struct CommandAssessment {
    pub risk: CommandRiskLevel,
    pub reasons: Vec<String>,
    pub touched_paths: Vec<PathBuf>,
}
```

#### 3. 提供最小评估函数
建议接口：
```rust
pub fn assess_command(command: &str) -> CommandAssessment
```

#### 4. 第一阶段最少覆盖这些规则

##### 可自动允许
- `pwd`
- `ls`
- `rg`
- `grep`
- `git status`
- `git diff`
- `git log`

##### 需要授权
- `mkdir`
- `touch`
- `cp`
- `mv`
- `git add`
- 含 `>` / `>>`
- 无法可靠分类但可能有副作用的命令

##### 高风险
- `rm`
- `rm -rf`
- `sudo`
- `chmod`
- `chown`
- `git reset --hard`
- `git clean`
- `curl ... | sh`

### 不要做的事
- 不要写 shell AST
- 不要追求 100% 命令理解
- 无法分类时应走保守分支

### 完成标准
- 任意命令至少能得到一个风险等级
- 高风险命令不会再落回默认自动放行
- `reasons` 能为 UI 提供可读说明

---

## 任务 D：注册新的 service 模块

### 文件
- `src-tauri/src/services/mod.rs`

### 必做内容
把新增模块接入导出：
- `ai_permissions`
- `path_guard`
- `command_policy`

### 完成标准
- 其他后端文件可以正常导入并使用这些模块

---

## 任务 E：改造 `claurst_session.rs` 权限入口

### 文件
- `src-tauri/src/claurst_session.rs`

### 必做内容
#### 1. 移除对全局 `BypassPermissions` 的硬依赖
重点确认并改造：
- `config.permission_mode`
- `ToolContext.permission_mode`
- `permission_handler`
- 相关 pending permission / manager 挂点

#### 2. 接入 TweetPilot 自定义权限处理链路
要求：
- 工具调用先进入后端策略判断
- 结果只允许三种分支：
  - `Allow`
  - `Ask`
  - `Deny`

#### 3. 第一阶段至少接管以下工具类型
- 文件读取
- 文件写入/编辑
- BashTool

#### 4. 当前阶段要保留的行为
- 明显低风险只读操作可以自动 allow
- 中高风险进入 ask
- 极高风险或明确危险操作进入 deny 或高风险 ask（按你实际接入方式决定，但不能静默执行）

### 重要约束
- 先不要把 task session policy 做进这里
- 结构上要为未来保留兼容性，但实现上只支持普通聊天 session

### 完成标准
- 工具调用不再裸执行
- 已形成 allow / ask / deny 统一分支
- 策略判断真正发生在执行前

---

## 任务 F：在 `commands/ai.rs` 建立待授权请求通路

### 文件
- `src-tauri/src/commands/ai.rs`

### 必做内容
#### 1. 为 AI runtime 增加最小 pending permission 状态管理
要求：
- 只支持当前普通聊天 session 使用
- 能存放一次正在等待确认的权限请求
- 不要求本阶段做复杂多窗口权限编排

#### 2. 增加 Tauri 命令
建议新增：
```rust
resolve_ai_permission(permission_id, decision)
```

其中 `decision` 第一阶段只支持：
- `allow_once`
- `deny`

#### 3. 增加事件发送能力
建议事件名：
- `permission-request`

请求载荷最少应包含：
```json
{
  "request_id": "...",
  "permission_id": "...",
  "tool": "bash",
  "action": "rm -rf ./build",
  "scope": "command.destructive",
  "reason": "命令将删除目录内容",
  "risk": "high",
  "paths": ["/abs/path/build"],
  "path_class": "workspace"
}
```

#### 4. 用户决策返回后，要能回到工具执行等待侧
也就是说：
- allow once → 工具继续执行
- deny → 工具中止执行

### 不要做的事
- 不要实现 `allow_session`
- 不要实现 `allow_workspace`
- 不要接 task session 的授权状态

### 完成标准
- 后端能真正发出一次权限请求
- 前端可以回传 allow/deny
- 最终能决定工具继续执行还是中止

---

## 任务 G：在 `main.rs` 注册新命令

### 文件
- `src-tauri/src/main.rs`

### 必做内容
把 `ai::resolve_ai_permission` 注册到 `invoke_handler`。

### 完成标准
- 前端可以正常调用该命令

---

## 任务 H：扩展前端 AI bridge

### 文件
- `src/services/ai/tauri.ts`

### 必做内容
#### 1. 增加权限请求监听
建议新增：
- `onPermissionRequest(...)`

#### 2. 增加权限决策调用
建议新增：
- `resolvePermission(...)`

#### 3. 增加最小 TS 类型
至少包含：
- Permission request payload
- Permission decision type (`allow_once` / `deny`)

### 完成标准
- `ChatInterface.tsx` 能直接监听权限请求
- 前端能把用户选择回传给后端

---

## 任务 I：给 `ChatInterface.tsx` 增加最小授权 UI

### 文件
- `src/components/ChatInterface.tsx`

### 必做内容
#### 1. 监听 `permission-request`
收到后保存当前待确认请求。

#### 2. 展示最小授权弹层或面板
至少展示：
- tool
- action
- risk
- paths
- path_class
- reason

#### 3. 提供两个操作按钮
- 允许一次
- 拒绝

#### 4. 把用户决策回传后端
- 点击允许一次 → `allow_once`
- 点击拒绝 → `deny`

### 不要做的事
- 不要重构整个聊天 UI
- 不要做 session 级记忆授权
- 不要做 task trusted automation 配置入口
- 不要做复杂审计页

### 完成标准
- 普通聊天中的中高风险工具调用会真正停下来等待用户决策
- 用户允许后继续执行
- 用户拒绝后中止执行

---

## 7. 推荐实施顺序

严格按下面顺序推进，避免先做 UI 后补后端导致返工：

1. `src-tauri/src/services/ai_permissions.rs`
2. `src-tauri/src/services/path_guard.rs`
3. `src-tauri/src/services/command_policy.rs`
4. `src-tauri/src/services/mod.rs`
5. `src-tauri/src/claurst_session.rs`
6. `src-tauri/src/commands/ai.rs`
7. `src-tauri/src/main.rs`
8. `src/services/ai/tauri.ts`
9. `src/components/ChatInterface.tsx`

---

## 8. 验收标准

只以以下结果判断本任务是否完成：

### 8.1 安全侧
- AI 不能再静默执行高风险本地工具调用
- 文件类 / BashTool 请求在执行前进入统一策略判断
- 无法可靠判断的请求不会默认放行

### 8.2 功能侧
- 普通聊天 session 中高风险请求会触发授权 UI
- 用户允许一次后，请求继续执行
- 用户拒绝后，请求可靠中止
- 低风险只读操作仍可自动执行

### 8.3 范围侧
- 没有把 scheduled task 的 `PreAuthorized` 提前做进实现
- 没有大改 task 系统
- 没有引入复杂长期授权记忆

---

## 9. 建议联调测试用例

### 文件测试
1. 读取 workspace 内文件 → 自动允许
2. 读取 workspace 外普通文件 → ask 或 deny
3. 写入 workspace 内文件 → ask
4. 写入 workspace 外普通文件 → ask
5. 删除文件 → 高风险处理
6. 通过 `../` 访问外部路径 → 应识别为 external

### 命令测试
1. `pwd` → 自动允许
2. `git status` → 自动允许
3. `mkdir test-dir` → ask
4. `touch /tmp/a.txt` → ask
5. `rm -rf test-dir` → 高风险，不可静默执行
6. `git reset --hard` → 高风险，不可静默执行
7. `echo hi > /tmp/x` → ask
8. `curl xxx | sh` → deny 或高风险 ask，但不能静默执行

### 交互测试
1. 用户 allow once → 工具继续执行
2. 用户 deny → 工具中止
3. 前端未处理权限请求时 → 不应默默放行

---

## 10. 提交要求

完成后，输出内容应至少包括：

1. 修改了哪些文件
2. 新增了哪些结构
3. 当前 Phase A 已实现到什么程度
4. 哪些内容故意没做（尤其是 task / preauthorized 相关）
5. 如果有无法确认的 `claurst` 接口行为，要明确列出，而不是猜测

---

## 11. 一句话总结

这张任务卡的核心要求只有一句话：

> **先把普通聊天 AI 的本地工具调用从“全局裸放行”改造成“执行前统一风控 + 最小用户授权闭环”，不要提前做 scheduled task 的 trusted automation。**
