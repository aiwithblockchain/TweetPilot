# 实现卡：Task-AI 授权模式落地方案

## 1. 目标

本实现卡用于指导另一位 AI / 开发者，把 Task-AI 的三档授权模式设计落实到工程结构中。

本卡基于以下已经确定的产品决策：

- `docs/task/task-ai-full-access-decision.md`
- `docs/ai-scheduled-task-session-refactor-brief.md`
- `docs/local-command-authorization-mechanism.md`

当前目标不是立即完成全部实现，而是明确：

1. Task-AI 三档授权模式在工程上的映射方式
2. 需要增加哪些配置字段
3. runtime 执行时如何做决策
4. 什么行为必须保留统一权限框架，不能偷懒退化成 `BypassPermissions`

---

## 2. 已确认的三档模式

Task-AI 最终建议支持以下三档：

### 模式 1：系统自定义
建议标识：
- `system_default`

含义：
- 按系统默认策略运行
- 那些被系统全局视为低风险、可自动执行的操作自动放行
- 那些被系统判定为需要授权的操作，在无人值守 task 场景下直接阻止本次任务执行
- 不因为 task 在后台运行，就隐式放大权限

### 模式 2：工作目录完全授权
建议标识：
- `workspace_full_access`

含义：
- 当前工作区内的大多数读写删改自动执行
- 工作区外路径默认不自动放行
- 仍然保留系统底线（例如 `sudo` / `curl | sh` 等）

### 模式 3：完全授权 AI（Full Access）
建议标识：
- `full_access`

含义：
- 绝大多数目录和命令操作自动执行
- 不再局限于工作区
- 但仍然走统一权限框架
- 仍然保留极少数系统底线与审计

---

## 3. 关键原则

### 3.1 Full Access 不等于 BypassPermissions
开发时必须始终遵守：

> **Task-AI 的高权限模式必须是“宽松预授权策略”，而不是重新打开 `BypassPermissions`。**

不能采用以下偷懒实现：
- 检测到 `full_access` 后直接跳过权限框架
- 不做路径分类
- 不做命令风险分类
- 不记审计
- 让一个 task 的高权限外溢到其他 task / chat session

### 3.2 后台 task 超出授权范围时的处理
Task-AI 是后台无人值守场景，不适合弹实时授权框。

因此建议固定语义：

- 命中允许范围 → 自动执行
- 超出允许范围 → 本次任务失败
- 命中系统底线 → 本次任务失败或直接拒绝

不要采用：
- 卡住等待用户确认
- 悄悄降级执行
- 因为没有人确认就偷偷放行

### 3.3 授权作用域必须是 task 级
建议原则：

- 当前 task 的授权模式只对当前 task 生效
- 不影响其他 task
- 不影响普通 chat session
- 不影响其他工作区

---

## 4. 建议新增的配置字段

本卡建议把 Task-AI 授权模式作为 task 配置的一部分持久化。

### 4.1 task 表建议新增字段

#### `task_auth_mode`
类型建议：
- `TEXT NOT NULL`

建议值：
- `system_default`
- `workspace_full_access`
- `full_access`

说明：
- 这是 Task-AI 授权模式的主字段
- 建议不要和普通 chat session 的 `session_auth_policy` 混成一个语义层
- `task_auth_mode` 是产品配置字段
- runtime 可再映射到更底层的 `SessionAuthorizationPolicy + scope`

#### `task_auth_scope`
类型建议：
- `TEXT NULL`

说明：
- 用 JSON 文本保存展开后的运行范围
- 第一阶段可以只在内部使用，不一定要求前端完全暴露成高级编辑器
- 即使未来 UI 只暴露三档模式，底层仍建议统一落成可计算的 scope

---

## 5. 三档模式到 runtime 的建议映射

建议不要把前端档位直接散落在代码里判断，而是先做一次“模式 → runtime scope”的转换。

---

## 5.1 system_default 的映射

建议语义：

```json
{
  "allow_file_read_workspace": true,
  "allow_file_write_workspace": false,
  "allow_file_delete_workspace": false,
  "allow_file_read_external": false,
  "allow_file_write_external": false,
  "allow_file_delete_external": false,
  "allow_bash_readonly": true,
  "allow_bash_write": false,
  "allow_bash_destructive": false,
  "allow_network_commands": false
}
```

可理解为：
- 只允许低风险默认行为
- 任何原本需要用户确认的动作，在 task 场景下直接失败

适合：
- 保守自动化
- 测试期
- 默认模式

---

## 5.2 workspace_full_access 的映射

建议语义：

```json
{
  "allow_file_read_workspace": true,
  "allow_file_write_workspace": true,
  "allow_file_delete_workspace": true,
  "allow_file_read_external": false,
  "allow_file_write_external": false,
  "allow_file_delete_external": false,
  "allow_bash_readonly": true,
  "allow_bash_write_workspace": true,
  "allow_bash_destructive_workspace": true,
  "allow_network_commands": false
}
```

注意：
- 即使是 workspace_full_access，也不建议顺手开放 external path
- 系统敏感目录仍不应自动放行
- 极少数底线命令仍需被拦住

---

## 5.3 full_access 的映射

建议语义：

```json
{
  "allow_file_read_workspace": true,
  "allow_file_write_workspace": true,
  "allow_file_delete_workspace": true,
  "allow_file_read_external": true,
  "allow_file_write_external": true,
  "allow_file_delete_external": true,
  "allow_bash_readonly": true,
  "allow_bash_write_workspace": true,
  "allow_bash_destructive_workspace": true,
  "allow_bash_write_external": true,
  "allow_bash_destructive_external": true,
  "allow_network_commands": true
}
```

但必须再叠加一层：

### Full Access 仍然保留底线拒绝列表
例如：
- `sudo`
- `curl ... | sh`
- 对系统敏感目录的大范围递归删除/改写
- 其他不可自动放行的极端操作

也就是说：

> **full_access = very broad allowlist + minimal hard deny list**

而不是：

> **full_access = disable all checks**

---

## 6. 推荐的 runtime 决策流程

建议 Task-AI 执行链路在运行时固定采用如下顺序：

1. 调度器触发 task
2. 创建 task run / task session
3. 读取 task 配置中的 `task_auth_mode`
4. 将 `task_auth_mode` 映射成 runtime scope
5. AI 发起工具调用
6. 后端统一权限框架先做风险分类：
   - 路径分类
   - 命令分类
7. 再根据 task runtime scope 判断：
   - 命中允许范围 → allow
   - 超出范围 → deny / fail task run
8. 再叠加底线规则：
   - 命中 hard deny → deny / fail task run
9. 记录审计信息
10. 继续执行或失败结束

这条链路里，最关键的稳定边界是：

- **先分类，再匹配 scope**
- **先匹配 scope，再叠加 hard deny**
- **永远不要因为 full_access 就跳过整条链路**

---

## 7. 后端需要新增/调整的结构建议

### 7.1 配置层
建议增加一个 Task-AI 授权模式枚举，例如：

```rust
pub enum TaskAuthorizationMode {
    SystemDefault,
    WorkspaceFullAccess,
    FullAccess,
}
```

### 7.2 runtime scope 结构
建议增加一个单独结构，例如：

```rust
pub struct TaskAuthorizationScope {
    pub allow_file_read_workspace: bool,
    pub allow_file_write_workspace: bool,
    pub allow_file_delete_workspace: bool,
    pub allow_file_read_external: bool,
    pub allow_file_write_external: bool,
    pub allow_file_delete_external: bool,
    pub allow_bash_readonly: bool,
    pub allow_bash_write_workspace: bool,
    pub allow_bash_destructive_workspace: bool,
    pub allow_bash_write_external: bool,
    pub allow_bash_destructive_external: bool,
    pub allow_network_commands: bool,
}
```

然后提供一个转换函数：

```rust
pub fn build_task_authorization_scope(mode: TaskAuthorizationMode) -> TaskAuthorizationScope
```

### 7.3 审计结构
至少建议在 task run / task session 侧记录：
- `task_auth_mode`
- 实际命中的 scope 类型
- 被拒绝的请求原因
- 是否命中 hard deny

第一阶段不一定非要做复杂独立审计表，但至少要保证：
- execution history 或 session 内容里可追溯

---

## 8. 前端建议

本卡不要求立即做完整 UI，但建议后续任务配置页至少支持：

- `系统自定义`
- `工作目录完全授权`
- `完全授权 AI`

并配文案说明：

### 系统自定义
- 只自动执行低风险默认操作
- 其他需要授权的动作会导致任务失败

### 工作目录完全授权
- 自动允许工作区内的大多数操作
- 不自动允许工作区外高风险操作

### 完全授权 AI
- 自动允许绝大多数本地操作
- 包括工作区外路径
- 但仍保留少量系统底线和审计

### 重要建议
即使前端文案写“完全授权 AI”，实现文档和代码里仍应坚持使用：
- `full_access`
- `TaskAuthorizationMode::FullAccess`
- broad scope / hard deny 的语义

不要在实现里直接写成：
- `bypass = true`

---

## 9. 现在是否要立刻实现

如果 Task-AI 当前刚开发完，正处于测试阶段，建议：

### 现在先做
- 把这套模式设计定下来
- 把字段、结构、runtime 映射方式规划清楚
- 完成普通 chat 的本地工具授权底座（Phase A）

### 暂缓全面接入
- 不要在 task-ai 测试尚未稳定时，把完整授权模式一口气全塞进去
- 避免把 task 功能问题和授权接入问题混在一起

### 例外情况
如果当前 task-ai 已经可对真实环境执行危险本地操作，且可能开放给真实使用，则需要至少先加一个临时保护闸门或限制发布范围。

---

## 10. 不建议的错误实现方式

开发时需要明确避免以下错误：

1. `full_access` 直接映射成 `BypassPermissions`
2. `workspace_full_access` 直接等于“所有 workspace 内命令都无脑放行”
3. 让一个 task 的授权模式影响其他 task
4. 让 task 的高权限外溢到普通 chat session
5. task 超出 scope 时卡住等待前端授权
6. task 超出 scope 时偷偷降级执行
7. 不记录 task 使用了哪种授权模式

---

## 11. 一句话落地原则

> **Task-AI 的三档授权模式应当先被映射成可计算的 runtime scope，再接入统一权限框架决定 allow/deny；即使是 Full Access，也绝不能退化成 `BypassPermissions`。**
