# AI Workspace-Bound Session DB Redesign 技术说明

## 文档信息
- **类型**: 技术说明 / 架构实现记录
- **版本**: v1.0
- **整理时间**: 2026-04-27
- **状态**: 已完成并进入归档
- **适用范围**: TweetPilot AI 对话系统的 workspace 级持久化与运行时绑定机制

---

## 1. 背景

TweetPilot 的 AI 对话能力早期采用“全局 JSONL 会话存储 + 进程内临时运行态”的组合方式。这个方案在单一工作区、短生命周期试验时可用，但随着产品开始支持多 workspace、历史会话恢复、跨重启继续对话等能力，原有结构出现了明显的语义错位：

- 会话历史是全局存储的
- AI 工具运行上下文却依赖当前 `working_dir`
- 前端显示“已选中会话”并不等价于后端存在可发送的活跃 session

这会导致典型问题：

1. workspace A 的历史消息可能在 workspace B 中被看见或误恢复
2. 前端以为某个历史会话已激活，但后端 `AiState.session = None`
3. 发送消息时需要临时补偿式重新激活，职责边界混乱
4. 旧 JSONL 存储不适合承载 message / tool call / streaming state 的正式关系数据

因此，该模块被重构为：**AI 会话严格属于 workspace，并持久化到该 workspace 的数据库中。**

---

## 2. 重构目标

本次重构的目标不是修补某一个恢复 bug，而是统一 AI 对话系统的“存储归属、运行归属、界面归属”。

### 2.1 功能目标

- 切换 workspace 时，切换到该 workspace 自己独立的 AI session 空间
- 历史 AI 对话仅在所属 workspace 内可见、可恢复、可继续
- 所有持久化数据存储到 `<workspace>/.tweetpilot/tweetpilot.db`
- 不迁移旧的全局 conversation JSONL 数据
- 删除围绕旧架构产生的临时 stopgap / workaround 激活逻辑

### 2.2 架构目标

将 AI 对话系统改造成如下结构：

```text
Workspace
  └─ .tweetpilot/
      └─ tweetpilot.db
          ├─ ai_sessions
          ├─ ai_messages
          └─ ai_tool_calls
```

在这个模型下：

- AI session 是 workspace 资源，不再是全局资源
- 后端 runtime session 只是当前活跃会话的内存缓存，不再是真实数据源
- 数据库成为历史会话、消息、工具调用关系的权威来源

---

## 3. 旧方案的主要问题

### 3.1 存储归属与运行归属分离

旧会话历史位于：

```text
~/.tweetpilot/conversations/*.jsonl
```

这意味着历史数据是全局的，但 AI 运行时又依赖 workspace。这样一来，恢复历史会话时必须“猜测”它属于哪个 workspace，导致消息与工具上下文可能错配。

### 3.2 运行态恢复不完整

旧 `load_ai_session()` 只能加载历史内容，不能可靠恢复 `ClaurstSession`。前端的“选中会话”与后端的“存在活跃 runtime session”不是同一件事，因此会出现 UI 看起来可继续、实际无法发送的断层。

### 3.3 JSONL 不适合正式业务数据

JSONL 方案不利于：

- session metadata 的稳定管理
- tool call 的结构化关联
- streaming 中间态增量持久化
- 级联删除
- workspace 隔离语义的天然表达

---

## 4. 新架构概览

重构完成后，AI 对话系统的基本结构分为两层：

### 4.1 持久化层

以 workspace 内的 SQLite 数据库为唯一持久化来源：

- `ai_sessions`：会话元数据
- `ai_messages`：消息记录
- `ai_tool_calls`：工具调用记录

### 4.2 运行时层

后端仍保留 AI runtime state，但它只表示“当前 workspace 下当前活跃会话的内存执行状态”，不再承担长期存储职责。

核心关系可概括为：

```text
当前窗口
  └─ 当前 workspace
      ├─ tweetpilot.db
      │   ├─ ai_sessions
      │   ├─ ai_messages
      │   └─ ai_tool_calls
      └─ AiState / ClaurstSession
          ├─ active workspace
          ├─ active session id
          ├─ active request id
          └─ runtime session cache
```

---

## 5. 数据库存储设计

### 5.1 `ai_sessions`

用于存储会话元数据，包括：

- `id`
- `title`
- `created_at`
- `updated_at`
- `last_message_at`
- `message_count`
- `provider_id`
- `model`
- `system_prompt`
- 其他必要状态字段

设计重点：

- 会话列表展示不需要每次聚合消息表
- 历史 session 恢复时可使用会话创建时的 model/provider/system prompt 快照
- 会话信息的生命周期独立于 runtime session

### 5.2 `ai_messages`

用于存储会话消息，包括：

- `id`
- `session_id`
- `role`
- `content`
- `thinking`
- `thinking_complete`
- `status`
- `request_id`
- `sequence_no`
- `created_at`
- `updated_at`

设计重点：

- 通过 `sequence_no` 明确顺序，而不是只依赖时间戳
- assistant 的 streaming 中间态可增量写回
- user message 与 assistant placeholder 都有稳定落点

### 5.3 `ai_tool_calls`

用于存储工具调用过程，包括：

- `id`
- `message_id`
- `session_id`
- `tool`
- `action`
- `input`
- `output`
- `status`
- `start_time`
- `end_time`
- `duration`

设计重点：

- 工具调用挂载在 assistant message 下
- 同时冗余 `session_id` 便于 session 级查询与删除
- 删除 session 时依赖外键级联清理

---

## 6. 后端存储层改造

### 6.1 旧存储退役

旧的 `ConversationStorage` 基于 JSONL，已不再作为 AI 主流程存储实现。新的持久化逻辑由独立的数据库存储层承担。

推荐实现形态为：

```text
src-tauri/src/services/ai_storage.rs
```

其职责集中在：

1. session 元数据读写
2. message 读写
3. tool call 读写

它不负责 runtime 激活逻辑，只负责数据库读写。

### 6.2 migration 接入

workspace 数据库初始化流程新增 AI 相关 migration，例如：

```text
src-tauri/migrations/004_create_ai_conversation_tables.sql
```

并接入 `TaskDatabase::init_schema()`，使 AI 表与现有任务系统表共享同一个 workspace DB 生命周期。

这保证了：

- 不引入新的独立数据库文件
- workspace 创建后即可具备 AI 数据表
- AI 数据与该 workspace 的其他业务数据在物理层面天然隔离

---

## 7. 运行时状态模型调整

### 7.1 旧问题

原始 `AiState` 只维护：

- runtime session
- cancel token
- active request id

但没有显式记录：

- 它属于哪个 workspace
- 当前活跃的是哪个 session

这导致状态一致性只能依赖外部流程“碰巧正确”。

### 7.2 新模型

新的 runtime state 至少要显式维护：

- `workspace_path`
- `active_session_id`
- `session`
- `cancel_token`
- `active_request_id`

其核心语义是：

- runtime session 必须绑定到一个明确的 workspace
- runtime session 必须绑定到一个明确的 session id
- 切换 workspace 或删除当前活跃 session 时，runtime state 必须同步清空

### 7.3 不变量

该状态模型需要维持以下约束：

1. `session.is_some()` 时，必须存在 `workspace_path`
2. `session.is_some()` 时，必须存在 `active_session_id`
3. 发生 workspace 切换时，旧 runtime 必须清空
4. 删除当前活跃 session 时，runtime 必须同步清空
5. `send_ai_message()` 仅在 session / workspace / active_session_id 三者齐备时允许执行

---

## 8. `ClaurstSession` 的职责收敛

重构后，`ClaurstSession` 的职责被明确收敛为“纯运行时对象”，主要负责：

- 内存中的消息序列
- provider 请求发送
- streaming 事件派发
- 工具执行生命周期

它不再负责：

- 自行扫描旧 conversations 目录
- 自行决定历史消息从哪里加载
- 自行把数据写入旧 JSONL 存储

历史消息加载改为：

1. 上层从 workspace DB 读取历史数据
2. 显式将历史消息注入 runtime session
3. runtime 只关心后续继续对话

这个边界调整是整个重构成功的关键之一，因为它把“运行时行为”和“持久化策略”彻底拆开了。

---

## 9. 命令层语义重构

### 9.1 `create_new_session(working_dir)`

职责变为：

- 校验 workspace
- 打开该 workspace 的数据库
- 生成 system prompt / provider / model 快照
- 插入 `ai_sessions`
- 创建对应 runtime `ClaurstSession`
- 更新当前活跃 runtime state

创建成功后，该 session 既已落库，也已激活，可直接发送消息。

### 9.2 `list_ai_sessions(working_dir)`

职责是纯查询：

- 只从指定 workspace DB 返回该 workspace 的 session 列表
- 不修改 runtime state

### 9.3 `load_ai_session(working_dir, session_id)`

职责是纯读取：

- 读取该 workspace 下指定 session 的历史消息与 tool calls
- 返回给前端渲染
- 不修改 runtime state

这里刻意保持 `load` 与 `activate` 的边界分离。

### 9.4 `activate_ai_session(working_dir, session_id)`

职责是恢复运行态：

- 校验 session 属于该 workspace
- 从数据库读取历史消息
- 使用会话快照恢复 runtime 参数
- 重建 `ClaurstSession`
- 更新 `AiState.workspace_path` 和 `AiState.active_session_id`

激活完成后，后端 runtime 与该历史会话重新对齐。

### 9.5 `send_ai_message(message)`

最终语义下，`send_ai_message` 不再依赖额外传入 `working_dir` 来补救。它只对“当前已经激活的 runtime session”发送请求。

其典型流程为：

1. 校验存在 active workspace + active session + runtime session
2. 插入 user message
3. 插入 assistant placeholder message
4. 设置当前 request id / cancel token
5. 调用 runtime 发送请求
6. 流式更新 assistant message 与 tool calls
7. 完成后更新 session 元数据
8. 无论成功、失败或取消，都清理 in-flight 状态

### 9.6 `delete_ai_session(working_dir, session_id)`

职责为：

- 删除指定 workspace DB 中该 session
- 依赖外键级联删除 messages / tool calls
- 如果删除的是当前活跃 session，则同步清理 runtime state

---

## 10. 前端语义调整

前端状态模型被调整为明确的 workspace 作用域：

- `currentWorkspace`
- `currentSessionId`
- `sessions`
- `messages`

关键行为规则如下：

### 10.1 切换 workspace

前端需要：

1. 清空当前聊天状态
2. 清空当前 session id
3. 重新加载该 workspace 的 session 列表

这样可以避免保留跨 workspace 的 stale session id。

### 10.2 加载历史 session

标准路径为：

1. `activateSession(workingDir, sessionId)`
2. `loadSession(workingDir, sessionId)`
3. 渲染历史消息

### 10.3 发送消息

发送只应发生在：

- 当前 workspace 存在
- 当前 session 已选中
- 当前 session 已激活

在最终架构中，发送前不再需要临时补偿式再次 `activateSession()`。

---

## 11. 消息持久化策略

该模块放弃了“请求结束后一次性写入全部结果”的做法，转而采用**增量持久化**。

### 11.1 用户消息

发送前立即写入 `ai_messages`。

### 11.2 assistant 占位消息

请求开始时先插入一条 assistant placeholder，状态为 `streaming`。

### 11.3 thinking

随着事件流更新 `thinking` 字段。

### 11.4 tool call

- tool start：插入 `ai_tool_calls`
- tool end：更新输出、状态、耗时、结束时间

### 11.5 请求结束

统一更新 assistant message 的：

- `content`
- `thinking_complete`
- `status`

并同步刷新 session 的：

- `updated_at`
- `last_message_at`
- `message_count`

### 11.6 这种策略的价值

- 崩溃时最大限度保留已产生数据
- 历史回放完整
- 调试与诊断更容易
- 更适合 streaming UI 和 tool timeline 展示

---

## 12. 旧逻辑的退役范围

重构完成后，以下旧语义不再属于主流程：

- `~/.tweetpilot/conversations/` 全局 JSONL 会话读写
- 基于 `ConversationStorage` 的历史会话加载与保存
- 不带 workspace 归属的全局 session 列表
- 发送消息前依赖前端临时补偿式激活的 stopgap 逻辑

由于本次明确不迁移旧数据，因此无需保留双写、兼容导入或过渡同步方案。

---

## 13. 验证结果与成功标准

该重构的验收标准主要包括：

1. AI 会话数据只存在于 `<workspace>/.tweetpilot/tweetpilot.db`
2. 切换 workspace 后，看不到其他 workspace 的 AI 会话
3. 历史 AI 会话可在所属 workspace 内恢复并继续对话
4. 后端不再依赖旧 JSONL conversation 存储
5. 不再出现前端选中会话但后端无 active session 的错位
6. 删除 session 时，messages / tool calls 关联数据会被一起清理
7. 发送消息路径不再依赖临时补偿式激活

按照当前对话中的实现与验证记录，这些核心目标已经完成，后续相关工作主要转向流式状态展示体验优化，而不再是架构补洞。

---

## 14. 影响范围

该重构涉及的典型文件范围包括：

### 新增或新增过的核心文件
- `src-tauri/migrations/004_create_ai_conversation_tables.sql`
- `src-tauri/src/services/ai_storage.rs`

### 重点修改文件
- `src-tauri/src/task_database.rs`
- `src-tauri/src/commands/ai.rs`
- `src-tauri/src/claurst_session.rs`
- `src-tauri/src/main.rs`
- `src/services/ai/tauri.ts`
- `src/components/ChatInterface.tsx`

### 退役目标
- `src-tauri/src/services/conversation_storage.rs`
- 旧全局 conversation JSONL 相关引用

---

## 15. 一句话结论

这次重构的本质，不是简单地把 conversation 从文件搬到数据库，而是把 AI 对话从“全局弱归属日志”升级为“workspace 内强归属、可恢复、可继续的正式业务数据”。
