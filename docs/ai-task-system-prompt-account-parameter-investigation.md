# AI Task 系统提示词、账号绑定与参数设计开发文档

日期：2026-04-28

## 1. 文档目标

这份文档不再只停留在调查结论，而是把当前 AI task 相关设计整理成一份可以直接进入开发的文档。

本文聚焦四件事：

1. 明确正常 AI session 的系统提示词注入方式。
2. 明确 task AI session 是否已经具备同源的系统提示词注入。
3. 明确 AI task 与账号、账号 persona、任务参数之间的最小可行设计。
4. 把方案收敛成可开发、可验证、不过度设计的实现清单。

本文遵守两个原则：

- **系统提示词注入逻辑保持一致**：不要因为新增 task AI session，就分叉出第二套 system prompt 体系。
- **坚持第一性原理，避免过度设计**：账号信息、persona、参数都作为 user input 结构化装配给 AI，不把它们塞进 system prompt，也不引入当前阶段不必要的复杂抽象。

---

## 2. 开发结论总览

先说最终开发结论。

### 2.1 正常 AI session 已经具备系统提示词注入

是的，正常 AI session 已经有系统提示词注入，而且注入不是在前端拼接，而是在 Rust 后端统一完成。

当前入口在：
- `src-tauri/src/commands/ai.rs`

关键链路：
- `create_new_session_impl(...)`
- `build_session_system_prompt(...)`
- `session_constraints::build_session_constraints(...)`

### 2.2 当前 task AI session 也已经具备同源系统提示词注入

是的，task AI 专有 session 当前也有系统提示词注入。

当前入口在：
- `src-tauri/src/task_ai_executor.rs`

关键链路：
- `execute_task_ai_session(...)`
- `build_task_system_prompt(...)`
- `session_constraints::build_session_constraints(...)`

这说明现在 task AI session 和正常 AI session 在“系统提示词来源”这一层，已经走的是同一套约束构建逻辑。

### 2.3 本次开发不应该修改 system prompt 体系

这次开发最重要的边界是：

- 不修改正常 AI session 的 system prompt 注入逻辑
- 不为 task AI session 单独发明新的 system prompt 来源
- 不把账号信息、persona、参数硬塞进 system prompt

正确做法是：

- system prompt 继续复用现有 `session_constraints`
- 账号信息、persona、参数作为本次 task 执行的 **user input** 进行结构化装配

### 2.4 当前真正缺的是 task AI 的 user input 装配能力

当前 task AI session 虽然支持：
- 任务绑定 `account_id`
- 可选 `use_persona`
- 可填写 `persona_prompt`
- 可保存 `parameters`

但它现在的问题是：

1. task 创建表单里的人格提示词是手输的，不是从账号管理数据自动带入。
2. task AI session 的 prompt 拼接里，目前只拼接：
   - 任务描述
   - 可选 persona prompt
   没有结构化注入账号身份信息。
3. `parameters` 虽然在任务表和前端表单里存在，但当前 AI prompt 组装逻辑并没有使用它。

所以当前的主开发任务，不是重做系统提示词，而是补全 task AI 的输入装配。

---

## 3. 当前代码现状确认

## 3.1 正常 AI session 的系统提示词注入方式

文件：`src-tauri/src/commands/ai.rs`

关键代码路径：

- `create_new_session_impl(working_dir, window_label, state)`
- 里面调用 `build_session_system_prompt(...)`
- `build_session_system_prompt(...)` 内部调用 `session_constraints::build_session_constraints(...)`

关键代码：

```rust
fn build_session_system_prompt(working_dir: &std::path::Path) -> Result<session_constraints::SessionConstraints, String> {
    session_constraints::build_session_constraints(working_dir, None)
}
```

以及：

```rust
let system_prompt_constraints = build_session_system_prompt(std::path::Path::new(&working_dir))?;
let included_sources = system_prompt_constraints.included_sources().to_vec();
let system_prompt = system_prompt_constraints.into_system_prompt();
```

然后在创建 session 时把它写入会话元数据，并传给运行时 session：

```rust
storage.create_session(CreateSessionInput {
    ...
    system_prompt: Some(system_prompt.clone()),
})?;
```

```rust
ClaurstSession::new(
    ...
    Some(system_prompt),
    Vec::new(),
)
```

## 3.2 正常 AI session 的 system prompt 实际来源

文件：`src-tauri/src/services/session_constraints.rs`

当前实现里：

```rust
pub fn build_session_constraints(_working_dir: &Path, _user_message: Option<&str>) -> Result<SessionConstraints, String> {
    let tweetpilot_home = tweetpilot_home_dir()?;
    let skill_path = tweetpilot_home.join("skill.md");
    let skill_content = read_required_file(
        &skill_path,
        "全局约束文档 skill.md 缺失",
    )?;

    Ok(SessionConstraints {
        sections: vec![skill_content],
        included_sources: vec![skill_path.display().to_string()],
    })
}
```

这说明当前系统提示词的核心来源是：

- `~/.tweetpilot/skill.md`

也就是说，正常 AI session 的系统提示词不是随请求临时拼一段字符串，而是统一走：

- 读取全局约束文档
- 组装成 system prompt
- 存入 session 元数据
- 同时传入运行时会话

## 3.3 task AI session 的系统提示词注入方式

文件：`src-tauri/src/task_ai_executor.rs`

当前代码：

```rust
fn build_task_system_prompt(working_dir: &Path) -> Result<String, String> {
    let constraints = session_constraints::build_session_constraints(working_dir, None)?;
    Ok(constraints.into_system_prompt())
}
```

执行 AI task 时：

```rust
let system_prompt = build_task_system_prompt(Path::new(workspace_root))?;
```

然后这份 system prompt 同时被：

1. 存入 task session 表：

```rust
create_task_ai_session(CreateTaskAiSessionInput {
    ...
    system_prompt: Some(system_prompt.clone()),
    ...
})
```

2. 注入 query runtime：

```rust
query_config.system_prompt = Some(system_prompt);
```

## 3.4 当前结论

这说明当前 task AI session 与正常 AI session 在系统提示词层面已经对齐：

- 来源同一套 `session_constraints`
- 都不是前端拼接
- 都会把最终 system prompt 存下来
- 都会把同一份 system prompt 真正传给模型运行时

结论：

- 现在不需要再额外补一套 task 专用 system prompt 注入逻辑。
- 后续应坚持“正常 session 和 task session 共用 `session_constraints`”，不要分叉成两套系统约束来源。

---

## 4. 当前 task AI 与账号 / persona / 参数的真实现状

## 4.1 数据层已有字段

文件：`src-tauri/migrations/001_create_tasks_tables.sql`

`tasks` 表已有字段：

- `account_id TEXT NOT NULL`
- `use_persona INTEGER NOT NULL DEFAULT 0`
- `persona_prompt TEXT`
- `parameters TEXT`

这说明任务本身已经能保存：

- 绑定哪个账号
- 是否启用 persona
- persona 文本
- 自定义参数

## 4.2 前端创建表单已有能力

文件：`src/components/TaskCreatePane.tsx`

当前前端已经支持：

- 选择账号 `accountId`
- 勾选 `usePersona`
- 手工填写 `personaPrompt`
- 编辑 `parameters`

但注意一个关键事实：

当前任务选择账号的下拉数据来源：
- `getManagedAccountsForTaskSelection()`

而这个接口返回的 DTO 是：

文件：`src/services/account/types.ts`

```ts
export interface ManagedAccountForTask {
  twitterId: string
  screenName?: string
  displayName?: string
  avatarUrl?: string
}
```

后端对应：
- `src-tauri/src/task_database.rs::get_managed_accounts_for_task_selection()`

它只返回：
- twitter_id
- screen_name
- display_name
- avatar_url

**不返回 `personality_prompt`。**

这就解释了为什么当前 task create pane 里的人格提示词必须手填，而不是选中账号后自动带出已有 persona。

## 4.3 当前 AI task prompt 组装逻辑

文件：`src-tauri/src/task_ai_executor.rs`

```rust
fn build_task_prompt(task: &Task) -> String {
    let mut sections = Vec::new();

    if let Some(description) = task.description.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        sections.push(description.to_string());
    }

    if task.use_persona {
        if let Some(persona_prompt) = task.persona_prompt.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
            sections.push(format!("\n[Persona Prompt]\n{}", persona_prompt));
        }
    }

    sections.join("\n\n")
}
```

这说明现在 AI task 的最终用户输入只包含：

- 任务描述
- 可选 persona prompt

**没有包含：**
- 结构化账号信息
- account screen name / display name
- 账号运营目标或上下文
- 参数块 `parameters`

所以现在的 task AI session 虽然能运行，但输入装配还比较弱。

---

## 5. 本次开发的设计原则

## 5.1 不动 system prompt 主链路

本次开发不应该做下面这些事：

- 不修改 `session_constraints::build_session_constraints(...)` 的职责
- 不在 task AI 里复制一套新的系统提示词拼接逻辑
- 不把账号信息、persona、parameters 混进 system prompt

原因很简单：

- system prompt 是全局约束
- 账号、persona、任务参数是这一次 task 执行的业务输入
- 这两层语义不同，混在一起会让后续维护越来越乱

## 5.2 坚持最小可行输入模型

不要过度设计。

当前真正需要的不是复杂 prompt DSL，也不是可配置模板引擎，而是把 task 执行已知的稳定上下文，清楚、结构化地作为 user input 传给 AI。

最小可行模型就四层：

1. task 本身的指令
2. 可选账号上下文
3. 可选 persona 文本
4. 可选结构化参数

## 5.3 persona 是任务输入，不是系统规则

persona 的本质是：
- 这次任务希望 AI 采用的角色、语气、风格

所以它应该作为 task 的 user input 出现，而不是作为系统级约束注入。

## 5.4 参数继续保留，但只承担固定输入职责

有了 AI，不代表可以取消参数。

但参数也不该变成第二份 description。

参数的职责应该收敛为：
- 机器可读
- 稳定
- 结构化
- 适合重复执行

例如：
- `topic`
- `tone`
- `language`
- `outputPath`
- `sourceFile`
- `dateRange`
- `maxTweets`

---

## 6. 推荐的目标方案

## 6.1 persona 来源策略

这里必须先定清楚，否则后面会乱。

建议 persona 来源优先级如下：

### 情况 A，未绑定账号
- `account_id` 为空
- 强制 `use_persona = false`
- 不注入 persona

### 情况 B，绑定账号，但未勾选 use persona
- 注入账号基本信息
- 不注入 persona

### 情况 C，绑定账号，并勾选 use persona
采用 **任务快照优先** 策略：

- task 表里的 `persona_prompt` 视为“任务执行时使用的人格快照”
- 创建或编辑任务时，如果用户选择“使用账号人格”，默认把账号当前 `personality_prompt` 带入表单
- 用户可以继续在任务里修改
- 任务执行时，使用 task 自己保存的 `persona_prompt`

推荐这个方案的原因：

- 任务行为稳定
- 账号后来改了人格，不会悄悄影响旧任务
- 历史执行结果可复盘
- 实现简单，不需要每次执行都引入覆盖逻辑

## 6.2 账号信息与 task AI session 的关联方式

账号关联不能只停留在 task 表的 `account_id` 字段上。

执行 AI task 时，应该根据 `account_id` 额外读取账号上下文，并把它装配进这次 task AI session 的 user input。

最小建议字段：

- `twitter_id`
- `screen_name`
- `display_name`
- `description`
- `is_verified`

如果当前代码里容易拿到，也可以补充：

- `latest_snapshot_at`

但这里不要为了“完整”而过度扩张字段范围。先满足 AI 能知道“这个账号是谁”就够了。

## 6.3 参数在 AI 模式下的定位

AI 模式下保留 `parameters`，并定义为：

**本次任务的稳定结构化输入。**

适合放进 parameters 的内容：
- topic
- language
- tone
- targetAudience
- outputPath
- sourceFile
- dateRange
- maxTweets

不适合放进 parameters 的内容：
- 大段任务主说明
- 复杂执行步骤全文
- 长篇 persona 文本

分层原则：
- 主任务目标，用 `description`
- 账号人格，用 `persona_prompt`
- 稳定结构化输入，用 `parameters`

---

## 7. 推荐的 task AI user input 装配方案

## 7.1 输入结构

建议把当前 `build_task_prompt(task)` 升级成一个最小的结构化输入组装器。

推荐最终由以下几个区块构成：

1. `Task Context`
2. `Bound Account`，可选
3. `Persona Prompt`，可选
4. `Task Parameters`，可选
5. `Task Instruction`

## 7.2 装配规则

### Task Context
始终注入：
- task id
- task name
- task type
- execution mode
- run no，如果拿得到

### Bound Account
仅当 `account_id` 非空时注入：
- twitter id
- screen name
- display name
- bio / description
- verified
- latest snapshot time，可选

### Persona Prompt
仅当同时满足下面条件时注入：
- `account_id` 非空
- `use_persona == true`
- `persona_prompt` 非空

### Task Parameters
仅当 `parameters` 非空时注入，建议序列化成 JSON 块。

### Task Instruction
最后注入 `task.description`。

## 7.3 推荐示例

```text
[Task Context]
Task ID: task-123
Task Name: 每日早报总结
Task Type: scheduled
Execution Mode: ai_session
Run No: 18

[Bound Account]
Twitter ID: 123456
Screen Name: example
Display Name: Example Account
Bio: focused on AI tooling and builder workflows
Verified: true

[Persona Prompt]
你是一位长期运营 AI 创业内容的账号主理人，表达清晰，克制，不说空话。

[Task Parameters]
{
  "topic": "AI",
  "tone": "professional",
  "language": "zh-CN"
}

[Task Instruction]
请基于今天的行业动态，为该账号生成一条适合发布的中文推文，并给出一句不超过 20 字的配文标题。
```

## 7.4 为什么这样已经足够

这样设计的好处是：

- 不改动 system prompt 主链路
- AI 能明确区分全局约束和本次任务输入
- 前后端实现都比较直接
- 人工回看执行记录时也更容易理解

这已经足够支撑当前阶段开发，不需要继续引入更复杂的 prompt 模板系统。

---

## 8. 需要落地的最小开发改动

这一节只写当前开发真正需要做的事。

## 8.1 前端：任务创建表单补齐 persona 默认值体验

目标：
- 用户选中账号后，如果该账号已有默认 `personality_prompt`，任务表单可以自动带出
- 但用户仍然可以手动修改，最终保存为 task 自己的快照

最小改动建议：

1. 扩展任务账号选择 DTO
   - 文件：`src/services/account/types.ts`
   - 给 `ManagedAccountForTask` 增加可选 `personalityPrompt?: string`

2. 后端任务账号选择接口返回默认 persona
   - 文件：`src-tauri/src/task_database.rs`
   - 文件：`src-tauri/src/commands/account.rs`
   - 在 `get_managed_accounts_for_task_selection()` 返回值中补出 `personality_prompt`

3. `TaskCreatePane.tsx` 调整默认带入逻辑
   - 当用户选择账号并启用 `usePersona` 时，如果当前 `personaPrompt` 为空，则自动填入账号默认 persona
   - 如果用户后续手工修改过，就不要在每次切账号或重渲染时粗暴覆盖

注意：
- 这里不要做复杂的“多来源同步状态机”
- 只需要满足“首次带入默认值，之后允许用户覆盖”

## 8.2 后端：执行 AI task 时读取账号上下文

目标：
- task 执行时，不只是拿到 `account_id`
- 而是能拿到这次 prompt 需要的最小账号信息

最小改动建议：

1. 在 task 执行链路里，根据 `task.account_id` 查询账号上下文
2. 返回一个最小结构体，例如：
   - `twitter_id`
   - `screen_name`
   - `display_name`
   - `description`
   - `is_verified`
   - `latest_snapshot_at` 可选

注意：
- 只查 AI prompt 当前需要的字段
- 不为了“以后可能有用”把整个账号对象都塞进来

## 8.3 后端：升级 `build_task_prompt(...)`

目标：
- 保持 system prompt 逻辑不变
- 只升级 task 的 user input 装配逻辑

最小改动建议：

1. 把 `build_task_prompt(task)` 改成接受更多上下文，例如：
   - `task`
   - `run_no` 或 execution 信息
   - 可选账号上下文

2. 输出结构化文本块，至少包含：
   - `Task Context`
   - `Bound Account`，可选
   - `Persona Prompt`，可选
   - `Task Parameters`，可选
   - `Task Instruction`

3. 保持规则简单：
   - 有就注入
   - 没有就跳过
   - 不做复杂模板分支

## 8.4 后端：把 `parameters` 正式纳入 AI 输入

目标：
- `parameters` 不再只是数据库里的静态字段
- 而是成为 task AI 执行时真实可见的结构化输入

最小改动建议：

1. 在 prompt 组装阶段检查 `task.parameters`
2. 如果非空，则格式化为 JSON 文本块注入 `Task Parameters`
3. 如果为空，则完全跳过该区块

注意：
- 不需要先做复杂 schema 校验系统
- 当前阶段只要保证序列化稳定、展示清楚即可

---

## 9. 建议的开发顺序

为了避免改动扩散，建议按下面顺序做。

### 第一步：补齐账号选择 DTO
- 让任务创建表单能拿到默认 `personality_prompt`

### 第二步：完善 `TaskCreatePane` 的 persona 默认带入逻辑
- 形成“账号默认值 -> 任务快照”的前端交互链路

### 第三步：在 task AI 执行链路里补充账号上下文查询
- 为 prompt 装配准备数据

### 第四步：升级 `build_task_prompt(...)`
- 先接入账号上下文
- 再接入 parameters
- 保持结构简单清晰

### 第五步：联调验证
- 验证 system prompt 逻辑未被破坏
- 验证 user input 已按结构化方式注入
- 验证 persona 快照策略符合预期

---

## 10. 验收标准

开发完成后，至少应满足下面这些可验证结果。

## 10.1 system prompt 一致性

- 正常 AI session 的 system prompt 注入逻辑不变
- task AI session 继续复用 `session_constraints::build_session_constraints(...)`
- 没有新增 task 专用 system prompt 构建体系

## 10.2 账号与 persona 行为正确

- 任务未绑定账号时，不注入账号信息，不注入 persona
- 任务绑定账号但未勾选 `usePersona` 时，只注入账号信息
- 任务绑定账号且勾选 `usePersona` 时，注入 task 上保存的 `persona_prompt`
- 账号默认 persona 只用于创建 / 编辑任务时的默认带入，不在执行时反向覆盖 task 快照

## 10.3 参数行为正确

- `parameters` 在 AI 模式下会进入最终 prompt
- `parameters` 为空时，不输出空区块
- 参数内容以结构化文本呈现，而不是混入 description

## 10.4 prompt 结构可读

最终 task AI user input 至少具备明确区块边界：
- Task Context
- Bound Account（可选）
- Persona Prompt（可选）
- Task Parameters（可选）
- Task Instruction

## 10.5 不引入过度设计

- 没有新增第二套 system prompt 机制
- 没有新增复杂模板系统
- 没有把账号 / persona / 参数混入系统级约束
- 没有为了未来扩展引入当前用不上的抽象层

---

## 11. 最终开发结论

### 已确认的事实

1. 正常 AI session 已经具备系统提示词注入。
2. task AI 专有 session 当前也已经具备同源的系统提示词注入。
3. 两者都基于 `session_constraints::build_session_constraints(...)` 构建系统提示词。
4. 当前 task AI 的主要短板不在 system prompt，而在“任务 user input 装配不足”。

### 当前最关键的开发缺口

1. 账号选择接口不返回账号默认 persona，导致任务表单无法自动继承默认人格。
2. AI task prompt 当前没有结构化注入账号信息。
3. AI task prompt 当前没有使用 `parameters`。
4. persona 还没有形成清楚的“账号默认值 -> 任务快照 -> 执行使用快照”闭环。

### 推荐主方案

- system prompt 继续复用现有统一注入逻辑
- 账号信息、persona、参数都作为 **user input** 注入
- persona 采用“任务快照优先”
- 执行 AI task 时结构化注入账号上下文
- 保留参数，并把参数作为 AI 输入的一部分明确注入
- 把 `build_task_prompt(task)` 升级成最小的结构化输入装配器

这就是当前阶段最合适的开发方案。
