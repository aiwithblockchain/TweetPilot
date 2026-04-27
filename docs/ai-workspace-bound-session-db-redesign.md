# AI 对话系统与 Workspace 强绑定重构方案

## 文档信息
- **版本**: v1.0
- **创建时间**: 2026-04-26
- **状态**: 已部分落地，需继续按当前代码收口
- **目标**: 将 AI 对话系统从“全局 JSONL 会话存储 + 进程内临时 session”重构为“workspace 内数据库持久化 + 与 workspace 强绑定的 AI session 系统”

---

## 一、需求复述

本次重构已确认的需求如下：

1. **切换 workspace = 切换该 workspace 自己独立的 AI 会话空间**
2. **历史 AI 对话只在其所属 workspace 内可见、可恢复、可继续，不做全局共享**
3. **彻底放弃旧数据，不做任何迁移**
4. **所有 AI session 持久化都放到 workspace 下的 `.tweetpilot` 中**
5. **存储介质改为 workspace 下已存在的 `tweetpilot.db`**
6. **只需要新增本次所需的数据表，不需要兼容旧的 `~/.tweetpilot/conversations/*.jsonl`**

换句话说，本次不是修一个“历史会话恢复失败”的点状 bug，而是要把 AI 对话系统的归属关系彻底改正为：

```text
一个 workspace
  └─ 一个 .tweetpilot/tweetpilot.db
      └─ 该 workspace 自己的 AI sessions / messages / tool calls
```

---

## 二、现状问题

当前 AI 对话系统存在三个核心错位。

### 2.1 存储归属错位

当前消息历史落在：

```text
~/.tweetpilot/conversations/*.jsonl
```

这意味着：
- session 是全局存储的
- 但 AI 实际运行时又依赖 `working_dir`
- “存储归属”和“运行上下文归属”并不一致

结果就是：
- 历史消息可以全局看到
- 但恢复运行时又必须猜它属于哪个 workspace
- 一旦猜错，就会出现历史消息来自 A 项目、工具上下文却绑定到 B 项目的语义污染

### 2.2 运行态恢复能力缺失

当前 `load_ai_session()` 只能加载历史消息，不能真正恢复后端运行态 `ClaurstSession`。

本质原因是：旧存储里缺少完整 session metadata，例如：
- workspace 路径
- session 创建时间 / 更新时间
- session 标题
- 运行所需的上下文归属信息

因此前端即使“看起来选中了会话”，后端也可能没有活跃 session，导致之前出现的：

- 前端发送消息
- 后端 `AiState.session = None`
- UI 卡在 `AI is thinking`

### 2.3 数据结构不适合长期扩展

当前 JSONL 方案虽然简单，但存在天然限制：

- `list_sessions()` 需要扫目录
- metadata 需要从消息里推导
- workspace 归属没有被正确持久化
- 不适合后续做分页、搜索、归档、过滤、统计
- 不适合做强一致的“session / message / tool_call”关系管理

---

## 三、重构目标

本次方案的目标非常明确。

### 3.1 架构目标

把 AI 对话系统改造成：

```text
Workspace
  └─ .tweetpilot/
      └─ tweetpilot.db
          ├─ ai_sessions
          ├─ ai_messages
          └─ ai_tool_calls
```

### 3.2 语义目标

建立明确且单向的归属关系：

- **一个 AI session 必须属于一个 workspace**
- **一个 workspace 只能看到自己的 AI sessions**
- **切换 workspace 时，AI 会话空间随之切换**
- **恢复历史会话时，不再依赖“当前工作区猜测”**
- **后端活跃 session 必须和当前 workspace、当前选中 session 一致**

### 3.3 工程目标

- 废弃 `ConversationStorage` 的 JSONL 实现
- 在 `tweetpilot.db` 中新增 AI 相关表
- 建立新的 AI repository / storage 层
- 让前后端 API 以 workspace 级隔离为默认前提
- 不做历史迁移，删除旧逻辑即可

---

## 四、目标架构

## 4.1 核心原则

以后 AI 对话系统遵循以下原则：

1. **AI session 不是全局资源，而是 workspace 资源**
2. **session 列表查询必须从当前 workspace 的数据库读取**
3. **session 继续对话必须在其所属 workspace 中恢复**
4. **前端不再维护“脱离 workspace 的 session id”**
5. **后端不再允许存在“无 workspace 归属的 AI session”**

## 4.2 运行时关系

重构后关系应当是：

```text
当前窗口
  └─ 当前 workspace
      ├─ WorkspaceContext
      │   ├─ TaskDatabase (.tweetpilot/tweetpilot.db)
      │   ├─ TaskExecutor
      │   ├─ UnifiedTimerManager
      │   └─ AiRuntimeState
      │       ├─ active_session_id
      │       ├─ active_request_id
      │       ├─ cancel_token
      │       └─ ClaurstSession
      └─ 数据库存储
          ├─ ai_sessions
          ├─ ai_messages
          └─ ai_tool_calls
```

这里有个重要调整：

> AI runtime state 不应该继续作为“全局应用级状态”悬空存在，而应该明确属于当前 workspace 运行上下文。

如果短期内不想把 `AiState` 整体塞回 `WorkspaceContext`，至少也要保证：
- `AiState` 中活跃 session 的 `workspace_path`
- 当前后端 workspace
- 当前前端 workspace

三者始终一致。

但从长期结构看，**最佳方案是把 AI 运行时状态并入 workspace context**。

---

## 五、数据库设计

本次不新建独立数据库文件，直接在现有：

```text
<workspace>/.tweetpilot/tweetpilot.db
```

中新增 AI 相关表。

## 5.1 表一：`ai_sessions`

用于存储 session 元数据。

### 建议字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PRIMARY KEY | session id，使用 uuid |
| `title` | TEXT NOT NULL | 会话标题 |
| `workspace_path` | TEXT NOT NULL | 冗余存储当前 workspace 路径，便于诊断与校验 |
| `status` | TEXT NOT NULL | `active` / `archived` / `deleted` |
| `created_at` | TEXT NOT NULL | ISO 时间 |
| `updated_at` | TEXT NOT NULL | ISO 时间 |
| `last_message_at` | TEXT | 最后一条消息时间 |
| `message_count` | INTEGER NOT NULL DEFAULT 0 | 消息数缓存 |
| `model` | TEXT | 创建时使用的 model 快照 |
| `provider_id` | TEXT | 创建时使用的 provider id 或 name |
| `system_prompt` | TEXT | 创建 session 时使用的 system prompt 快照 |
| `constraints_version` | TEXT | 可选，约束版本号 |
| `summary` | TEXT | 可选，用于后续会话摘要 |

### 设计说明

1. `workspace_path` 虽然在单个 workspace 数据库里看似冗余，但建议保留：
   - 方便日志诊断
   - 方便未来导出/导入
   - 方便校验数据库归属是否异常

2. `system_prompt` 建议落库快照，而不是每次重建时重新计算后假设一致。
   - 这样历史 session 的运行上下文更稳定
   - 即使 `.tweetpilot/skill.md` 后续变化，旧 session 仍可按创建时上下文继续

3. `message_count` / `last_message_at` 是缓存字段，用于 session 列表快速展示，不需要每次聚合消息表。

### 建议建表 SQL

```sql
CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  workspace_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_message_at TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  provider_id TEXT,
  system_prompt TEXT,
  constraints_version TEXT,
  summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_updated_at
  ON ai_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_status
  ON ai_sessions(status);
```

---

## 5.2 表二：`ai_messages`

用于存储会话消息。

### 建议字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PRIMARY KEY | message id |
| `session_id` | TEXT NOT NULL | 归属 session |
| `role` | TEXT NOT NULL | `user` / `assistant` / `system` |
| `content` | TEXT NOT NULL | 最终展示内容 |
| `thinking` | TEXT | thinking 内容 |
| `thinking_complete` | INTEGER | 0/1 |
| `status` | TEXT | streaming / success / error / cancelled |
| `request_id` | TEXT | 本次请求 id，便于事件关联 |
| `sequence_no` | INTEGER NOT NULL | 会话内顺序号 |
| `created_at` | TEXT NOT NULL | ISO 时间 |
| `updated_at` | TEXT NOT NULL | ISO 时间 |

### 设计说明

1. `sequence_no` 很关键：
   - 明确消息顺序
   - 避免单纯依赖时间戳排序
   - 对流式更新更安全

2. `request_id` 建议保留：
   - 方便把 `thinking/tool_call/final_text` 串起来
   - 方便排查某次请求的全链路日志

3. `status` 用于表达消息生命周期：
   - `streaming`
   - `completed`
   - `error`
   - `cancelled`

### 建议建表 SQL

```sql
CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  thinking TEXT,
  thinking_complete INTEGER,
  status TEXT,
  request_id TEXT,
  sequence_no INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_session_sequence
  ON ai_messages(session_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_ai_messages_request_id
  ON ai_messages(request_id);
```

---

## 5.3 表三：`ai_tool_calls`

用于存储 assistant 消息过程中的工具调用。

### 建议字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PRIMARY KEY | tool call id |
| `message_id` | TEXT NOT NULL | 归属 assistant message |
| `session_id` | TEXT NOT NULL | 冗余 session id，便于查询 |
| `tool` | TEXT NOT NULL | 工具名 |
| `action` | TEXT NOT NULL | 动作名 |
| `input` | TEXT | 输入 |
| `output` | TEXT | 输出 |
| `status` | TEXT NOT NULL | `running` / `success` / `error` |
| `duration` | REAL | 秒 |
| `start_time` | TEXT NOT NULL | ISO 时间 |
| `end_time` | TEXT | ISO 时间 |

### 设计说明

1. 保留 `message_id` 与 `session_id` 双归属：
   - `message_id` 用于严格关联展示
   - `session_id` 便于 session 级查询和删除

2. `input` / `output` 仍然按文本落库即可，当前不需要拆结构。

### 建议建表 SQL

```sql
CREATE TABLE IF NOT EXISTS ai_tool_calls (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  action TEXT NOT NULL,
  input TEXT,
  output TEXT,
  status TEXT NOT NULL,
  duration REAL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  FOREIGN KEY (message_id) REFERENCES ai_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_message_id
  ON ai_tool_calls(message_id);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_session_id
  ON ai_tool_calls(session_id);
```

---

## 5.4 是否需要单独的 session state 表

**当前阶段不建议加。**

原因：
- 当前的“活跃 session”本质是运行态，不是长期业务数据
- 真正需要持久化的是 session 内容与上下文，不是某一刻 UI 正停留在哪个 session
- 产品也没有要求跨启动自动恢复当前对话焦点

所以当前不需要新增：
- `ai_active_session`
- `ai_runtime_state`

保持简单即可。

---

## 六、后端重构方案

## 6.1 废弃旧的 `ConversationStorage`

当前 `src-tauri/src/services/conversation_storage.rs` 基于 JSONL，应整体退役。

建议替换为新的数据库实现，例如：

```text
src-tauri/src/services/ai_storage.rs
```

职责只做三类事：

1. session 元数据读写
2. message 读写
3. tool call 读写

不要把“运行时 session 激活逻辑”塞进 storage 层。

### 建议结构

```rust
pub struct AiStorage {
    conn: Connection,
}

impl AiStorage {
    pub fn new(db_path: PathBuf) -> Result<Self, String>
    pub fn init_schema(&self) -> Result<(), String>

    pub fn create_session(&self, input: CreateAiSessionInput) -> Result<AiSessionRow, String>
    pub fn list_sessions(&self) -> Result<Vec<AiSessionRow>, String>
    pub fn get_session(&self, session_id: &str) -> Result<AiSessionRow, String>
    pub fn load_session_with_messages(&self, session_id: &str) -> Result<LoadedAiSession, String>
    pub fn delete_session(&self, session_id: &str) -> Result<(), String>

    pub fn append_message(&self, input: CreateAiMessageInput) -> Result<AiMessageRow, String>
    pub fn update_message_stream_state(&self, ...)
    pub fn create_tool_call(&self, ...)
    pub fn finish_tool_call(&self, ...)
}
```

---

## 6.2 在现有数据库初始化中接入 AI migration

当前 `TaskDatabase::init_schema()` 已加载：

- `001_create_tasks_tables.sql`
- `002_create_accounts_table.sql`
- `003_create_x_accounts_and_trend.sql`

本次新增：

```text
src-tauri/migrations/004_create_ai_conversation_tables.sql
```

并在 `TaskDatabase::init_schema()` 中追加：

```rust
conn.execute_batch(include_str!("../migrations/004_create_ai_conversation_tables.sql"))?;
```

### 这样做的意义

- 继续沿用现有数据库 schema 管理习惯
- 保持 workspace 下只有一个 `tweetpilot.db`
- AI 数据与任务数据共享同一个数据库生命周期

---

## 6.3 AI 状态归属调整

当前 `AiState` 是全局管理：

```rust
pub struct AiState {
    pub session: Arc<Mutex<Option<ClaurstSession>>>,
    pub cancel_token: Arc<Mutex<Option<CancellationToken>>>,
    pub active_request_id: Arc<Mutex<Option<String>>>,
}
```

这个结构的核心问题是：
- 没有显式记录它属于哪个 workspace
- 没有显式记录活跃的 session_id
- 只能靠外部流程“碰巧正确”

### 建议最少调整

改成：

```rust
pub struct AiState {
    pub workspace_path: Arc<Mutex<Option<String>>>,
    pub active_session_id: Arc<Mutex<Option<String>>>,
    pub session: Arc<Mutex<Option<ClaurstSession>>>,
    pub cancel_token: Arc<Mutex<Option<CancellationToken>>>,
    pub active_request_id: Arc<Mutex<Option<String>>>,
}
```

这样至少可以在后端强校验：
- 当前 session 属于哪个 workspace
- 当前发送消息是否与当前活跃 session 匹配

### 更推荐的长期方案

把 AI runtime state 移入 `WorkspaceContext`：

```rust
pub struct WorkspaceContext {
    pub db: Arc<Mutex<TaskDatabase>>,
    pub executor: Arc<TaskExecutor>,
    pub timer_manager: UnifiedTimerManager,
    pub workspace_path: String,
    pub ai_runtime: Arc<Mutex<AiRuntimeState>>,
}
```

这样“AI 会话属于 workspace”在结构上就天然成立，不需要靠约定维持。

### 本次建议

如果想控制改动范围：
- **第一阶段**先做“`AiState` 增强 + 数据库存储切换”
- **第二阶段**再把 AI runtime 正式并入 `WorkspaceContext`

---

## 6.4 `ClaurstSession::new(...)` 的职责调整

当前 `ClaurstSession::new(...)` 会尝试从旧存储加载历史消息。

这在新架构下建议调整。

### 新原则

- `ClaurstSession::new(...)` 只负责构建运行时 session
- 历史消息是否注入，应由更上层显式控制

### 推荐改法

提供两种入口：

```rust
pub fn new_empty(...) -> anyhow::Result<Self>
pub fn new_with_messages(..., messages: Vec<Message>) -> anyhow::Result<Self>
```

或者：

```rust
pub fn new(...) -> anyhow::Result<Self>
pub fn replace_messages(&mut self, messages: Vec<Message>)
```

### 为什么要改

因为现在消息来源不再是“全局默认 ConversationStorage”，而是：
- 当前 workspace 的 `tweetpilot.db`
- 指定 session_id 对应的消息

也就是说，**消息加载应该从 storage 层显式拿到，再灌入 runtime session**，而不是让 `ClaurstSession` 自己偷偷去读旧文件。

---

## 七、命令层 API 重构

本次要把 Tauri AI 命令改成“workspace 绑定语义”。

## 7.1 建议保留并改造的命令

### `create_new_session(working_dir)`

改造后职责：
- 校验 workspace 存在
- 打开该 workspace 的 `tweetpilot.db`
- 生成 system prompt
- 在 `ai_sessions` 插入一条新记录
- 创建对应的运行时 `ClaurstSession`
- 设置为当前活跃 session
- 返回 `session_id`

### `load_ai_session(session_id)`

改造后职责：
- 从当前 workspace 数据库中读取该 session
- 读取其 messages / tool_calls
- 返回给前端展示

注意：
- 这个命令不再只是“全局 load”
- 它天然是在**当前 workspace 数据库上下文**中执行

### `send_ai_message(message)`

改造后职责：
- 必须要求当前存在活跃 workspace + 活跃 session
- 发送前不再临时猜测 working_dir
- 所有消息持久化都写入当前 workspace DB

---

## 7.2 建议新增的命令

### `activate_ai_session(session_id, working_dir)`

当前这个命令是临时补丁引入的；在彻底重构后它仍然有价值，但语义要更明确。

改造后职责：
- 确认 `session_id` 属于该 workspace
- 从 DB 读取 session metadata + 历史消息
- 用落库的 `system_prompt` / model 快照恢复运行时 `ClaurstSession`
- 更新 `AiState.active_session_id`
- 更新 `AiState.workspace_path`

### `list_ai_sessions(working_dir)`

建议显式带 `working_dir`，或者从后端当前 workspace context 中读取。

职责：
- 列出该 workspace 自己的 session 列表
- 不允许看到其他 workspace 数据

### `delete_ai_session(session_id, working_dir)`

职责：
- 只删除该 workspace 下该 session
- 级联删除 messages / tool_calls
- 如果删的是当前活跃 session，则同时清理运行态

---

## 7.3 建议删除的旧语义

以下旧语义应彻底放弃：

1. **全局 conversations 扫描**
2. **不带 workspace 归属的会话列表**
3. **load session 只读历史、不恢复运行态**
4. **send 时靠当前前端工作区临时补救激活**

这些都是旧架构残留，最终都要删除。

---

## 八、前端改造方案

## 8.1 前端状态模型调整

当前前端状态需要明确成：

```ts
currentWorkspace: string | null
currentSessionId: string | null
sessions: SessionMetadata[]
messages: ChatMessage[]
```

关键原则：

- `sessions` 的来源始终是**当前 workspace**
- `currentSessionId` 只能是当前 workspace 下存在的 session
- 一旦 workspace 切换：
  - 清空当前消息
  - 清空当前 session id
  - 重新加载该 workspace 的 session 列表

---

## 8.2 前端行为规则

### 当用户切换 workspace

前端应：
1. 清空当前聊天面板状态
2. 调用新的 `listSessions()` 加载该 workspace 下会话
3. 默认不自动恢复某个 session（除非产品另行要求）

### 当用户点击历史 session

前端应：
1. 调用 `activateSession(sessionId, workingDir)`
2. 调用 `loadSession(sessionId)`
3. 渲染该 session 的消息

### 当用户发送消息

前端应：
1. 保证当前 workspace 存在
2. 保证当前 session 已选中且已激活
3. 调用 `sendMessage()`

在彻底重构完成后，**发送前不应再需要“补偿式激活”**。
如果 session 选择流程已经正确激活过，则发送只负责发送。

也就是说，当前我们为了止血加入的：

```ts
await aiService.activateSession(currentSessionId, workingDir)
```

最终应从 `handleSend()` 中移除，回到更干净的职责边界。

---

## 8.3 UI 文案建议

为了强化 workspace 绑定语义，建议把界面文案同步调整：

- “会话历史” → “当前工作区会话”
- 空状态提示增加：
  - “当前工作区暂无 AI 会话”
- 切换 workspace 后提示：
  - “已切换工作区，会话列表已更新”

这不是必须首批完成，但方向上应保持一致。

---

## 九、数据流设计

## 9.1 新建会话

```text
前端点击“新建会话”
  → create_new_session(working_dir)
    → 打开 workspace/.tweetpilot/tweetpilot.db
    → 生成 system_prompt
    → 插入 ai_sessions
    → 创建运行态 ClaurstSession
    → 写入 AiState
  ← 返回 session_id
前端设置 currentSessionId
前端清空 messages
前端刷新当前 workspace session 列表
```

## 9.2 加载历史会话

```text
前端点击某个 session
  → activate_ai_session(session_id, working_dir)
    → 校验 session 属于该 workspace
    → 从 ai_sessions / ai_messages 读取数据
    → 恢复运行态 ClaurstSession
    → 写入 AiState
  → load_ai_session(session_id)
    → 返回该 session 的 messages / tool_calls
前端渲染消息
```

## 9.3 发送消息

```text
前端发送消息
  → send_ai_message(message)
    → 校验当前 AiState.workspace_path / active_session_id / session
    → 先写 user message 到 ai_messages
    → 调用 runtime session.send_message()
    → 流式更新 assistant message / tool_calls
    → 完成后更新 ai_sessions.updated_at / last_message_at / message_count
```

---

## 十、消息持久化策略

## 10.1 不再使用“运行结束后一次性写入”

建议改成**增量持久化**：

### 用户消息
- 发送前立即插入 `ai_messages`

### assistant 占位消息
- 请求开始时先插入一条 `assistant` 消息
- `status = streaming`
- 随着 chunk 到达不断 update

### thinking
- 增量更新 `thinking`

### tool call
- tool start 时插入 `ai_tool_calls`
- tool end 时更新状态、输出、耗时

### 请求结束
- 更新 assistant message：
  - `content`
  - `thinking_complete`
  - `status = completed / error / cancelled`

### 这样做的好处
- 应用崩溃时也尽量保住已产生的数据
- 历史回放更完整
- 更适合调试与诊断

---

## 十一、旧逻辑废弃范围

由于本次明确“不做数据迁移”，所以可以直接删除或停用以下逻辑。

### 11.1 可以直接废弃

- `~/.tweetpilot/conversations/` 目录读写逻辑
- `ConversationStorage::save_message/load_messages/list_sessions/get_session_metadata`
- `workspace` 为空字符串的旧 metadata 推导逻辑

### 11.2 可以直接移除的兼容负担

- 不需要从旧 JSONL 导入到新 DB
- 不需要同时兼容旧会话列表与新会话列表
- 不需要保留“双写”方案

这能大幅降低这次重构复杂度。

---

## 十二、实施分阶段方案

为了降低风险，建议按三阶段推进。

## Phase 1：数据库基础设施与 storage 替换

### 目标
把存储层从 JSONL 切到 workspace DB，但先不大改前端交互。

### 任务
1. 新增 migration `004_create_ai_conversation_tables.sql`
2. 在 `TaskDatabase::init_schema()` 中接入 migration
3. 新建 `ai_storage.rs`
4. 定义：
   - `AiSessionRow`
   - `AiMessageRow`
   - `AiToolCallRow`
   - `LoadedAiSession`
5. 把 `list/load/delete/clear` 改成 DB 实现
6. 停用旧 `ConversationStorage`

### 验证
- 新建 workspace 后 DB 自动建表成功
- session 可创建 / 查询 / 删除
- 旧全局 conversations 不再被访问

---

## Phase 2：运行态恢复与命令层重构

### 目标
让后端 session 恢复逻辑真正以 workspace DB 为准。

### 任务
1. 扩展 `AiState`，加入：
   - `workspace_path`
   - `active_session_id`
2. 改造 `create_new_session`
3. 改造 `activate_ai_session`
4. 改造 `send_ai_message`
5. 改造 `ClaurstSession` 的消息注入方式
6. 所有 AI 命令都改为 workspace 绑定语义

### 验证
- 选择历史 session 后可稳定继续对话
- 后端重启后重新激活历史 session 正常
- 不再出现 `session_present=false` 但前端仍 thinking 的错位

---

## Phase 3：前端语义清理与补丁回收

### 目标
去掉临时补偿逻辑，让职责边界恢复清晰。

### 任务
1. workspace 切换时重置 chat state
2. session panel 只展示当前 workspace 数据
3. `handleSend()` 中移除“补偿式 activateSession”
4. 调整空状态文案与错误提示
5. 增加前端测试覆盖 workspace 切换场景

### 验证
- 切换 workspace 后 session 列表正确隔离
- 发送路径清晰，无重复激活
- UI 行为与“会话属于 workspace”认知一致

---

## 十三、测试方案

## 13.1 Rust 后端测试

至少新增这些测试：

1. **创建 session 写入数据库**
2. **list_sessions 只返回当前 workspace DB 中的数据**
3. **load_session 可正确返回 messages + tool_calls**
4. **activate_session 可恢复 runtime session**
5. **删除 session 会级联删除消息和工具调用**
6. **send_ai_message 在无 active session 时返回明确错误**
7. **不同 workspace 的 DB 数据互相隔离**

## 13.2 前端测试

至少新增这些测试：

1. **切换 workspace 时会清空当前 session 状态**
2. **加载历史 session 时先激活再展示**
3. **发送消息仅在已有 active session 时执行**
4. **workspace A 的会话不会出现在 workspace B 列表中**
5. **发送失败时 UI 回滚正确**

## 13.3 手工回归

必须覆盖：

1. 新建 workspace 后新建会话
2. 同一 workspace 下创建多个会话
3. 历史会话继续对话
4. 切换到另一个 workspace，确认看不到旧会话
5. 再切回原 workspace，确认会话仍在
6. 开发态重启后重新加载历史会话
7. 删除会话后列表与详情同步更新

---

## 十四、关键设计决策

## 决策 1：AI session 必须与 workspace 强绑定

原因：
- 工具上下文依赖 working_dir
- system prompt 依赖 workspace constraints
- 否则 session 的语义不稳定

## 决策 2：使用 workspace DB，而不是全局 DB

原因：
- 与任务系统现有架构一致
- 物理上天然隔离
- 不需要额外的 workspace 过滤条件才能保证归属

## 决策 3：不迁移旧 JSONL 数据

原因：
- 产品尚早期
- 迁移只会增加复杂度
- 当前更重要的是把架构关系纠正

## 决策 4：session metadata 中保留 system prompt 快照

原因：
- 防止历史 session 恢复时受外部约束文件变更影响
- 让“继续对话”更接近原上下文

## 决策 5：优先做数据库与命令层正确性，再做 UI 文案优化

原因：
- 这次核心是修架构，不是做表面体验包装
- 先解决归属与恢复正确性，再做交互 polish

---

## 十五、不建议做的事情

本次重构中，以下做法不建议采用。

### 1. 继续把 session 存在全局 `~/.tweetpilot` 下
这会再次把“存储归属”和“运行归属”拆开。

### 2. 只给旧 JSONL 额外补一个 workspace 字段
这只能缓解，不是彻底重构。
JSONL 结构本身仍然不适合长期演进。

### 3. 在发送消息时继续依赖前端临时传 `working_dir` 做补救
这说明 session 激活模型仍然有问题。
长期应去掉。

### 4. 把“当前活跃 session”也长期持久化为恢复点
当前产品没有跨启动恢复需求，先别引入额外复杂度。

---

## 十六、最终建议

如果要“彻底修复这个问题”，建议按照下面的顺序执行：

### 第一步
先完成数据库层重构：
- 新增 AI conversations migration
- 废弃 JSONL ConversationStorage
- 所有 session/messages/tool_calls 改走 workspace DB

### 第二步
完成后端 session 恢复模型重构：
- `AiState` 增强
- `activate_ai_session` 严格按 workspace DB 恢复
- `send_ai_message` 不再依赖临时补偿

### 第三步
清理前端补丁并回归 workspace 语义：
- workspace 切换重置会话视图
- 历史会话只显示当前 workspace 的数据
- 去掉发送前的补偿式激活

---

## 十七、成功标准

本次重构完成后，应满足以下可验证标准：

1. **AI 会话数据只存在于 `<workspace>/.tweetpilot/tweetpilot.db`**
2. **切换 workspace 后，看不到其他 workspace 的 AI 会话**
3. **历史 AI 会话可以在所属 workspace 内稳定恢复并继续对话**
4. **后端不再依赖 `~/.tweetpilot/conversations/*.jsonl`**
5. **不会再出现前端选中会话但后端无 active session 的错位**
6. **发送消息路径不再依赖临时补偿式 `activateSession()`**

---

## 十八、建议落地文件清单

本方案预计会影响以下文件：

### 新增
- `src-tauri/migrations/004_create_ai_conversation_tables.sql`
- `src-tauri/src/services/ai_storage.rs`
- `docs/ai-workspace-bound-session-db-redesign.md`

### 重点修改
- `src-tauri/src/task_database.rs`
- `src-tauri/src/commands/ai.rs`
- `src-tauri/src/claurst_session.rs`
- `src-tauri/src/main.rs`
- `src/services/ai/tauri.ts`
- `src/components/ChatInterface.tsx`

### 待退役 / 删除
- `src-tauri/src/services/conversation_storage.rs`
- `~/.tweetpilot/conversations/*.jsonl` 相关逻辑引用

---

## 十九、精确接口草案

为了让后续实现可以直接开工，这里补充建议的 Rust / TypeScript 接口草案。

## 19.1 Rust 数据模型草案

### `AiSessionRow`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSessionRow {
    pub id: String,
    pub title: String,
    pub workspace_path: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_message_at: Option<String>,
    pub message_count: i64,
    pub model: Option<String>,
    pub provider_id: Option<String>,
    pub system_prompt: Option<String>,
    pub constraints_version: Option<String>,
    pub summary: Option<String>,
}
```

### `AiMessageRow`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessageRow {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub thinking: Option<String>,
    pub thinking_complete: Option<bool>,
    pub status: Option<String>,
    pub request_id: Option<String>,
    pub sequence_no: i64,
    pub created_at: String,
    pub updated_at: String,
}
```

### `AiToolCallRow`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiToolCallRow {
    pub id: String,
    pub message_id: String,
    pub session_id: String,
    pub tool: String,
    pub action: String,
    pub input: Option<String>,
    pub output: Option<String>,
    pub status: String,
    pub duration: Option<f64>,
    pub start_time: String,
    pub end_time: Option<String>,
}
```

### `LoadedAiSession`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadedAiSession {
    pub session: AiSessionRow,
    pub messages: Vec<AiMessageWithToolCalls>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessageWithToolCalls {
    pub message: AiMessageRow,
    pub tool_calls: Vec<AiToolCallRow>,
}
```

### `CreateAiSessionInput`

```rust
pub struct CreateAiSessionInput {
    pub id: String,
    pub title: String,
    pub workspace_path: String,
    pub model: Option<String>,
    pub provider_id: Option<String>,
    pub system_prompt: Option<String>,
    pub constraints_version: Option<String>,
}
```

---

## 19.2 `AiStorage` 接口草案

```rust
pub struct AiStorage {
    conn: Connection,
}

impl AiStorage {
    pub fn new(db_path: PathBuf) -> Result<Self, String>;

    pub fn create_session(&self, input: CreateAiSessionInput) -> Result<AiSessionRow, String>;
    pub fn list_sessions(&self) -> Result<Vec<AiSessionRow>, String>;
    pub fn get_session(&self, session_id: &str) -> Result<AiSessionRow, String>;
    pub fn load_session(&self, session_id: &str) -> Result<LoadedAiSession, String>;
    pub fn delete_session(&self, session_id: &str) -> Result<(), String>;
    pub fn clear_session_messages(&self, session_id: &str) -> Result<(), String>;

    pub fn get_next_sequence_no(&self, session_id: &str) -> Result<i64, String>;

    pub fn create_message(&self, message: AiMessageRow) -> Result<(), String>;
    pub fn update_message_content(
        &self,
        message_id: &str,
        content: &str,
        thinking: Option<&str>,
        thinking_complete: Option<bool>,
        status: Option<&str>,
    ) -> Result<(), String>;

    pub fn create_tool_call(&self, tool_call: AiToolCallRow) -> Result<(), String>;
    pub fn finish_tool_call(
        &self,
        tool_call_id: &str,
        output: Option<&str>,
        status: &str,
        duration: Option<f64>,
        end_time: Option<&str>,
    ) -> Result<(), String>;

    pub fn touch_session_after_message(
        &self,
        session_id: &str,
        last_message_at: &str,
    ) -> Result<(), String>;
}
```

### 设计取舍

1. `AiStorage` 不持有 workspace path，只持有当前 workspace DB 连接。
2. workspace 隔离由“哪个 DB 被打开”来保证，而不是每个查询都手写过滤条件。
3. `touch_session_after_message()` 单独保留，避免每次写消息都散落更新 session cache 字段。

---

## 19.3 `AiState` 最小重构草案

```rust
pub struct AiState {
    pub workspace_path: Arc<Mutex<Option<String>>>,
    pub active_session_id: Arc<Mutex<Option<String>>>,
    pub session: Arc<Mutex<Option<ClaurstSession>>>,
    pub cancel_token: Arc<Mutex<Option<CancellationToken>>>,
    pub active_request_id: Arc<Mutex<Option<String>>>,
}
```

### 状态约束

需要在代码中强制维护以下不变量：

1. `session.is_some()` 时，`workspace_path` 必须存在
2. `session.is_some()` 时，`active_session_id` 必须存在
3. `workspace_path` 变化时，旧 `session` 必须清空
4. `delete_ai_session()` 删除当前活跃 session 时，必须同步清空 runtime state

---

## 二十、命令签名建议

## 20.1 后端 Tauri 命令建议

### 保留并改造

```rust
#[tauri::command]
pub async fn create_new_session(
    working_dir: String,
    state: State<'_, AiState>,
) -> Result<String, String>;

#[tauri::command]
pub async fn list_ai_sessions(
    working_dir: String,
) -> Result<Vec<AiSessionRow>, String>;

#[tauri::command]
pub async fn load_ai_session(
    working_dir: String,
    session_id: String,
) -> Result<LoadedAiSession, String>;

#[tauri::command]
pub async fn activate_ai_session(
    working_dir: String,
    session_id: String,
    state: State<'_, AiState>,
) -> Result<(), String>;

#[tauri::command]
pub async fn delete_ai_session(
    working_dir: String,
    session_id: String,
    state: State<'_, AiState>,
) -> Result<(), String>;

#[tauri::command]
pub async fn clear_ai_session(
    working_dir: String,
    session_id: String,
    state: State<'_, AiState>,
) -> Result<(), String>;

#[tauri::command]
pub async fn send_ai_message(
    message: String,
    state: State<'_, AiState>,
    window: Window,
) -> Result<serde_json::Value, String>;
```

### 为什么 `send_ai_message` 不需要再带 `working_dir`

因为在最终方案里：
- `working_dir` 已在 `activate_ai_session` / `create_new_session` 时被绑定到 runtime state
- 发送消息只依赖“当前已激活 session”
- 如果仍要求 send 时传 `working_dir`，说明激活模型没有真正建立起来

---

## 20.2 前端 TypeScript 接口建议

```ts
export interface AiSessionMetadata {
  id: string
  title: string
  created_at: string
  updated_at: string
  last_message_at?: string | null
  message_count: number
  workspace_path: string
  model?: string | null
  provider_id?: string | null
}

export interface AiToolCall {
  id: string
  tool: string
  action: string
  input?: string | null
  output?: string | null
  status: string
  duration?: number | null
  start_time: string
  end_time?: string | null
}

export interface AiMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thinking?: string | null
  thinking_complete?: boolean | null
  status?: string | null
  request_id?: string | null
  sequence_no: number
  created_at: string
  updated_at: string
  tool_calls?: AiToolCall[]
}

export interface LoadedAiSession {
  session: AiSessionMetadata
  messages: AiMessage[]
}
```

对应 service 建议：

```ts
async listSessions(workingDir: string): Promise<AiSessionMetadata[]>
async loadSession(workingDir: string, sessionId: string): Promise<LoadedAiSession>
async activateSession(workingDir: string, sessionId: string): Promise<void>
async createNewSession(workingDir: string): Promise<string>
async deleteSession(workingDir: string, sessionId: string): Promise<void>
```

---

## 二十一、数据库迁移脚本建议

建议新增文件：

```text
src-tauri/migrations/004_create_ai_conversation_tables.sql
```

建议内容：

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  workspace_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_message_at TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  provider_id TEXT,
  system_prompt TEXT,
  constraints_version TEXT,
  summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_updated_at
  ON ai_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_status
  ON ai_sessions(status);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  thinking TEXT,
  thinking_complete INTEGER,
  status TEXT,
  request_id TEXT,
  sequence_no INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_session_sequence
  ON ai_messages(session_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_ai_messages_request_id
  ON ai_messages(request_id);

CREATE TABLE IF NOT EXISTS ai_tool_calls (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  action TEXT NOT NULL,
  input TEXT,
  output TEXT,
  status TEXT NOT NULL,
  duration REAL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  FOREIGN KEY (message_id) REFERENCES ai_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_message_id
  ON ai_tool_calls(message_id);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_session_id
  ON ai_tool_calls(session_id);
```

---

## 二十二、与现有模块的对接建议

## 22.1 与 `TaskDatabase` 的关系

当前 `TaskDatabase::init_schema()` 已集中加载 migration，这一点应继续保持。

建议调整：

```rust
fn init_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(include_str!("../migrations/001_create_tasks_tables.sql"))?;
    conn.execute_batch(include_str!("../migrations/002_create_accounts_table.sql"))?;
    conn.execute_batch(include_str!("../migrations/003_create_x_accounts_and_trend.sql"))?;
    conn.execute_batch(include_str!("../migrations/004_create_ai_conversation_tables.sql"))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    Ok(())
}
```

### 是否把 AI 表方法直接写进 `TaskDatabase`

这里有两种选择：

#### 方案 A：全部写进 `TaskDatabase`
优点：
- 少一个 DB 封装层
- 复用现有模式

缺点：
- `TaskDatabase` 职责会继续膨胀
- 后续 AI 逻辑越来越难维护

#### 方案 B：新增 `AiStorage`，内部复用同一个 db path
优点：
- 职责更清楚
- AI 与任务系统边界更清晰

缺点：
- 会多一层封装

### 本文建议

**推荐方案 B。**

原因很简单：AI conversation 已经是一个独立数据域，不应该继续把 `TaskDatabase` 做成“所有表的万能仓库”。

---

## 22.2 与 workspace 命令模块的关系

当前 `workspace.rs` 仍然维护 `config.json` 中的 `current_workspace`。这和更早的全局配置重构文档有耦合，但不阻塞本次 AI 对话重构。

本次 AI 方案里，对 workspace 模块的最低要求只有两个：

1. 能拿到当前运行中的 workspace path
2. 能确保 `<workspace>/.tweetpilot/` 已存在

也就是说，本次 AI 重构不要求先完成整个 workspace 配置体系改造；只需要复用它提供的当前工作区能力即可。

---

## 二十三、`ClaurstSession` 重构边界

`ClaurstSession` 当前既承担：
- 运行时消息数组管理
- provider 调用
- 工具执行
- 历史消息加载
- 存储落盘

这会让后续 workspace-DB 方案很难落地。

### 建议明确边界

#### `ClaurstSession` 应负责
- 内存中的 message 序列
- provider 请求发送
- 流式事件派发
- 工具执行生命周期

#### `ClaurstSession` 不应负责
- 自己决定从哪里加载历史消息
- 自己决定把消息写到什么存储
- 自己扫描 `~/.tweetpilot/conversations`

### 建议改造方式

把它变成一个纯运行时对象：

```rust
pub struct ClaurstSession {
    session_id: String,
    working_dir: PathBuf,
    client: AnthropicClient,
    config: QueryConfig,
    messages: Vec<Message>,
    tools: Vec<Box<dyn Tool>>,
    context: ToolContext,
    cost_tracker: Arc<CostTracker>,
}
```

把旧的：
- `ConversationStorage`
- 与 JSONL 相关的自动读写

从 `ClaurstSession` 中抽离出去。

---

## 二十五、运行时生命周期与状态机

这一节补足“implementation-ready”最关键但前文还不够明确的部分：

- 什么时刻创建 runtime session
- 什么时刻只读 DB、不改 runtime
- 什么时刻必须清空 runtime
- 什么时刻允许发送

如果这些边界不写清楚，后续实现时很容易再次出现：
- 前端以为 session 已切换
- 后端实际仍停留在旧 session
- UI / DB / runtime 三者错位

### 25.1 runtime state 最小语义

建议把后端 AI 运行态统一理解成下面这组状态：

```rust
pub struct AiState {
    pub workspace_path: Arc<Mutex<Option<String>>>,
    pub active_session_id: Arc<Mutex<Option<String>>>,
    pub session: Arc<Mutex<Option<ClaurstSession>>>,
    pub cancel_token: Arc<Mutex<Option<CancellationToken>>>,
    pub active_request_id: Arc<Mutex<Option<String>>>,
}
```

其中每个字段的语义必须固定：

- `workspace_path`：当前 runtime session 所属 workspace
- `active_session_id`：当前 runtime session 对应的 session id
- `session`：真正可发送请求的内存态 `ClaurstSession`
- `cancel_token`：仅对当前 in-flight request 有效
- `active_request_id`：仅对当前 in-flight request 有效

### 25.2 必须维持的不变量

后端代码中要明确维护这些不变量：

1. `session.is_some()` 时，`workspace_path.is_some()` 必须成立
2. `session.is_some()` 时，`active_session_id.is_some()` 必须成立
3. `active_request_id.is_some()` 时，`session.is_some()` 必须成立
4. 切换到另一个 workspace 时，旧 `session` / `active_session_id` / `active_request_id` / `cancel_token` 必须一起清空
5. 删除当前活跃 session 时，runtime state 必须一起清空
6. `send_ai_message()` 只能在 `session + workspace_path + active_session_id` 三者同时存在时执行

实现上不要只“尽量保持一致”，而是要在命令入口显式校验，不满足就立即返回错误。

### 25.3 状态转换规则

#### 状态 A：无活跃 runtime

```text
workspace_path = None
active_session_id = None
session = None
active_request_id = None
cancel_token = None
```

允许操作：
- `list_ai_sessions`
- `load_ai_session`
- `create_new_session`
- `activate_ai_session`

不允许操作：
- `send_ai_message`
- `cancel_ai_message`

#### 状态 B：已有活跃 session，但无进行中的请求

```text
workspace_path = Some(...)
active_session_id = Some(...)
session = Some(...)
active_request_id = None
cancel_token = None
```

允许操作：
- `send_ai_message`
- `load_ai_session`
- `delete_ai_session`（若删当前 session，先清 runtime）
- `activate_ai_session`（切到另一个 session）

#### 状态 C：已有活跃 session，且请求进行中

```text
workspace_path = Some(...)
active_session_id = Some(...)
session = Some(...)
active_request_id = Some(...)
cancel_token = Some(...)
```

允许操作：
- 流式接收 chunk / thinking / tool call event
- `cancel_ai_message`

不建议允许：
- 请求尚未结束时切换 session
- 请求尚未结束时切换 workspace
- 请求尚未结束时删除当前 session

### 25.4 并发策略

本次实现建议采用**单活跃请求模型**，不要同时支持同一窗口内多个 AI 请求并行。

也就是说：
- 同一时刻只允许一个 `active_request_id`
- 若已有请求进行中，新的 `send_ai_message` 应立即报错或直接拒绝
- 前端按钮层面也应同步禁用重复发送

这样可以显著降低：
- assistant 占位消息串流写错行
- tool call 写入错 message
- request_end 回写到过期 session

这是当前产品阶段最合适的复杂度。

---

## 二十六、命令级行为契约

这里定义每个核心命令的精确职责，避免“一个命令做一半，另一半靠前端补偿”。

### 26.1 `create_new_session(working_dir)`

#### 输入前置条件
- `working_dir` 存在
- `<working_dir>/.tweetpilot/tweetpilot.db` 可打开
- AI provider 配置存在且有 active provider

#### 执行步骤
1. 校验 workspace 路径
2. 打开该 workspace DB
3. 读取当前 active provider
4. 基于当前 workspace 生成 system prompt
5. 生成 `session_id`
6. 在 `ai_sessions` 插入新 session 记录
7. 创建空的 runtime `ClaurstSession`
8. 用新 session 覆盖 `AiState`
9. 清空旧 `active_request_id` / `cancel_token`
10. 返回 `session_id`

#### 成功后保证
- DB 中已有该 session metadata
- runtime 已切到该 session
- 此时可以直接 `send_ai_message`

#### 失败回滚原则
- 如果 DB insert 失败，则不得更新 runtime
- 如果 runtime 构建失败，则建议删除刚插入的 session metadata，避免产生空壳 session

### 26.2 `list_ai_sessions(working_dir)`

#### 职责
- 只做该 workspace DB 下的列表查询
- 不读取 runtime state
- 不修改 runtime state

#### 设计要求
这是一个纯查询命令，禁止顺手做激活、恢复、修复状态之类的副作用。

### 26.3 `load_ai_session(working_dir, session_id)`

#### 职责
- 从该 workspace DB 读取 session metadata
- 读取 messages + tool_calls
- 返回给前端渲染

#### 设计要求
- `load` 是**数据读取命令**
- 它不负责建立 runtime session
- 它不修改 `AiState`

这点要刻意坚持，否则 `load` 和 `activate` 的边界又会重新混乱。

### 26.4 `activate_ai_session(working_dir, session_id)`

#### 输入前置条件
- `working_dir` 存在
- session 在该 workspace DB 中存在
- 当前没有 in-flight request；若有，先拒绝或要求先取消

#### 执行步骤
1. 打开 workspace DB
2. 查询 session metadata
3. 读取该 session 的全部历史消息
4. 用 session metadata 中保存的 `system_prompt` / `model` / `provider_id` 恢复运行参数
5. 构建新的 runtime `ClaurstSession`
6. 把历史消息注入 runtime session
7. 覆盖 `AiState.workspace_path`
8. 覆盖 `AiState.active_session_id`
9. 覆盖 `AiState.session`
10. 清空 `active_request_id` / `cancel_token`

#### 成功后保证
- 后端 runtime 与该 session 一致
- 后续 `send_ai_message` 不需要再补偿式激活

### 26.5 `send_ai_message(message)`

#### 输入前置条件
- `AiState.workspace_path` 存在
- `AiState.active_session_id` 存在
- `AiState.session` 存在
- 当前没有另一个 in-flight request
- `message.trim()` 非空

#### 执行步骤
1. 生成 `request_id`
2. 在 DB 中插入 user message
3. 在 DB 中插入 assistant 占位 message，状态 `streaming`
4. 更新 `AiState.active_request_id` / `cancel_token`
5. 调用 runtime session 发送请求
6. 在 streaming 过程中持续更新 assistant message / tool_calls
7. 请求结束后写回最终 content / thinking / status
8. 更新 `ai_sessions.updated_at / last_message_at / message_count`
9. 清空 `active_request_id` / `cancel_token`

#### 失败处理要求
- 如果在真正发给 provider 之前失败，assistant 占位消息应标记为 `error` 或删除，但策略必须统一
- 如果 provider 半途中失败，assistant 占位消息保留，状态改为 `error`
- 无论哪种失败，`active_request_id` / `cancel_token` 都必须清空

### 26.6 `cancel_ai_message()`

#### 职责
- 仅取消当前 active request
- 不切换 session
- 不删除消息

#### 取消后的持久化要求
- assistant 占位消息状态改为 `cancelled`
- 已写入的 content / thinking 保留，不回滚
- 清空 `active_request_id` / `cancel_token`

### 26.7 `delete_ai_session(working_dir, session_id)`

#### 执责
- 只删除当前 workspace DB 中该 session
- 依赖外键级联删除 messages / tool_calls

#### 特殊规则
如果删除的是当前活跃 session：
1. 若有 in-flight request，先拒绝删除或先要求取消
2. 清空 `AiState.workspace_path`
3. 清空 `AiState.active_session_id`
4. 清空 `AiState.session`
5. 清空 `AiState.active_request_id`
6. 清空 `AiState.cancel_token`

---

## 二十七、消息落库与事件关联细则

这一节补足 event 到 DB 的映射规则，避免实现时出现“事件到了但不知道写哪张表哪一行”。

### 27.1 message id 与 request id 的职责分离

建议明确：

- `message_id`：数据库主键，用于消息表关联
- `request_id`：一次 AI 请求的链路 id，用于事件归并

不要复用同一个字段同时承担两种职责。

### 27.2 一次发送建议生成两条 message 记录

每次用户发送后，固定生成：

1. 一条 `user` message
2. 一条 `assistant` placeholder message

好处：
- 流式 chunk 始终知道要更新哪一条 assistant message
- tool call 始终知道要挂在哪一条 assistant message 下
- 失败/取消时也有稳定落点

### 27.3 事件写库映射建议

#### `message-chunk`
- update assistant message 的 `content`
- `status` 保持 `streaming`
- `updated_at` 刷新

#### `thinking-chunk`
- update assistant message 的 `thinking`
- `updated_at` 刷新

#### `tool-call-start`
- insert 一条 `ai_tool_calls`
- `status = running`

#### `tool-call-end`
- update 对应 `ai_tool_calls`
- 写入 `output`
- 写入 `status`
- 写入 `duration`
- 写入 `end_time`

#### `ai-request-end`
- update assistant message：
  - `content`
  - `thinking_complete = 1`
  - `status = completed / error / cancelled`
- update session cache 字段：
  - `updated_at`
  - `last_message_at`
  - `message_count`

### 27.4 `message_count` 的计算口径

建议定义为：
- `ai_messages` 表中的 message 总数
- 即 user + assistant 都计数
- tool call 不计入 `message_count`

这样最简单，也最容易与当前 UI 理解保持一致。

---

## 二十八、Provider 配置与 session 快照策略

从当前代码现实出发，provider 配置仍然来自全局 `ai_config.json`。这一点不会阻塞本次重构，但需要在实现上写清楚边界。

### 28.1 本次不改 provider 配置归属

本次 AI 对话重构的目标是：
- 会话数据与 workspace 绑定
- runtime session 与 workspace 绑定

**不是**：
- 把 provider 配置也改成 workspace 级配置

因此当前阶段仍可继续：
- 从全局 `ai_config.json` 读取 active provider

### 28.2 为什么仍要在 `ai_sessions` 保存 provider/model 快照

因为“当前全局 active provider”未来可能变化。

如果不做快照，会出现：
- session 创建时用的是 provider A / model X
- 几天后用户把全局配置改成 provider B / model Y
- 恢复旧 session 时运行参数悄悄变化

这会让“继续同一会话”失去稳定性。

因此建议：
- `provider_id` 落库
- `model` 落库
- `system_prompt` 落库

### 28.3 恢复历史 session 时如何处理 provider 不一致

建议规则如下：

1. **优先使用 session 快照里的 model / provider_id 作为目标配置**
2. 实际发请求前，再从当前全局配置里查找对应 provider
3. 如果 provider 已不存在或被禁用：
   - `activate_ai_session` 可以仍然允许加载历史消息
   - 但应明确标记该 session 当前不可继续发送
   - `send_ai_message` 返回明确错误：缺少对应 provider 配置

这样比“激活时直接失败并连历史都看不到”更合理。

### 28.4 `system_prompt` 的使用原则

建议激活历史 session 时：
- 优先使用 `ai_sessions.system_prompt` 快照
- 只有在该字段为空的极少数异常场景，才退回重新生成

这样可以最大程度保证历史上下文稳定。

---

## 二十九、临时补丁回收顺序

为了避免实现过程中“新方案未落地，旧补丁先删了”导致再次回归，建议按顺序回收临时补丁。

### 必须最后再删的补丁

1. 前端发送前的补偿式 `activateSession()`
2. 当前基于前端补传 `working_dir` 的 stopgap 恢复路径
3. `ConversationStorage` 旧 JSONL 依赖

### 正确回收顺序

#### Step 1
先让下面这些能力全部落地并通过测试：
- workspace DB 建表
- session list/load/delete 走 DB
- `activate_ai_session` 可从 DB 正确恢复 runtime
- `send_ai_message` 可全程增量持久化到 DB

#### Step 2
确认上面稳定后，再删：
- `handleSend()` 里的补偿式 `activateSession()`
- `ClaurstSession` 中旧 `ConversationStorage` 读写

#### Step 3
最后再清理：
- 旧 JSONL 类型定义
- 旧 global conversations 引用
- 临时诊断日志

这样可以避免在迁移中途把可用止血补丁过早拆掉。

---

## 三十、实施 checklist

为了方便直接开工，下面给出按阶段拆开的 checklist。

## Phase 1 checklist

- [ ] 新增 `004_create_ai_conversation_tables.sql`
- [ ] 在 `task_database.rs` 中接入 migration 004
- [ ] 新建 `src-tauri/src/services/ai_storage.rs`
- [ ] 定义 `AiSessionRow` / `AiMessageRow` / `AiToolCallRow`
- [ ] 定义 `LoadedAiSession`
- [ ] 完成 `create/list/load/delete/clear` 数据库实现
- [ ] 停止新增对 `~/.tweetpilot/conversations` 的读写引用

## Phase 2 checklist

- [ ] 扩展 `AiState`，加入 `workspace_path`
- [ ] 扩展 `AiState`，加入 `active_session_id`
- [ ] `create_new_session` 改为先写 DB 再激活 runtime session
- [ ] `activate_ai_session` 改为从 workspace DB 恢复
- [ ] `send_ai_message` 接入 DB 增量持久化
- [ ] assistant message 流式更新写回 DB
- [ ] tool call start/end 写回 DB
- [ ] `delete_ai_session` 删除当前活跃 session 时同步清理 runtime state

## Phase 3 checklist

- [ ] `ChatInterface` 会话列表改为显式 workspace 作用域
- [ ] workspace 切换时清空当前聊天状态
- [ ] `handleSend()` 移除补偿式 `activateSession()`
- [ ] 清理旧 JSONL 类型定义与前端兼容逻辑
- [ ] 补齐前端测试与手工回归

---

## 三十一、当前未提交补丁与最终方案的关系

为了避免实现时反复犹豫，这里明确记录当前结论：

### 可以保留的补丁
- IME 输入法防误发送修复
- `send_ai_message` 在无 active session 时立即报错
- 事件监听中基于 `currentRequestIdRef` 避免闭包拿旧值的修复

### 需要在最终方案中回收的补丁
- 前端发送前的补偿式 `activateSession()`
- 当前 `activate_ai_session(session_id, working_dir)` 这种依赖前端补传 `working_dir` 的恢复模式
- 所有基于全局 `ConversationStorage` 的旧加载路径

这三点应视为过渡方案，而不是最终架构的一部分。

---

## 三十二、一句话总结

这次重构的本质不是“把 conversations 从文件搬到数据库”，而是：

> **把 AI 对话从“全局弱归属日志”重构为“workspace 内强归属、可恢复、可继续的正式业务数据”。**
