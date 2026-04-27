# AI 定时任务 Session 重构简要方案

## 1. 背景与目标

基于现有能力，我们准备新增一类专用于“定时任务执行”的 AI Session。

这次工作的重点**不是从零设计一套新的 AI 会话系统**，而是：

- 复用当前已经存在的 AI Session 生命周期
- 复用当前已经存在的 system prompt 注入逻辑
- 复用当前已经存在的会话展示方式
- 在此基础上，为定时任务补上一套**可隔离、可追溯、可清理**的 task session 体系

本次重构的目标：

- 定时触发 AI Session
- 可选附带 task 上的 persona prompt
- 允许任务描述驱动 AI 调用工具执行脚本
- 为每次任务执行保存完整 AI 过程
- 在任务执行记录中保存最终输出结果
- 让任务执行记录能够打开并查看对应 task session 过程

核心原则：

1. **不改动现有 system prompt 注入机制**
2. **任务系统只负责触发、编排、记录，不重造 Session 内核**
3. **任务执行过程与普通 AI Session 隔离存储，但尽量复用现有结构与展示模型**
4. **最终结果只记录 AI 执行完成后的最终输出，但完整过程必须可追溯**

---

## 2. 当前代码事实与设计共识

### 2.1 当前 AI Session 已经是工作区绑定的

根据当前代码，AI Session 不是全局会话，而是通过 `workingDir` 绑定到当前工作区。

已确认的相关代码：

- `src-tauri/src/commands/ai.rs`
- `src/services/ai/tauri.ts`
- `src/components/ChatInterface.tsx`

含义是：

- 创建 session 时必须传入 `workingDir`
- 加载、激活、清空、删除 session 时也都依赖 `workingDir`
- 因此 task session 也应该遵循同样的工作区绑定模型

### 2.2 当前 system prompt 注入逻辑已经存在

根据当前代码，system prompt 的构造与注入已经在现有 session 创建流程中实现。

已确认的相关代码：

- `src-tauri/src/commands/ai.rs`
  - `build_session_system_prompt(...)`
  - `create_new_session(...)`

结论：

- task AI session 必须复用现有 session 创建链路
- 不应额外再发明一套 task 专用 system prompt 管道
- 只要 task session 走现有 session 创建/运行机制，就天然继承已有系统约束

### 2.3 persona prompt

persona prompt 应为**task 表中的一个普通字符串字段**，并且是**可选能力**。

当前阶段只认定：

- task 上可以没有 persona prompt
- task 上也可以直接保存一段 persona prompt 字符串
- 是否使用 persona，由任务配置决定

因此任务侧建议至少支持：

- 不使用 persona
- 使用 task 记录中的 persona prompt 字符串

换句话说，这一层我们只关心“有没有字符串、是否启用”，**不关心具体格式和拼接细节**。

### 2.4 脚本执行方式

本方案认可由用户在任务描述中直接告诉 AI：

- 去哪个目录执行哪个脚本
- 将脚本输出写入哪个目录

因为任务 AI Session 本身具备工具调用能力，所以可以允许 AI 在任务描述约束下完成这类动作。

这一层的边界是：

- 任务系统不直接执行脚本
- 任务系统只负责启动 AI Session
- AI 是否调用工具、如何调用工具，由任务描述和现有工具能力决定
- 任务系统最终只记录 AI 的最终输出与完整执行过程

### 2.5 当前 AI Session 已有可复用的展示模型

根据当前代码，AI Session 的展示不只是简单字符串列表，而是已经具备：

- session 历史加载
- session 面板切换
- assistant message 展示
- thinking / tool calls / timeline 相关持久化字段支持

已确认的相关代码：

- `src/components/ChatInterface.tsx`
- `src/components/ChatInterface/SessionPanel.tsx`
- `src/components/ChatInterface/types.ts`
- `src/services/ai/tauri.ts`
- `src-tauri/src/services/conversation_storage.rs`

因此 task session 在前端展示时，应该优先**复用当前 AI Session 的展示模式**，而不是再发明一套完全不同的查看器。

### 2.6 任务 Session 独立存储

任务 AI Session 需要特别命名、编号，并使用不同于当前普通 AI Session 的数据库表进行存储。

这里的“独立存储”进一步明确为：

- **完全复用现有 Session 的逻辑和消息结构**
- 只是 task session 的消息内容写入**工作区数据库中的独立 task 相关表**
- task session 使用**独立格式的 ID**
- 普通 AI Session 与 task AI Session 在数据层隔离
- 但二者尽量保持相同的数据形态，便于复用加载与展示逻辑

原因：

- 需要通过“任务执行记录”定位某次 AI 执行
- 需要查看该任务执行的完整对话过程
- 需要避免与普通聊天 Session 混淆
- 便于后续做任务审计、失败排查、历史回放
- 便于按工作区清理任务数据，而不影响普通 AI Session

---

## 3. 推荐重构方向

本次建议将能力拆成四层。

### 3.1 任务定义层

存储“任务是什么”。

建议字段示例：

- `id`
- `name`
- `description`
- `schedule_type` / `cron_expr`
- `enabled`
- `use_persona`
- `persona_prompt`
- `created_by`
- `created_at`
- `updated_at`

说明：

- `description` 为用户填写的任务描述
- `persona_prompt` 是 task 表中的普通字符串字段，可为空
- 该描述可以包含“执行哪个脚本、结果写到哪里”等要求
- 任务定义本身不保存 AI 对话，仅保存配置

### 3.2 任务执行层

存储“某次任务何时被触发，结果如何”。

建议在现有任务执行记录表基础上扩展，而不是新增一套完全独立的运行记录体系。

当前代码相关事实：

- `src-tauri/src/task_database.rs` 中已有 `executions` 表写入逻辑
- `save_execution(...)` 会保存执行结果
- `get_execution_history(...)` 从 `executions` 表读取历史
- `src-tauri/src/task_commands.rs` 的 `get_task_detail(...)` / `get_execution_history(...)` 已经使用这套记录

建议字段示例：

- `id`
- `task_id`
- `run_no`（任务内递增编号）
- `session_code`（例如 `tasksess_20260425_0001`）
- `status`（pending / running / success / failed）
- `started_at`
- `finished_at`
- `final_output`
- `error_message`
- `task_session_id`（可为 null）
- `created_at`

说明：

- 每次调度触发就生成一条 run
- `final_output` 仅保存最终输出结果
- `task_session_id` 为可空字段，用于关联任务专用 Session
- 非 AI 型任务可不写入 `task_session_id`
- AI 型任务可通过该字段追溯完整过程
- `session_code` 用于展示与排查

### 3.3 任务专用 Session 层

存储“该次任务 AI 的完整执行过程”。

这里不建议重新设计消息模型，而是：

- **完全复用现有 Session 的消息结构**
- **完全复用现有 Session 的处理逻辑**
- 仅将 task session 的数据落到独立数据库表中
- 并使用独立 ID 规则与任务执行记录关联

建议表方向：

- `task_ai_sessions`
- `task_ai_messages`

关键原则：

- 不复用当前普通 AI Session 的存储表
- 但字段结构与行为尽量与现有 Session 保持一致
- 不新增专门的工具调用日志表
- 工具调用过程继续作为 Session 消息内容的一部分保留
- 前端如要保持展示一致性，应支持 timeline / thinking / tool_calls 等现有字段形态
- 任务失败原因优先通过关联 Session 内容进行展示和排查

建议字段方向：

#### task_ai_sessions
- `id`
- `task_id`
- `task_run_id`
- `session_code`
- `title`
- `source_type`（固定为 `scheduled_task`）
- `working_dir`
- `created_at`
- `updated_at`

#### task_ai_messages
- `id`
- `session_id`
- `role`
- `content`
- `timestamp`
- `thinking`
- `thinking_complete`
- `tool_calls`
- `timeline`
- `status`
- `message_index`
- `created_at`

这里的字段设计应尽量镜像当前普通 AI Session 的持久化结构，例如：

- `StoredMessage`
- `StoredToolCall`
- `SessionMetadata`
- `LoadedSession`

对应代码：

- `src-tauri/src/services/conversation_storage.rs`

这样可以通过任务执行记录直接追溯完整 AI 对话，并且最大化复用现有前端加载/展示逻辑。

### 3.4 调度触发层

调度器只做以下事情：

1. 找到到期任务
2. 创建执行记录
3. 创建一个新的 task AI session
4. 将任务描述送入现有 Session 执行链路
5. 根据任务配置决定是否附带 persona
6. 等待 AI 执行结束
7. 保存最终输出与状态

调度器不负责：

- 自己拼 system prompt
- 自己执行业务脚本
- 自己解释 AI 的工具调用结果

---

## 4. Session 创建与输入组装建议

### 4.1 必须复用现有 Session 创建逻辑

这是本次方案的核心前提。

任务执行时，应通过现有 Session 创建链路启动，以自动继承：

- 系统提示词注入
- 现有工具能力
- 已有安全限制
- 当前统一的模型调用方式
- 当前工作区绑定逻辑

相关代码：

- `src-tauri/src/commands/ai.rs`
  - `create_new_session(...)`
  - `activate_ai_session(...)`
  - `send_ai_message(...)`

结论：

- task session 创建应该遵循当前 `create_new_session(...)` 的整体模式
- task 执行不应自己再造一套独立的 system prompt 组装逻辑
- task session 只是“以任务驱动方式使用现有 session runtime”

### 4.2 任务输入建议

任务侧不需要额外发明复杂协议。

当前约束很简单：

- 基础输入就是用户任务描述
- persona prompt 是 task 表中的一个字符串字段
- 如果启用 persona，就把这个字符串一起交给现有 Session
- 如果未启用 persona，就只发送任务描述

本阶段**不限定 persona 的格式，也不限定具体拼接协议**，只要求：

1. 读取任务描述
2. 判断是否启用 persona
3. 如启用，则读取 `task.persona_prompt`
4. 将 persona 字符串与任务描述一并交给现有 Session

注意：

- persona 是附加上下文
- system prompt 仍由现有 Session 机制负责注入
- 最终输出的判定规则为：**任务执行完成后的最后一条字符串消息**

---

## 5. 命名与编号建议

任务 AI Session 必须具备可识别性。

建议增加专门命名规则，例如：

- Session 标题：`[Task] {task_name} #{run_no}`
- Session 编号：`TASK-SESSION-{date}-{seq}`
- Run 编号：`TASK-RUN-{date}-{seq}`

示例：

- `tasksess_20260425_0007`
- `taskrun_20260425_0012`

这样有几个好处：

- 一眼区分普通聊天与任务执行
- 方便后台检索
- 方便日志与数据库排查

---

## 6. 最小落地范围（MVP）

建议第一阶段只做以下能力：

### 6.1 必做

- 新增定时任务配置
- 支持开启/关闭 persona
- 支持 task 上保存 persona prompt
- 调度触发后创建 task 专用 AI Session
- 复用现有 Session 创建逻辑
- 单独存储 task Session 全量消息
- 在任务执行记录中保存最终输出
- 支持从任务执行记录查看完整 AI 过程
- 任务 AI 过程查看优先复用现有 session 展示方式

### 6.2 暂不扩展

- 不做新的 prompt 编排系统
- 不改普通 AI Session 的既有展示模型
- 不做复杂任务编排
- 不做自动发布后处理
- 不做多阶段结果解析

这样可以先验证：

- task Session 隔离是否合理
- persona 开关是否满足使用场景
- AI 工具调用执行脚本的方式是否足够稳定
- 最终输出与完整过程的双重存储是否满足排查需求
- 现有 session 查看器是否足够复用

---

## 7. 建议的执行流程

建议整体流程如下：

1. 调度器扫描到期任务
2. 解析当前工作区 / `workingDir`
3. 创建执行记录，状态为 `pending`
4. 为本次执行新建一个 task AI session，并生成专属编号
5. 将 task session 元数据持久化到 task 专用表
6. 将执行记录状态更新为 `running`
7. 根据配置决定是否读取 `task.persona_prompt`
8. 通过现有 Session runtime 发起任务 AI Session
9. AI 在 Session 中根据任务描述自主调用工具、执行脚本、写文件
10. 将执行过程中的消息 / tool calls / timeline 等持久化到 task session 表
11. 执行结束后，系统获取最后一条字符串消息作为 `final_output`
12. 将 `task_session_id` 回填到执行记录
13. 将最终输出写入执行记录
14. 成功则更新状态为 `success`，失败则更新状态为 `failed`
15. 前端通过执行记录上的“查看过程”按钮，按 `task_session_id` 打开过程视图

---

## 8. 本次重构的收益

如果按这个方向落地，收益主要有：

- **复用现有 system prompt 注入能力**，避免重复建设
- **复用现有工作区绑定 session 模型**，避免两套会话体系并存
- **复用现有 AI session 展示方式**，减少前端重新设计成本
- **persona 使用更灵活**，适配内容型与非内容型任务
- **任务执行与普通聊天彻底分离**，便于维护
- **每次任务可追踪完整 AI 过程**，便于审计和排查
- **最终输出单独沉淀**，便于后续展示、筛选、复用

---

## 9. 进一步明确后的设计结论

结合当前代码现状，本轮已明确以下结论：

1. **任务专用 Session 完全复用现有 Session 的逻辑和消息结构**，不重新设计消息模型。
2. **普通 AI Session 当前已经是工作区绑定的**，因此 task session 也应以工作区为边界。
3. **system prompt 注入已存在于当前 Session 创建流程**，task session 直接复用。
4. **persona prompt 只是 task 表中的字符串字段**，可为空；是否启用由任务配置决定，不额外约束格式。
5. **最终输出的判定规则**：任务执行结束后的最后一条字符串消息。
6. **不新增单独的工具调用日志表**：执行记录表增加可空的 `task_session_id` 即可，详细过程通过 session 关联查看。
7. **失败处理最小化**：任务失败时只记录失败状态和基本错误信息，具体原因通过关联的 task session 展示。
8. **前端展示方式**：在任务执行记录后增加“查看过程”按钮；当存在 `task_session_id` 时，点击后优先复用现有 AI session 查看器/展示模式打开过程。

### 9.1 任务记录清空逻辑

当前代码里：

- 普通 AI Session 已经支持基于工作区 + session 的清空/删除
- `src-tauri/src/task_database.rs` 中当前 `delete_task(...)` 只删除 `tasks` 表中的任务定义
- `src-tauri/src/task_commands.rs` 中当前 `delete_task(...)` 会注销 timer，但不会级联清理 execution history 与 task session
- 执行记录查询来自工作区任务数据库中的 `executions` 表

因此任务侧需要新增一套**显式级联清理逻辑**。

建议拆成两个动作：

#### A. 清空某个任务的执行记录

当用户执行“清空任务记录”时，应执行：

1. 查询该 task 的全部执行记录
2. 找出其中非空的 `task_session_id`
3. 先删除这些 `task_session_id` 对应的：
   - `task_ai_messages`
   - `task_ai_sessions`
4. 再删除该 task 的全部 execution records

这样可以保证：

- 执行记录被清空时，不会残留孤儿 Session 数据
- 任务定义本身仍然保留
- 清理行为与当前普通 AI session 的删除语义保持一致

#### B. 删除任务

当用户执行“删除任务”时，应执行：

1. 先注销 timer
2. 清空该 task 的全部执行记录
3. 级联删除这些记录关联的 task session 内容
4. 最后删除 `tasks` 表中的任务定义

也就是说，**删除任务 = 删除任务定义 + 删除执行记录 + 删除关联 task session 内容**。

### 9.2 每次执行新建 Session 还是复用旧 Session

结论：**每次任务执行都应新建一个 task AI Session，不复用旧 Session。**

原因如下：

#### 原因 1：执行记录天然是一对一审计单元

如果复用旧 Session，多次执行会混在同一条对话链里：

- 难以区分第几次执行从哪里开始、在哪里结束
- 最终输出定位不稳定
- 失败排查困难

而“一次执行一个 Session”则天然对应：

- 一条执行记录
- 一个 `task_session_id`
- 一段完整过程
- 一个最终输出

#### 原因 2：避免上下文污染

任务是定时执行的，前一次运行结果不应该默认影响下一次运行。

如果复用旧 Session：

- 历史消息会持续累积
- AI 会受到前序运行内容影响
- 长期任务会出现上下文膨胀
- 同一个任务会越来越不可控

而每次新建 Session：

- 本次执行只受本次输入影响
- 结果更稳定
- 更容易复现
- 更容易控制上下文规模

#### 原因 3：更符合“任务运行实例”模型

普通 AI Session 适合连续对话。

但这里的 task 场景本质上是：

- 定时触发
- 一次性执行
- 保存结果
- 查看过程

因此更适合：

- task = 定义
- execution record = 一次运行
- task session = 这次运行的完整过程

#### 原因 4：清理更简单

如果每次执行独立 Session，那么：

- 清空某个 task 的记录时，只需按 execution records 找出所有 session 一并删除
- 删除某次执行记录时，也能只删除那一次对应的 session
- 不会出现多个 run 共享一个 session 导致的误删或残留问题

### 9.3 复用旧 Session 的唯一适用场景

理论上，只有当未来出现这类需求时，才值得考虑复用：

- 任务要求“连续记忆”
- 明确希望本次执行读取上一次 AI 的推理或结论
- 任务本质上是长期 agent，而不是独立 run

但这不是当前这版定时任务系统的目标，因此本期不建议设计成可复用 Session。

---

## 10. 当前代码可直接复用的关键位置

### AI session 后端
- `src-tauri/src/commands/ai.rs`
  - `create_new_session(...)`
  - `activate_ai_session(...)`
  - `clear_ai_session(...)`
  - `delete_ai_session(...)`
  - `load_ai_session(...)`
- `src-tauri/src/services/conversation_storage.rs`
  - `StoredMessage`
  - `StoredToolCall`
  - `SessionMetadata`
  - `LoadedSession`
  - `save_message(...)`
  - `load_session(...)`
  - `delete_session(...)`

### Task 后端
- `src-tauri/src/task_commands.rs`
  - `get_task_detail(...)`
  - `delete_task(...)`
  - `get_execution_history(...)`
- `src-tauri/src/task_database.rs`
  - `save_execution(...)`
  - `get_execution_history(...)`
  - `delete_task(...)`

### AI session 前端展示
- `src/services/ai/tauri.ts`
- `src/components/ChatInterface.tsx`
- `src/components/ChatInterface/SessionPanel.tsx`
- `src/components/ChatInterface/types.ts`

---

## 11. 进入开发前的落地拆分建议

为了避免文档结论进入实现阶段后再次漂移，建议把开发拆成数据库、后端、前端三块，并且都围绕“复用现有 Session 机制，新增 task 专用存储与关联”展开。

### 11.1 数据库改动清单

建议优先处理工作区任务数据库中的结构扩展。

#### A. 扩展 `tasks` 表

如果要让 task 原生支持 AI 型执行，建议至少补充以下字段：

- `description`：继续作为任务描述主输入
- `use_persona`：是否启用 persona
- `persona_prompt`：任务级 persona 字符串
- `task_mode` 或等价字段：用于区分当前任务是否走 AI session 执行链路

说明：

- 当前 `tasks` 表已经有 `description`
- 当前任务模型仍偏向脚本任务（如 `script_path`、`parameters`）
- 本次按开发早期前提处理，直接以新的目标结构重建当前工作区数据库即可，不为旧库兼容单独设计迁移逻辑

#### B. 扩展 `executions` 表

建议在现有 `executions` 表基础上增加任务运行与 task session 关联字段，而不是新建另一套 run history 表。

建议新增字段：

- `run_no`
- `session_code`
- `task_session_id`
- `final_output`
- `error_message`
- 如有必要，可增加 `source_type` 或 `execution_mode`

说明：

- 当前 `ExecutionResult` 仍是脚本执行模型，字段集中在 `stdout` / `stderr` / `exit_code`
- 本期按开发早期前提处理，可直接调整现有 execution 结构，不额外为旧数据库记录设计迁移兼容方案
- `task_session_id` 允许为空，便于兼容非 AI 型任务

#### C. 新增 task session 专用表

建议新增：

- `task_ai_sessions`
- `task_ai_messages`

如前文所述，字段应尽量镜像当前普通 AI Session 的持久化结构，包括：

- session metadata
- message role/content/timestamp
- thinking
- thinking completion state
- tool calls
- persisted timeline items
- status
- message index

如果当前 timeline 已通过独立结构持久化，也可以补充对应 task 版 timeline 表；但原则仍然是**镜像现有 AI session 存储方式**，而不是另造新的任务展示协议。

#### D. 清理相关 SQL 能力

建议同时补齐以下数据库操作：

- 按 `task_id` 查询全部 execution records
- 按 execution records 批量找出 `task_session_id`
- 批量删除 `task_ai_messages`
- 批量删除 `task_ai_sessions`
- 删除指定 task 的全部 execution history

这样后端的“清空记录”“删除任务”才能真正做到级联清理。

### 11.2 后端改动清单

后端建议按“先存储结构，再执行链路，再清理接口”的顺序推进。

#### A. task database 层

重点文件：

- `src-tauri/src/task_database.rs`

建议新增或调整的能力：

1. task 表字段读写扩展
2. execution 记录结构扩展
3. `save_execution(...)` 支持 AI 型执行结果
4. 新增 task session 的 CRUD / 查询接口
5. 新增“按 task 清空 execution + session”的数据库方法
6. 删除任务时支持显式级联清理

这里最关键的是：

- 不要把 task session 混写到普通 AI session 表
- 但 task session 的序列化结构要尽量与 `conversation_storage.rs` 保持一致

#### B. task command 层

重点文件：

- `src-tauri/src/task_commands.rs`

建议新增或调整的命令：

- AI 型任务创建 / 更新时保存 `use_persona`、`persona_prompt` 等字段
- 新增 task execution record 清空命令
- 调整 `delete_task(...)`，改为先清理 execution / task session，再删 task
- 为 execution history 补充“查看过程”所需的 `task_session_id` 返回

如果前端需要直接打开任务过程，还可能需要新增类似：

- `load_task_ai_session(...)`
- `get_task_ai_session_metadata(...)`
- `delete_task_ai_session(...)`（内部主要用于清理，不一定暴露给前端）

#### C. AI 运行时接入层

重点文件：

- `src-tauri/src/commands/ai.rs`
- 以及后续新增的 task-ai orchestration/service 文件

建议做法不是把调度器直接塞进现有聊天命令里，而是抽出一层“复用现有 Session runtime 的任务执行入口”。

这一层至少需要解决：

1. 为任务执行创建新的 task session
2. 复用现有 system prompt 注入
3. 复用现有工具调用能力
4. 将执行过程写入 task session 专用表
5. 在完成后提取最后一条字符串消息作为 `final_output`
6. 回写 execution record 的状态、输出、`task_session_id`

也就是说，调度器只负责触发，真正的 AI 执行仍应走统一 runtime。

#### D. 调度执行层

重点文件：

- `src-tauri/src/task_commands.rs`
- `src-tauri/src/task_executor.rs`
- 当前 timer / executor 注册链路

当前 `execute_task(...)` 明显仍是脚本执行路径。

因此如果要落地 AI 型任务，建议不要把 AI 任务硬塞进现有 `python_script` executor 的概念里，而是：

- 新增 AI task execution path
- 按任务类型或执行模式分流
- 保持原有脚本任务不受影响

这样改动更小，也更容易逐步验证。

### 11.3 前端改动清单

前端重点不是重新设计聊天界面，而是把 task execution record 与现有 session 查看器接起来。

#### A. task 列表 / 详情编辑

重点文件可能包括：

- 任务配置表单相关组件
- `src/services/task/tauri.ts`

建议补充：

- 是否启用 persona 的开关
- `persona_prompt` 输入框
- 任务是否为 AI 型执行的配置项
- 面向 AI 任务的描述输入约束

#### B. execution history 展示

在现有执行记录 UI 上补一个最小入口即可：

- 当 execution record 存在 `task_session_id` 时，显示“查看过程”按钮
- 点击后加载对应 task session
- 没有关联 session 的传统脚本任务仍保持现在的展示方式

这部分要尽量复用现有 execution history 列表，不要新做一套任务历史系统。

#### C. task session 过程查看

重点复用：

- `src/services/ai/tauri.ts`
- `src/components/ChatInterface.tsx`
- `src/components/ChatInterface/SessionPanel.tsx`
- `src/components/ChatInterface/types.ts`

建议复用的不是“普通聊天入口”，而是它背后的数据形态与展示组件能力，例如：

- assistant message 渲染
- thinking 展示
- tool call 展示
- timeline 展示
- 已持久化 session 的加载能力

实现方式可以是：

- 在任务详情页中弹出一个 task session viewer
- viewer 内部复用现有消息渲染组件/转换逻辑
- 只是在数据加载接口上切换到 task session 专用命令

这样既能保持 UI 一致，也不会把任务运行记录混进普通聊天 Session 列表。

### 11.5 MVP 级别的字段 / 接口 / 交互草案

为了让实现阶段不再停留在抽象层，这里给出一版**只覆盖第一阶段落地**的最小草案。

#### A. 数据结构草案（MVP）

##### tasks 表建议最小新增字段

- `use_persona INTEGER NOT NULL DEFAULT 0`
- `persona_prompt TEXT NULL`
- `execution_mode TEXT NOT NULL DEFAULT 'script'`

说明：

- `execution_mode` 第一阶段只需要区分 `script` / `ai_session`
- 不建议一开始引入更多模式枚举
- `persona_prompt` 保持 task 自有字符串，不依赖账号表动态拼装

##### executions 表建议最小新增字段

- `run_no INTEGER NULL`
- `session_code TEXT NULL`
- `task_session_id TEXT NULL`
- `final_output TEXT NULL`
- `error_message TEXT NULL`

说明：

- 现有 `stdout` / `stderr` / `exit_code` 先保留，以便脚本任务与 AI 型任务并存
- AI 型任务可将 `stdout` / `stderr` 留空或按后续实现决定是否复用
- 第一阶段不要试图统一成一套过度抽象的 execution result 结构

##### task_ai_sessions 表建议最小字段

- `id TEXT PRIMARY KEY`
- `task_id TEXT NOT NULL`
- `task_run_id TEXT NOT NULL`
- `session_code TEXT NOT NULL`
- `title TEXT NOT NULL`
- `source_type TEXT NOT NULL`
- `working_dir TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

##### task_ai_messages 表建议最小字段

- `id TEXT PRIMARY KEY`
- `session_id TEXT NOT NULL`
- `role TEXT NOT NULL`
- `content TEXT NOT NULL`
- `timestamp INTEGER NOT NULL`
- `thinking TEXT NULL`
- `thinking_complete INTEGER NULL`
- `tool_calls TEXT NULL`
- `timeline TEXT NULL`
- `status TEXT NULL`
- `message_index INTEGER NOT NULL`
- `created_at TEXT NOT NULL`

说明：

- `tool_calls` / `timeline` 第一阶段可以先按 JSON 文本存
- 重点是字段语义与现有 `StoredMessage` 对齐
- 之后如果普通 session 存储层已有更细的 timeline 表，再决定是否继续镜像拆表

#### B. 后端接口草案（MVP）

##### task database / service 层

建议至少提供：

- `create_task_ai_session(...)`
- `append_task_ai_message(...)`
- `load_task_ai_session(...)`
- `list_task_ai_sessions_by_task(...)`（可选）
- `delete_task_ai_session(...)`
- `delete_task_ai_sessions_by_task(...)`
- `clear_task_execution_history(...)`

这里的 `load_task_ai_session(...)` 返回结构建议尽量贴近现有：

- `LoadedSession`
- `SessionMetadata`
- `StoredMessage[]`

也就是前端最好几乎不用发明第二套 viewer 数据模型。

##### Tauri command 层

建议最小新增命令：

- `clear_task_execution_history(task_id)`
- `load_task_ai_session(task_id, task_session_id)` 或等价接口
- `get_task_ai_session_metadata(task_id, task_session_id)`（如前端需要）

建议调整的现有命令：

- `create_task(...)`
- `update_task(...)`
- `delete_task(...)`
- `get_execution_history(...)`
- `execute_task(...)`

调整目标：

- 让 task 创建/更新能保存 AI 型字段
- 让 execution history 能返回 `task_session_id`
- 让删除逻辑具备级联清理能力
- 让 `execute_task(...)` 能按 `execution_mode` 分流

##### AI task orchestration 层

建议新增一个面向任务执行的内部入口，例如语义上等价于：

- `run_ai_task_session(task, workspace_path)`

它负责：

1. 创建 execution record
2. 创建 task session
3. 组装本次输入（persona 可选 + task description）
4. 复用现有 session runtime 执行
5. 持久化完整消息过程
6. 提取最终输出
7. 更新 execution record

注意这里是**内部复用层**，不是重新暴露一套独立聊天协议。

#### C. 前端交互草案（MVP）

##### 任务配置页

第一阶段只补最小控件：

- 执行模式选择：`脚本任务 / AI 任务`
- 任务描述输入框
- `use_persona` 开关
- `persona_prompt` 多行输入框

交互约束：

- 当 `execution_mode = script` 时，保持现有脚本字段交互
- 当 `execution_mode = ai_session` 时，优先展示 description / persona 配置
- 不要求第一阶段同时做非常复杂的双模式表单重构

##### 执行记录列表

每条 execution record 建议最小展示：

- 执行时间
- 状态
- 最终输出摘要
- 错误摘要
- `查看过程` 按钮（仅当存在 `task_session_id`）

##### 查看过程弹层 / 面板

建议第一阶段直接做一个只读 viewer：

- 标题显示 task 名称 + run_no
- 主体复用现有 assistant / user message 展示能力
- 支持 thinking / tool_calls / timeline
- 不允许在这个 viewer 里继续发送消息
- 不把该 session 注入普通聊天 session 列表

这样既复用了现有 UI，又不会混淆“任务执行回放”和“人工对话”。

#### D. MVP 验收标准

做到以下几点，就可以认为第一阶段落地成功：

1. 可以创建一个 AI 型 scheduled task
2. 任务触发后会生成一条新的 execution record
3. 每次 execution 都会新建一个独立 task AI session
4. task session 会保存完整消息过程
5. execution record 会保存 `final_output`
6. 前端可以从 execution history 打开并查看完整过程
7. 清空任务记录时，会级联删除关联 task session 数据
8. 删除任务时，会注销 timer 并级联删除 execution + task session

---

## 12. 后续进入开发前的验证清单

在这份文档基础上进入开发前，应确认下列描述与代码保持一致：

- [ ] AI sessions are workspace-bound, not global
- [ ] system prompt injection already exists in session creation
- [ ] existing AI session UI supports loading and displaying persisted sessions
- [ ] execution history currently lives in the workspace DB `executions` table
- [ ] current `delete_task(...)` does not yet cascade cleanup task execution/session data
- [ ] current `execute_task(...)` is still script-oriented and needs an AI task execution path
- [ ] task-session display should reuse the existing AI session presentation model
- [ ] each task execution should create a new task session
- [ ] clearing task execution records must also delete linked task session rows/messages

---

## 13. 结论

我认可当前方案，且建议采用以下重构原则：

- **系统提示词继续完全复用现有 Session 创建机制**
- **普通 AI Session 与 task AI Session 都以工作区为边界**
- **persona prompt 改为 task 级可选字符串字段**
- **允许 AI 在任务描述驱动下调用工具执行脚本**
- **task AI Session 使用独立命名、编号、独立表存储完整对话**
- **task 执行记录只关注触发结果与最终输出，但必须可关联完整执行过程**
- **任务过程查看优先复用现有 AI session 的展示方式**
- **清理任务执行记录时必须级联删除关联 task session 内容**
- **每次任务执行都新建一个 task session，不复用旧 session**
- **实现顺序应先补存储与关联，再接执行与前端查看，最后补级联清理**

这能以较小改动，把现有 AI Session 能力扩展为“可调度、可追溯、可隔离”的任务执行体系。
