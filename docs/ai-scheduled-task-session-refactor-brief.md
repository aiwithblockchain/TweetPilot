# AI 定时任务 Session 重构简要方案

## 1. 背景与目标

基于现有能力，我们准备新增一类专用于“定时任务执行”的 AI Session。

本次重构的目标不是重写当前 Session 创建逻辑，而是**复用现有 Session 的系统提示词注入能力**，并在此基础上新增：

- 定时触发 AI Session
- 可选注入 Twitter 账号 persona prompt
- 允许任务描述驱动 AI 调用工具执行脚本
- 单独存储任务 AI Session 的完整对话与执行过程
- 单独记录每次任务执行的最终输出结果

核心原则：

1. **不改动现有 system prompt 注入机制**
2. **任务系统只负责触发、编排、记录，不重造 Session 内核**
3. **任务执行过程与普通 AI Session 进行数据隔离**
4. **最终结果只记录 AI 执行完成后的最终输出，但完整过程也可追溯**

---

## 2. 设计共识

### 2.1 system prompt

现有 Session 创建流程已经具备 system prompt 注入能力，因此：

- 新的任务 AI Session 必须复用现有 Session 创建链路
- 不单独再实现一套 system prompt 拼接逻辑
- 只要任务执行仍走当前 Session 创建机制，就天然继承现有系统约束

### 2.2 persona prompt

persona prompt 应为**可选能力**，而不是强制能力。

任务侧建议支持以下模式：

- 不使用 persona
- 使用某个 Twitter 账号的 persona

因此任务配置中应显式提供一个开关，例如：

- `use_persona: true | false`
- `twitter_account_id: string | null`

约束建议：

- `use_persona = false` 时，不注入 persona prompt
- `use_persona = true` 时，要求选择具体账号
- 某些读取型、分析型任务默认应允许关闭 persona

### 2.3 脚本执行方式

本方案认可由用户在任务描述中直接告诉 AI：

- 去哪个目录执行哪个脚本
- 将脚本输出写入哪个目录

因为任务 AI Session 本身具备工具调用能力，所以可以允许 AI 在任务描述约束下完成这类动作。

这一层的边界是：

- 任务系统不直接执行脚本
- 任务系统只负责启动 AI Session
- AI 是否调用工具、如何调用工具，由任务描述和现有工具能力决定
- 任务系统最终只记录 AI 的最终输出与完整执行过程

### 2.4 任务 Session 独立存储

任务 AI Session 需要特别命名、编号，并使用不同于当前普通 AI Session 的数据库表进行存储。

原因：

- 需要通过“任务执行记录”定位某次 AI 执行
- 需要查看该任务执行的完整对话过程
- 需要避免与普通聊天 Session 混淆
- 便于后续做任务审计、失败排查、历史回放

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
- `twitter_account_id`
- `created_by`
- `created_at`
- `updated_at`

说明：

- `description` 为用户填写的任务描述
- 该描述可以包含“执行哪个脚本、结果写到哪里”等要求
- 任务定义本身不保存 AI 对话，仅保存配置

### 3.2 任务执行层

存储“某次任务何时被触发，结果如何”。

建议新增任务执行记录表，例如：`task_ai_runs`

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
- `task_session_id`
- `created_at`

说明：

- 每次调度触发就生成一条 run
- `final_output` 仅保存最终输出结果
- `task_session_id` 关联任务专用 Session
- `session_code` 用于展示与排查

### 3.3 任务专用 Session 层

存储“该次任务 AI 的完整执行过程”。

建议新增独立于当前普通 Session 的表，例如：

- `task_ai_sessions`
- `task_ai_messages`
- 如有工具日志，也可增加 `task_ai_tool_calls`

关键原则：

- 不复用当前普通聊天表
- 但底层字段设计可以参考当前 Session 体系
- 任务 Session 必须能完整还原一次任务执行的过程

建议字段方向：

#### task_ai_sessions
- `id`
- `task_id`
- `task_run_id`
- `session_code`
- `title`
- `source_type`（固定为 `scheduled_task`）
- `created_at`
- `updated_at`

#### task_ai_messages
- `id`
- `session_id`
- `role`
- `content`
- `message_index`
- `tool_call_metadata`（可选）
- `created_at`

这样可以通过任务执行记录直接追溯完整 AI 对话。

### 3.4 调度触发层

调度器只做以下事情：

1. 找到到期任务
2. 创建一条 `task_ai_runs`
3. 创建一个任务专用 Session
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

### 4.2 任务输入建议

任务侧不需要额外发明复杂协议，建议先采用“主输入 + 可选 persona 附加输入”的方式。

可理解为：

- 基础输入：用户任务描述
- 可选附加输入：persona prompt

建议内部形成类似这样的输入结构：

- 当 `use_persona = false`
  - 仅发送任务描述
- 当 `use_persona = true`
  - 在任务描述前附加账号 persona 上下文

例如内部逻辑可以是：

1. 读取任务描述
2. 判断是否使用 persona
3. 如使用，则读取对应账号 persona
4. 将 persona + 用户任务描述 一并交给现有 Session

注意：

- persona 是增强信息，不替代 system prompt
- system prompt 仍由现有 Session 机制负责注入

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
- 支持绑定 Twitter 账号 persona
- 调度触发后创建任务专用 AI Session
- 复用现有 Session 创建逻辑
- 单独存储任务 Session 全量消息
- 在任务执行记录中保存最终输出
- 支持从任务执行记录查看完整 AI 过程

### 6.2 暂不扩展

- 不做新的 prompt 编排系统
- 不改现有普通 Session 表结构
- 不做复杂任务编排
- 不做自动发布后处理
- 不做多阶段结果解析

这样可以先验证：

- 任务 Session 隔离是否合理
- persona 开关是否满足使用场景
- AI 工具调用执行脚本的方式是否足够稳定
- 最终输出与完整过程的双重存储是否满足排查需求

---

## 7. 建议的执行流程

建议整体流程如下：

1. 调度器扫描到期任务
2. 创建 `task_ai_runs` 记录，状态为 `pending`
3. 创建任务专用 Session，生成专属编号
4. 将 run 状态更新为 `running`
5. 根据配置决定是否读取 persona prompt
6. 通过现有 Session 创建与执行链路发起任务 AI Session
7. AI 在 Session 中根据任务描述自主调用工具、执行脚本、写文件
8. 执行结束后，系统获取 AI 最终输出
9. 将最终输出写入 `task_ai_runs.final_output`
10. 将 run 状态更新为 `success` 或 `failed`
11. 后台通过 `task_ai_runs -> task_ai_sessions -> task_ai_messages` 查看完整执行过程

---

## 8. 本次重构的收益

如果按这个方向落地，收益主要有：

- **复用现有 system prompt 注入能力**，避免重复建设
- **persona 使用更灵活**，适配内容型与非内容型任务
- **任务执行与普通聊天彻底分离**，便于维护
- **每次任务可追踪完整 AI 过程**，便于审计和排查
- **最终输出单独沉淀**，便于后续展示、筛选、复用

---

## 9. 需要下一步继续明确的问题

这份文档先作为简要重构方向，下一轮建议继续细化以下问题：

1. 任务专用 Session 是否完全复用现有消息结构，还是只复用部分字段
2. persona prompt 在任务输入中的具体拼接格式
3. 任务执行完成后，“最终输出”如何判定（最后一条 assistant 消息，还是指定结构）
4. 工具调用日志是否需要单独建表
5. 调度失败、Session 创建失败、工具执行失败时的状态流转
6. 后台界面如何展示任务执行记录与完整 AI 对话

---

## 10. 结论

我认可当前方案，且建议采用以下重构原则：

- **系统提示词继续完全复用现有 Session 创建机制**
- **persona prompt 改为任务级可选能力**
- **允许 AI 在任务描述驱动下调用工具执行脚本**
- **任务 AI Session 使用独立命名、编号、独立表存储完整对话**
- **任务执行记录只关注触发结果与最终输出，但必须可关联完整执行过程**

这能以较小改动，把现有 AI Session 能力扩展为“可调度、可追溯、可隔离”的任务执行体系。
