# TweetPilot 全局配置与会话存储重构方案

## 背景

当前 TweetPilot 在用户 Home 目录下使用 `~/.tweetpilot/` 保存全局数据，现状如下：

```text
~/.tweetpilot/
  ai_config.json
  config.json
  preferences.json
  recent-workspaces.json
  local-bridge-config.json
  conversations/
```

结合现有代码与最新产品结论，当前存在以下问题：

1. **配置过于分散**
   - 全局数据被拆成多个小 JSON 文件，职责边界不清晰。
   - `preferences.json`、`ai_config.json`、`local-bridge-config.json` 本质上都属于“应用设置”。
   - 继续拆散只会增加路径管理、默认值处理、版本迁移和调试复杂度。

2. **`config.json` 语义和落盘方式不合理**
   - 当前只保存 `current_workspace`，本质上是运行期状态，不是稳定配置。
   - 现已明确：应用启动后始终显示首页，不做跨启动恢复。
   - 在这个前提下，当前 workspace 没有继续落盘到 `config.json` 的必要，更适合改为前后端共享的运行期内存态。

3. **`recent-workspaces.json` 缺少管理能力**
   - 它当前由 `src-tauri/src/commands/workspace.rs` 维护，并为首页“最近使用”以及“查看全部工作目录”弹窗提供数据来源。
   - 这说明它并不是低价值数据，也不是应该被删除的历史包袱，而是当前工作目录选择流程的一部分。
   - 真正的问题在于：它目前只有追加/更新逻辑，没有删除能力，用户无法清理老旧目录、误选目录或本地已不存在的目录记录。

4. **会话存储使用 JSONL 文件，扩展性不足**
   - 当前 `ConversationStorage` 直接把消息 append 到 `~/.tweetpilot/conversations/*.jsonl`。
   - `list_sessions()` 需要扫描目录并逐个读取文件推导 metadata。
   - `workspace` 字段实际上没有被真正持久化，返回值里固定是空字符串。
   - 后续若增加搜索、分页、归档、统计、按 workspace 过滤，会越来越难维护。

5. **缺少统一 schema/version 机制**
   - 现在多个 JSON 文件没有统一版本治理，未来结构调整会增加兼容成本。

---

## 已确认的产品结论

以下结论已经确认，本方案必须完全以此为准：

1. **应用启动后仍然显示首页**
2. **不做跨启动恢复**
3. **删除 `config.json`**
4. **当前 workspace 改为前后端共享的运行期内存态**
5. **保留 `recent-workspaces.json`**
6. **为 `recent-workspaces.json` 增加删除单条历史记录的能力**
7. **将 `preferences.json`、`ai_config.json`、`local-bridge-config.json` 合并到 `settings.json`**
8. **不调整 AI 配置中 `api_key` 的明文存储策略，只调整文件归属**
9. **conversations 从 JSONL 升级为 SQLite 数据库管理**

这意味着后续开发时：

- 不能再把 `recent-workspaces.json` 当作“准备删除的低价值文件”
- 不能再把 `config.json` 当作需要被 `session.json` 替代的恢复态文件
- 不能再保留分散的 `ai_config.json` / `local-bridge-config.json` / `preferences.json`

本次最新结论是：

- `config.json` 直接删除
- 不引入 `session.json`
- 当前 workspace 只保留运行期内存态
- `recent-workspaces.json` 继续保留，并补齐管理能力
- `ai_config.json`、`local-bridge-config.json`、`preferences.json` 合并为单一 `settings.json`

---

## 设计目标

本次重构目标聚焦于：

1. **减少全局配置碎片化**
2. **将 `preferences.json`、`ai_config.json`、`local-bridge-config.json` 合并为统一的 `settings.json`**
3. **删除 `config.json`，将当前 workspace 改为运行期内存态管理**
4. **保留 `recent-workspaces.json`，并补齐删除记录能力**
5. **将 conversations 从 JSONL 升级为数据库管理**
6. **为未来迁移保留 schema version 和统一入口**

---

## 新目录结构

建议将 `~/.tweetpilot/` 调整为：

```text
~/.tweetpilot/
  settings.json
  recent-workspaces.json
  conversations.db
```

说明：

- `settings.json`
  - 替代原 `preferences.json`
  - 合并原 `ai_config.json`
  - 合并原 `local-bridge-config.json`
  - 统一存储用户稳定偏好、AI provider 配置、LocalBridge 配置
  - 增加 `version` 字段

- `recent-workspaces.json`
  - 保留
  - 继续存历史工作目录列表
  - 本次补齐“删除单条记录”的管理能力

- `conversations.db`
  - 替代 `conversations/*.jsonl`
  - 统一管理 AI 会话、消息、工具调用

- **删除** `config.json`
  - 不再维护该文件
  - 当前 workspace 改为运行期内存态管理

- **删除** `ai_config.json`
  - 其内容并入 `settings.json`

- **删除** `local-bridge-config.json`
  - 其内容并入 `settings.json`

- **删除** `preferences.json`
  - 其内容并入 `settings.json`

---

## 文件职责设计

## 1. settings.json

`settings.json` 成为唯一的全局配置文件，统一承载原本分散在多个 JSON 文件中的“稳定设置”。

建议结构：

```json
{
  "version": 1,
  "ui": {
    "language": "zh-CN",
    "theme": "dark",
    "startup": "workspace-selector"
  },
  "ai": {
    "active_provider": "custom-xxx",
    "providers": [
      {
        "id": "anthropic",
        "name": "Anthropic",
        "api_key": "...",
        "base_url": "https://api.anthropic.com",
        "model": "claude-sonnet-4-6",
        "enabled": true
      }
    ]
  },
  "local_bridge": {
    "endpoint": "http://127.0.0.1:10088",
    "timeout_ms": 30000,
    "sync_interval_ms": 60000
  }
}
```

### 为什么要这样合并
- `preferences.json`、`ai_config.json`、`local-bridge-config.json` 本质上都属于“系统设置 / 应用设置”。
- 继续拆成三个文件并不能带来明显收益，反而会增加路径管理、默认值处理、版本迁移和调试复杂度。
- LocalBridge 配置本来就是系统设置的一种，没有单独拆文件的必要。
- AI provider 配置虽然字段更多，但本质上仍是应用级设置，不是独立数据域。

### settings.json 适合放入的内容
- 语言
- 主题
- 启动策略
- AI provider 列表
- active provider
- AI model / base_url / api_key
- LocalBridge endpoint / timeout / sync interval
- 后续可扩展：实验特性开关、UI 偏好、默认面板开关

### settings.json 不应放入的内容
- 当前 workspace
- 最近工作区历史
- 会话消息数据

### 备注
- 本次不修改 `api_key` 明文存储策略，只是把其归属从 `ai_config.json` 调整到 `settings.json.ai`。
- `settings.json` 需要统一带 `version` 字段，为未来 schema 演进留出空间。

---

## 2. recent-workspaces.json

用于保存历史工作目录列表，并保留为独立的数据文件。

建议结构：

```json
[
  {
    "path": "/Users/xxx/project-a",
    "name": "project-a",
    "last_accessed": "2026-04-25T04:46:10.698546+00:00"
  }
]
```

### 产品定位
- 它表达的是“最近使用过哪些工作目录”，不是当前工作区状态。
- 它是首页“最近使用”区域和“查看全部工作目录”弹窗的数据来源。
- 它是用户快速回到历史工作目录的操作入口之一。
- 因此它应继续保留，不应删除。

### 当前问题
- 只能追加/更新记录，不能删除记录。
- 当目录已经废弃、本地已删除、或用户误选过目录时，无法自行清理历史。
- 当前前端还会过滤掉不存在的目录，导致“无效记录看不见，但也删不掉”的问题。

### 本次要补齐的能力
- 后端新增删除单条 recent 记录的能力。
- 前端首页最近工作目录列表增加“删除记录”按钮。
- 前端“查看全部工作目录”弹窗增加“删除记录”按钮。
- 删除后重新加载 recent 列表。
- 删除按钮点击时必须阻止冒泡，不能触发“打开工作目录”。
- 即使本地目录已经不存在，用户仍然可以手动删除该条记录。

### 交互原则
- “从最近使用中删除” ≠ “删除本地目录”
- “从最近使用中删除” ≠ “关闭当前工作区”
- 删除动作只影响 recent history，不影响真实文件系统和当前已打开 workspace
- 删除不存在的记录时允许幂等成功

### 后续可选增强
以下能力可在后续版本追加，不要求本次一起完成：

- 清理本地已不存在的目录记录
- 清空全部 recent 记录
- 在列表中标记“目录不存在”状态

---

## 3. conversations.db

将当前文件型 `ConversationStorage` 重构为数据库存储。

### 当前 JSONL 方案的实际问题

根据 `src-tauri/src/services/conversation_storage.rs`：

- `save_message()` 直接 append JSONL
- `load_messages()` 全量读取并逐行 parse
- `list_sessions()` 扫描整个目录，再对每个 `.jsonl` 文件读取元信息
- `get_session_metadata()` 实际并没有真正保存 session metadata
- `workspace` 始终为空字符串

这说明当前方案是“最低成本可用版”，但已经不适合作为长期结构。

### 数据库设计建议

建议使用 SQLite，文件位置：

```text
~/.tweetpilot/conversations.db
```

### 表结构建议

#### sessions

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  workspace TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  schema_version INTEGER NOT NULL DEFAULT 1
);
```

#### messages

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  thinking TEXT,
  thinking_complete INTEGER,
  status TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

#### tool_calls

```sql
CREATE TABLE tool_calls (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  action TEXT NOT NULL,
  input TEXT,
  output TEXT,
  status TEXT NOT NULL,
  duration REAL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
```

### 推荐索引

```sql
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX idx_sessions_workspace ON sessions(workspace);
CREATE INDEX idx_messages_session_id_timestamp ON messages(session_id, timestamp);
CREATE INDEX idx_tool_calls_message_id ON tool_calls(message_id);
```

### 收益

1. `list_sessions()` 不需要扫目录
2. 支持分页、排序、按 workspace 过滤
3. 可以准确维护 metadata，而不是临时推导
4. 后续支持搜索、归档、统计、清理更自然
5. 删除 session 时可级联删除 message / tool_call

---

## 当前 workspace 的状态管理结论

## 结论：当前产品已经明确“启动后总是进入首页，不做跨启动恢复”，因此 `config.json` 应删除，当前 workspace 改为纯运行期内存态管理

### 产品前提

当前已确认的产品结论是：

1. **启动后仍然显示首页**
2. **不做跨启动恢复**
3. **当前 workspace 不再需要落盘保存**

这意味着：

- 应用关闭再启动后，不需要自动恢复上次工作目录
- 当前工作目录只需要在“本次运行周期内”可用
- `config.json` 不再有继续存在的产品价值

### 当前代码现实

截至当前代码状态，workspace 相关逻辑对 `config.json` 的依赖比早期讨论时更明确，主要体现在 `src-tauri/src/commands/workspace.rs`：

- `WORKSPACE_CONFIG_FILE` 仍然定义为 `config.json`
- `set_current_workspace()` 结束时仍会调用 `persist_current_workspace(path)`
- `persist_current_workspace()` 会同时：
  - 写入 `config.json.current_workspace`
  - 更新 `recent-workspaces.json`
- `get_current_workspace()` 当前直接从 `config.json` 读取
- `clear_current_workspace_command()` 当前也还是通过清空 `config.json` 中的字段来完成“清空当前 workspace”

这说明当前 `config.json` 不只是“历史残留文件”，而是仍然参与了当前 workspace 生命周期。

因此后续开发不能把“删除 `config.json`”理解成简单删文件，而应理解为：

- 把后端当前 workspace 的真实来源从磁盘文件切换到运行期 state
- 把 `set_current_workspace()` / `get_current_workspace()` / `clear_current_workspace_command()` 一起改造到新的运行期状态模型
- 让 `recent-workspaces.json` 的维护逻辑与“当前 workspace 状态”解耦

### 前端当前状态补充

截至当前代码状态，前端启动流程已经部分符合新产品结论：

- `src/App.tsx` 启动时已经不再自动调用 `get_current_workspace()` 恢复工作目录
- 当前逻辑是启动后直接显示 workspace selector

但当前前端还保留了一层运行期桥接：

- 在窗口切换/刷新场景下，会通过 `sessionStorage` 暂存 `pending-workspace-path`
- 然后在页面重新加载后恢复本次运行内的前端状态

这不属于“跨启动恢复”，但说明当前前端运行期状态并不只有 React state，还混合了临时的 `sessionStorage` 桥接机制。

后续在实现统一的运行期 workspace state 时，需要把这部分一并纳入边界设计。

### 为什么可以去掉 `config.json`

因为当前场景下，`config.json` 原本承担的用途已经不再成立：

1. **跨启动恢复**
   - 已明确不需要

2. **后端当前 workspace 来源**
   - 可以改为后端运行期 state
   - 不需要继续依赖磁盘文件作为当前 workspace 来源

### 新的职责边界

- **settings.json**
  - 稳定应用设置
- **recent-workspaces.json**
  - 历史工作目录列表
- **前端/后端运行期状态**
  - 当前运行中的 workspace
- **conversations.db**
  - AI 会话数据

换句话说：

- `current workspace` 不属于 settings
- `current workspace` 不再属于独立磁盘配置文件
- 它只属于运行期状态

---

## 统一存储层建议

当前不同模块各自直接通过文件名读写 JSON，后续建议统一到一个全局存储层。

### 当前分散情况
- `workspace.rs` 自己管理 `config.json` / `recent-workspaces.json`
- `preferences.rs` 自己管理 `preferences.json` / `local-bridge-config.json`
- `ai_config.rs` 单独管理 `ai_config.json`
- conversations 相关能力正在逐步从旧文件型存储向数据库化方向演进

### 当前代码中的额外现实

除了文件分散之外，当前代码里还有几个会影响重构顺序的重要事实：

1. **preferences 默认值仍带有旧恢复语义**
   - `src-tauri/src/commands/preferences.rs` 中，`startup` 默认值当前仍是 `last-workspace`
   - 这与“启动后始终首页、不做跨启动恢复”的最新产品结论不一致
   - 后续改造时需要明确：
     - 是保留 `startup` 字段但调整语义
     - 还是彻底移除该字段

2. **recent 列表当前仍在前端过滤不存在目录**
   - `src/pages/WorkspaceSelector.tsx` 当前会对 `getRecentWorkspaces()` 的结果逐条调用 `checkDirectoryExists()`
   - 不存在的目录会被直接过滤掉
   - 这会导致“记录还在，但用户看不见也删不掉”的问题仍然存在

3. **recent 删除能力当前还没有真正落地**
   - 当前后端只有 `load_recent_workspaces()` / `save_recent_workspaces()` / `update_recent_workspaces()`
   - 尚无 `remove_recent_workspace()`
   - 当前前端 service 也尚无 `deleteRecentWorkspace()`
   - 当前首页和“查看全部工作目录”弹窗中也都还没有删除按钮

4. **workspace 运行期状态当前并不统一**
   - 后端仍以 `config.json` 作为 current workspace 的持久化来源
   - 前端则已经改成“启动后始终显示首页”，但仍保留 `sessionStorage` 作为窗口切换/刷新时的临时桥接
   - 因此本次并不是单纯删文件，而是要真正统一 runtime state 的来源

### 本次重构后的分层目标
- `settings.json` 统一承载原 `preferences.json`、`ai_config.json`、`local-bridge-config.json`
- `recent-workspaces.json` 继续承载历史工作目录列表
- 运行期 workspace 由 app state / runtime state 管理
- `conversations.db` 承载 AI 会话数据

### 关于 `recent-workspaces.json` 的产品定位补充

这里需要再次明确：`recent-workspaces.json` 不是“可有可无的顺带记录”，而是当前首页与工作目录选择流程的一部分。

它承载的是：

- 首页“最近使用”入口
- “查看全部工作目录”弹窗的数据来源
- 用户快速回到历史工作目录的操作路径

因此本次文档的结论不是“弱化 recent-workspaces”，而是：

- **保留该文件**
- **保留 recent history 机制**
- **补齐删除记录能力**
- **让历史记录从不可管理变为可管理**

### 建议方向

新增统一的全局存储模块，例如：

```text
src-tauri/src/services/global_store/
  mod.rs
  settings_store.rs
  conversation_store.rs
  recent_workspaces_store.rs
```

或最小方案：

```text
src-tauri/src/services/
  settings_store.rs
  conversation_store.rs
  recent_workspaces_store.rs
```

### 统一存储层负责
- 路径管理
- 默认值填充
- schema version 校验
- 未来结构演进支持
- 读写错误统一处理

运行期内存态的 workspace 可单独由 app state / runtime state 管理，不需要再并入磁盘存储层。

---

## 落地方式说明

本方案面向新开发系统设计，不承担旧版本兼容义务。

这意味着：

- 不需要兼容 `preferences.json`
- 不需要兼容 `ai_config.json`
- 不需要兼容 `local-bridge-config.json`
- 不需要兼容 `config.json`
- 不需要兼容 `conversations/*.jsonl`
- 不需要为旧结构保留过渡期读取逻辑
- 不需要设计旧数据迁移、备份、回写方案

本次开发应直接以目标结构落地：

- 全局配置只使用 `settings.json`
- recent history 只使用 `recent-workspaces.json`
- 当前 workspace 只使用运行期内存态
- 会话存储只使用 `conversations.db`

---

## 实施顺序建议

### 第一步：先重构 workspace 运行期状态
1. 从 `workspace.rs` 中拆掉 `config.json` 作为 current workspace 来源的职责
2. 将 `set_current_workspace()` / `get_current_workspace()` / `clear_current_workspace_command()` 收敛到统一的运行期状态模型
3. 明确前端与后端之间 current workspace 的同步方式
4. 收敛或移除 `sessionStorage` 的临时桥接逻辑

### 第二步：收敛全局配置文件结构
5. 新增统一的 `settings.json`
6. 将 UI 配置、AI 配置、LocalBridge 配置统一收敛到 `settings.json`
7. 明确 `startup` 字段是重定义还是删除，避免继续带入 `last-workspace` 语义
8. 抽出统一 store 层

### 第三步：补齐 recent history 管理能力
9. 保留 `recent-workspaces.json`，并补齐删除记录能力
10. 去掉“只展示存在目录”的静默过滤策略
11. 让不可用记录仍然可见、可删

### 第四步：重构会话存储
12. 设计并落地 `conversations.db`
13. 为 `ConversationStorage` 提供数据库实现
14. 直接移除 JSONL 方案，不再引入兼容迁移逻辑

### 第五步：清理旧代码
15. 删除 `config.json` 相关实现
16. 删除 `ai_config.json` / `local-bridge-config.json` / `preferences.json` 相关实现
17. 删除 `conversations/` 文件存储实现

---

## 面向开发的具体改动清单

### A. 当前 workspace 运行期状态改造

#### 后端
涉及文件：
- `src-tauri/src/commands/workspace.rs`
- 可能新增 app state / runtime state 相关模块

需要完成：
- 去掉 `config.json` 作为 current workspace 来源的职责
- 将当前 workspace 改为运行期 app state / runtime state 管理
- 将 `set_current_workspace()` 改为只更新运行期状态，并保留 recent history 更新逻辑
- 将 `get_current_workspace()` 改为从运行期状态读取
- 将 `clear_current_workspace_command()` 改为清空运行期状态
- 重新梳理 current workspace 与 recent history 的职责边界

#### 前端
涉及文件：
- `src/App.tsx`
- `src/services/workspace/tauri.ts`

需要完成：
- 保持当前 workspace 为运行期状态
- 与后端运行期状态保持同步
- 启动后始终显示 workspace selector，不做恢复
- 评估并收敛当前 `sessionStorage` 的 `pending-workspace-path` 临时桥接逻辑，避免形成第二套状态来源

### B. `settings.json` 合并改造

#### 后端
涉及文件：
- `src-tauri/src/commands/preferences.rs`
- `src-tauri/src/services/ai_config.rs`
- 与 LocalBridge 配置相关的读写文件
- 建议新增：`src-tauri/src/services/settings_store.rs`

需要完成：
- 新增统一的 `settings.json` 读写入口
- 将原 UI 配置收敛到 `settings.ui`
- 将原 AI 配置收敛到 `settings.ai`
- 将原 LocalBridge 配置收敛到 `settings.local_bridge`
- 增加 `version` 字段
- 删除旧分散配置文件对应的长期实现
- 明确处理当前 `startup` 字段：
  - 若保留，则需改掉 `last-workspace` 语义
  - 若不保留，则在合并时一并移除

#### 前端
涉及文件：
- `src/services/settings/tauri.ts`
- `src/services/settings/types.ts`

需要完成：
- 所有原本分别读取 preferences / ai_config / local_bridge 的调用，逐步改为读取统一 settings 结构
- 保持字段语义不变，先改存储入口，再逐步收敛调用点
- 避免继续把 startup 恢复语义带入新 settings 结构

### C. `recent-workspaces.json` 相关改动

#### 后端
涉及文件：
- `src-tauri/src/commands/workspace.rs`

需要完成：
- 保留 `RECENT_WORKSPACES_FILE`
- 保留 `WorkspaceHistory`
- 保留 `load_recent_workspaces()`
- 保留 `save_recent_workspaces()`
- 保留 `update_recent_workspaces()`
- 新增 `remove_recent_workspace(path: &str)`
- 新增 tauri command：`delete_recent_workspace(path: String)`
- 删除不存在记录时允许幂等成功

#### 前端 service
涉及文件：
- `src/services/workspace/types.ts`
- `src/services/workspace/tauri.ts`

需要完成：
- 在 `WorkspaceService` 中新增 `deleteRecentWorkspace(path: string): Promise<void>`
- 在 tauri service 中增加对应 invoke 封装

#### 前端 UI
涉及文件：
- `src/pages/WorkspaceSelector.tsx`

需要完成：
- 去掉“只展示存在目录”的静默过滤策略，至少不能让不可用记录彻底消失
- 首页“最近使用”列表项增加删除按钮
- “查看全部工作目录”弹窗列表项增加删除按钮
- 删除按钮点击时阻止冒泡
- 删除后刷新 `getRecentWorkspaces()`
- 对本地已不存在目录的记录，仍提供删除入口

### D. conversations 数据库化

涉及文件：
- `src-tauri/src/services/conversation_storage.rs`
- 可能新增数据库 store / repository 文件
- 相关 AI/session 设计文档

需要完成：
- 将 JSONL 存储改为 SQLite
- 增加 sessions / messages / tool_calls 表
- 直接以数据库结构作为正式实现
- 注意与 `docs/ai-workspace-bound-session-db-redesign.md` 的边界保持一致，避免两份文档对同一层职责给出冲突定义

---

## 风险与注意事项

### 1. 不要低估 `config.json` 与 workspace 生命周期的耦合
当前代码里，`config.json` 不是单纯的“启动恢复文件”，它仍然参与：

- `set_current_workspace()` 的持久化收尾
- `get_current_workspace()` 的读取来源
- `clear_current_workspace_command()` 的清理逻辑

因此删除 `config.json` 不是单点替换，而是一次 workspace runtime state 重构。

### 2. 不要一次性改太多调用层
- 优先先梳理 workspace runtime state 来源
- 再收敛 settings store
- 再补 recent history 管理能力
- 最后处理 conversations 数据库化

### 3. settings / recent / runtime state 边界要严格
- `settings` = 用户偏好 + AI 配置 + LocalBridge 配置
- `recent-workspaces` = 历史工作目录列表
- `runtime state` = 当前运行中的 workspace
- 不要再次把这三类数据混进同一个 `config.json`

### 4. `startup` 字段不能原样带入新结构
当前 `preferences.rs` 的默认值仍然是 `last-workspace`，这与“启动后始终首页，不做跨启动恢复”冲突。

因此后续实现时必须明确：
- 要么移除 `startup`
- 要么保留字段但重定义语义与默认值

### 5. recent 列表不要再“静默丢弃问题”
当前前端对不存在目录会直接过滤，这虽然能避免展示坏数据，但也掩盖了“记录仍然存在却无法清理”的问题。

后续实现时应注意：
- 可以展示“目录不存在”状态
- 或至少保留删除入口
- 不应只做静默过滤后结束

### 6. 运行期 workspace 状态来源要唯一
当前前端已有 `sessionStorage` 的 `pending-workspace-path` 临时桥接逻辑。

后续实现时要避免出现：
- 后端 runtime state 一套
- 前端 React state 一套
- `sessionStorage` 再一套

应尽量收敛为单一可信状态来源，只在确有必要时保留最小桥接。

### 7. settings 合并要保持字段语义稳定
- 本次是“文件合并”，不是“业务语义重写”
- 应尽量保持现有 AI 配置字段、LocalBridge 配置字段、UI 配置字段语义不变
- 优先解决“入口统一”和“存储集中”，避免一次性引入过多字段重命名

### 8. conversations 需要明确 workspace 归属与文档边界
当前 AI session 已经落在每个 workspace 自己的 SQLite 中，也就是：
- `<workspace>/.tweetpilot/tweetpilot.db`
- `ai_sessions` / `ai_messages` / `ai_tool_calls` / `ai_message_timeline_items` 都在这个 workspace-local DB 里

当前返回给前端的 `SessionMetadata.workspace` 不是 `ai_sessions` 表里的真实列，而是后端在读取当前 workspace 数据库后补上的派生字段，用来告诉 UI“这批 session 属于哪个 workspace 查询上下文”。

因此这里的边界应该明确成：
- workspace 归属当前已经通过“按 workspace 分库”成立，不依赖额外的全局 conversations 目录
- 如果后续需要更强的导出、诊断或跨库校验能力，再单独评估是否值得把 workspace 路径作为真实列落库
- 本文档只定义全局存储与会话存储的总体方向
- 更细的 AI/session 数据模型应与 `docs/ai-workspace-bound-session-db-redesign.md` 保持一致

---

## 最终建议结论

基于最新需求与当前代码现实，推荐方案如下：

### 保留
- `settings.json`
- `recent-workspaces.json`（补齐删除记录等管理能力）

### 替换
- `preferences.json` → `settings.json`
- `ai_config.json` → `settings.json`
- `local-bridge-config.json` → `settings.json`
- `conversations/*.jsonl` → `conversations.db`

### 删除
- `config.json`
- `preferences.json`
- `ai_config.json`
- `local-bridge-config.json`

### 架构方向
- 引入统一全局存储层
- `settings.json` 作为唯一全局配置文件
- 当前 workspace 改为前后端共享的运行期状态
- recent history 保持独立文件并可管理
- 应用启动后始终显示首页，不做跨启动恢复
- 会话改为 SQLite 管理
- recent workspaces 从“被动记录”升级为“可管理历史列表”

### 实施重点
- 先重构 workspace runtime state，再删除 `config.json` 依赖
- 再收敛 `settings.json`
- 再补齐 recent workspaces 删除能力与不可用记录处理
- 最后推进 conversations 数据库化

这样可以把当前“零散 JSON + 文件型会话存储 + 磁盘 current workspace”的方案，整理成“配置清晰、运行态边界明确、会话可扩展、recent history 可管理”的长期结构。
