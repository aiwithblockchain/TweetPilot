# TweetPilot 全局配置与会话存储技术说明

## 文档信息

- **类型**: 技术描述文档
- **来源**: 由原“全局配置与会话存储重构方案”整理归档
- **更新时间**: 2026-04-27
- **目的**: 描述当前代码库中全局配置、运行期 workspace 状态、recent workspaces，以及 AI 会话存储的实际实现边界

---

## 1. 概览

当前实现可分为三层：

```text
全局持久化
  ~/.tweetpilot/settings.json
  ~/.tweetpilot/recent-workspaces.json

运行期状态
  current workspace
  per-window AI runtime
  active session / active request

workspace-local 持久化
  <workspace>/.tweetpilot/tweetpilot.db
```

对应关系如下：

- `settings.json` 保存应用级稳定配置
- `recent-workspaces.json` 保存最近使用的工作目录历史
- current workspace 属于运行期状态，不写入全局配置
- AI 会话、消息、工具调用等业务数据保存在 workspace-local SQLite 中

---

## 2. 全局持久化

### 2.1 settings.json

当前统一配置文件为：

```text
~/.tweetpilot/settings.json
```

核心实现位于：

- `src-tauri/src/services/settings_store.rs`
- `src-tauri/src/commands/preferences.rs`
- `src-tauri/src/services/ai_config.rs`

当前配置结构已经收口为：

```json
{
  "version": 1,
  "ui": {
    "language": "zh-CN",
    "theme": "dark",
    "startup": "workspace-selector"
  },
  "ai": {
    "active_provider": "...",
    "providers": []
  },
  "local_bridge": {
    "endpoint": "...",
    "timeout_ms": 30000,
    "sync_interval_ms": 60000
  }
}
```

说明：

- `preferences.json` 已并入 `settings.json`
- `ai_config.json` 已并入 `settings.json`
- `local-bridge-config.json` 已并入 `settings.json`
- `ui.startup` 已被归一化为 `workspace-selector`

### 2.2 recent-workspaces.json

最近工作目录历史位于：

```text
~/.tweetpilot/recent-workspaces.json
```

核心实现位于：

- `src-tauri/src/commands/workspace.rs`
- `src/pages/WorkspaceSelector.tsx`

当前职责：

- 首页最近工作目录列表的数据来源
- 工作目录历史记录的数据来源
- 当前窗口切换 workspace 的历史入口

当前行为：

- recent 记录保留为历史数据
- 删除 recent 记录不会删除本地目录
- 不存在的目录仍保留记录，并允许删除

---

## 3. 运行期 workspace 状态

current workspace 不是全局持久化配置，而是运行期状态。

核心实现位于：

- `src-tauri/src/commands/workspace.rs`
- `src/App.tsx`

后端运行期状态结构：

```rust
pub struct RuntimeWorkspaceState {
    current_workspaces: Arc<Mutex<HashMap<String, String>>>,
}
```

关键命令：

- `set_current_workspace`
- `get_current_workspace`
- `clear_current_workspace_command`

说明：

- current workspace 按窗口 label 记录在运行期内存中
- 不写入 `settings.json`
- 不写入 `recent-workspaces.json`
- 关闭应用后自然失效

前端启动链路：

- `src/App.tsx` 启动时调用 `get_current_workspace`
- 若当前运行期存在 workspace，则恢复当前窗口状态
- 若不存在，则进入 `WorkspaceSelector`
- 前端仅监听 `workspace-changed` 事件作为当前运行期内切换入口

---

## 4. workspace-local AI 数据存储

AI 会话与消息的正式持久化位置为：

```text
<workspace>/.tweetpilot/tweetpilot.db
```

核心实现位于：

- `src-tauri/src/services/ai_storage.rs`
- `src-tauri/src/commands/ai.rs`
- `src/services/ai/tauri.ts`

数据库路径由 workspace 决定：

```rust
let db_path = working_dir.join(".tweetpilot").join("tweetpilot.db");
```

这意味着：

- 一个 workspace 对应一份独立数据库
- 不同 workspace 的 AI 会话天然隔离
- AI session / message / tool timeline 属于 workspace 业务数据，而不是全局配置数据

---

## 5. AI 运行期状态

AI 运行期状态已经按窗口组织。

核心结构位于后端 AI state：

```rust
pub struct AiState {
    pub windows: Arc<Mutex<HashMap<String, WindowAiRuntimeState>>>,
}
```

运行期内按窗口管理的内容包括：

- active session
- active request
- cancel token
- active working dir

这部分状态只负责本次运行中的交互状态，不承担跨启动持久化职责。

---

## 6. 当前实现边界

从实现角度，当前代码库的边界可以总结为：

1. 全局目录只保存稳定配置和历史记录
2. current workspace 只属于运行期状态
3. AI 会话与消息保存到 workspace-local SQLite
4. AI runtime 按窗口组织
5. recent workspaces 是历史入口，不等于当前 workspace

---

## 7. 与旧设计记录的差异

下面这些旧描述已经不再代表当前实现：

- `config.json` 负责 current workspace 恢复
- conversations 保存在 `~/.tweetpilot/conversations/*.jsonl`
- conversations 将迁移到全局 `~/.tweetpilot/conversations.db`
- recent 删除能力尚未实现
- 不存在目录会被前端静默过滤

当前代码已经完成了这些边界收口，因此后续实现应以本文件描述的实际结构为准。
