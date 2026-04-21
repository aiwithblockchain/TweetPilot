# TweetPilot AI 集成方案

**文档版本**: 2.0  
**创建日期**: 2026-04-21  
**参考项目**: microcompany (Claurst 集成实现)

---

## 一、项目背景

TweetPilot 需要集成 AI 对话功能,帮助用户:
1. 理解和使用当前工作目录下的 Python 脚本
2. 为每个推特账号配置固定的 AI 会话,提供个性化的脚本建议

**核心原则**: 简单实用,第一阶段只实现基础会话功能和模型配置。

---

## 二、集成目标

### 2.1 第一阶段目标 (MVP)

- ✅ **单一会话模式** - 用户可以与 AI 讨论当前目录下的脚本
- ✅ **工作目录上下文** - AI 能感知当前工作目录的文件和脚本
- ✅ **模型配置** - 用户可以配置 API Key、模型、Base URL
- ✅ **基础工具能力** - Read、Edit、Write、Bash、Glob、Grep
- ✅ **流式响应** - 实时显示 AI 回复
- ✅ **会话持久化** - 保存对话历史

### 2.2 第二阶段目标 (未来)

- ⏳ **账号级会话** - 每个推特账号有独立的 AI 会话
- ⏳ **脚本生成** - AI 生成 Python 脚本到工作目录
- ⏳ **脚本解释** - AI 解释脚本功能和用法

---

## 三、技术架构

### 3.1 整体架构 (参考 microcompany)

```
┌─────────────────────────────────────────────────────────┐
│                  TweetPilot (Tauri)                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         React Frontend (TypeScript)              │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  ChatInterface (复用 microcompany)        │  │  │
│  │  │  - 消息显示(流式)                          │  │  │
│  │  │  - 工具调用指示器                          │  │  │
│  │  │  - 输入框                                  │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────┬───────────────────────────────────┘  │
│                 │ Tauri Commands + Events               │
│                 │                                       │
│  ┌──────────────▼───────────────────────────────────┐  │
│  │         Rust Backend (Tauri)                     │  │
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐ │  │
│  │  │  ClaurstSession (封装层)                   │ │  │
│  │  │  - 会话管理                                 │ │  │
│  │  │  - 消息处理                                 │ │  │
│  │  │  - 流式响应转发                             │ │  │
│  │  │  - 工具调用协调                             │ │  │
│  │  └──────────┬─────────────────────────────────┘ │  │
│  │             │                                    │  │
│  │  ┌──────────▼─────────────────────────────────┐ │  │
│  │  │  Claurst Crates (作为 submodule)          │ │  │
│  │  │  - claurst-core                            │ │  │
│  │  │  - claurst-api                             │ │  │
│  │  │  - claurst-query                           │ │  │
│  │  │  - claurst-tools                           │ │  │
│  │  └────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 数据流

#### 消息发送流程

```
用户输入消息
    ↓
前端调用 invoke('send_message', { message })
    ↓
Rust: send_message() 命令
    ↓
ClaurstSession::send_message()
    ├─ 添加用户消息到历史
    ├─ 调用 run_query_loop()
    └─ 处理流式响应
        ├─ TextDelta → window.emit('message-chunk')
        ├─ ToolUse → 执行工具 → window.emit('tool-call-start/end')
        └─ MessageStop → window.emit('ai-request-end')
    ↓
前端监听事件,更新 UI
```

---

## 四、实施步骤

### 4.1 准备工作

#### 1. 添加 Claurst 作为 submodule

```bash
cd /Users/hyperorchid/aiwithblockchain/TweetPilot
git submodule add https://github.com/ribencong/claurst.git claurst
git submodule update --init --recursive
```

#### 2. 更新 Cargo.toml

在 `src-tauri/Cargo.toml` 中添加依赖:

```toml
[dependencies]
# 现有依赖保持不变...

# Claurst 依赖
claurst-core = { path = "../claurst/src-rust/crates/core" }
claurst-api = { path = "../claurst/src-rust/crates/api" }
claurst-query = { path = "../claurst/src-rust/crates/query" }
claurst-tools = { path = "../claurst/src-rust/crates/tools" }
claurst-plugins = { path = "../claurst/src-rust/crates/plugins" }
claurst-mcp = { path = "../claurst/src-rust/crates/mcp" }

# Claurst 需要的额外依赖
async-trait = "0.1"
tracing = "0.1"
tracing-subscriber = "0.3"
thiserror = "1"
parking_lot = "0.12"
tokio-util = "0.7"
```

### 4.2 后端实现

#### 1. 创建 ClaurstSession 封装层

**文件**: `src-tauri/src/claurst/mod.rs`

参考 microcompany 的实现,创建封装层:
- 初始化 Claurst 会话
- 注册工具 (Read, Edit, Write, Bash, Glob, Grep)
- 处理流式响应
- 发送事件到前端

**关键点**:
- 使用 `PermissionMode::BypassPermissions` 自动允许所有工具
- 通过 `window.emit()` 发送流式事件到前端
- 保存消息历史到文件存储

#### 2. 创建 Tauri Commands

**文件**: `src-tauri/src/commands/ai_session.rs`

```rust
#[tauri::command]
pub async fn init_ai_session(
    working_dir: String,
    state: State<'_, AppState>,
) -> Result<String, String>

#[tauri::command]
pub async fn send_ai_message(
    message: String,
    state: State<'_, AppState>,
    window: Window,
) -> Result<String, String>

#[tauri::command]
pub async fn cancel_ai_message(
    state: State<'_, AppState>,
) -> Result<(), String>

#[tauri::command]
pub async fn clear_ai_session(
    state: State<'_, AppState>,
) -> Result<(), String>
```

#### 3. 创建配置管理

**文件**: `src-tauri/src/config/ai_config.rs`

```rust
pub struct AiConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

impl AiConfig {
    pub fn load() -> Result<Self, String>
    pub fn save(&self) -> Result<(), String>
}
```

配置文件位置: `~/.tweetpilot/ai_config.json`

#### 4. 创建会话存储

**文件**: `src-tauri/src/storage/conversation.rs`

```rust
pub struct ConversationStorage {
    storage_dir: PathBuf,
}

impl ConversationStorage {
    pub fn new() -> Result<Self, String>
    pub fn save_message(&self, session_id: &str, message: StoredMessage) -> Result<(), String>
    pub fn load_messages(&self, session_id: &str) -> Result<Vec<StoredMessage>, String>
    pub fn clear_messages(&self, session_id: &str) -> Result<(), String>
}
```

存储位置: `~/.tweetpilot/conversations/<session_id>.jsonl`

### 4.3 前端实现

#### 1. 复用 microcompany 的 ChatInterface

从 microcompany 复制以下组件:
- `ChatInterface.tsx` - 主对话界面
- `MessageList.tsx` - 消息列表
- `InputBox.tsx` - 输入框
- `ToolIndicator.tsx` - 工具调用指示器

**调整点**:
- 移除 Sidebar (TweetPilot 不需要会话列表)
- 移除 InspectorPanel (简化界面)
- 移除 TerminalPanel (简化界面)
- 保留核心的消息显示和流式响应功能

#### 2. 创建 AI 设置界面

**文件**: `src/components/AiSettings.tsx`

```tsx
interface AiSettings {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

function AiSettingsDialog() {
  // 配置 API Key、模型、Base URL
  // 保存到后端配置
}
```

#### 3. 集成到主界面

在 TweetPilot 的右侧面板添加 AI 对话界面:

```tsx
// src/App.tsx
<div className="right-panel">
  <ChatInterface
    workingDirectory={currentWorkspace}
    onSendMessage={handleSendMessage}
    messages={messages}
    onMessagesChange={setMessages}
  />
</div>
```

### 4.4 事件监听

前端需要监听以下事件:

```typescript
// 消息片段 (流式响应)
listen<{ request_id: string; chunk: string }>('message-chunk', (event) => {
  // 追加到当前消息
});

// 工具调用开始
listen<{ request_id: string; tool: string; action: string }>('tool-call-start', (event) => {
  // 显示工具调用指示器
});

// 工具调用结束
listen<{ request_id: string; tool: string; success: boolean; result: string }>('tool-call-end', (event) => {
  // 更新工具调用状态
});

// AI 状态更新
listen<{ request_id: string; phase: string; text: string }>('ai-status', (event) => {
  // 显示 AI 当前状态 (thinking, tool_running, generating, finalizing)
});

// 请求结束
listen<{ request_id: string; result: string; final_text?: string }>('ai-request-end', (event) => {
  // 标记消息为完成状态
});
```

---

## 五、配置文件

### 5.1 AI 配置

**位置**: `~/.tweetpilot/ai_config.json`

```json
{
  "api_key": "sk-ant-...",
  "model": "claude-sonnet-4-6",
  "base_url": "https://api.anthropic.com"
}
```

### 5.2 会话存储

**位置**: `~/.tweetpilot/conversations/<session_id>.jsonl`

每行一条消息:
```jsonl
{"role":"user","content":"帮我看看这个脚本","timestamp":1713686400}
{"role":"assistant","content":"好的,让我读取一下...","timestamp":1713686401}
```

---

## 六、用户体验流程

### 6.1 首次使用

```
1. 用户打开 TweetPilot
2. 点击右侧 AI 对话区域
3. 提示配置 API Key
4. 用户输入 API Key、选择模型
5. 保存配置
6. AI 会话初始化完成
```

### 6.2 日常使用

```
用户: "帮我看看当前目录下有哪些脚本?"

AI: [调用 Glob 工具]
"当前目录下有以下脚本:
- retweet_elon.py - 转推 Elon 的最新推文
- auto_reply.py - 自动回复提到你的推文
- schedule_tweet.py - 定时发推"

用户: "retweet_elon.py 是怎么工作的?"

AI: [调用 Read 工具读取文件]
"这个脚本的工作流程是:
1. 使用 ClawBot 搜索 Elon Musk 的最新推文
2. 获取第一条推文的 ID
3. 调用转推 API
4. 输出执行结果

需要传入 --account 参数指定使用哪个账号。"
```

---

## 七、技术细节

### 7.1 工具权限

使用 `PermissionMode::BypassPermissions` 自动允许所有工具调用,简化用户体验。

### 7.2 流式响应

- 后端通过 `window.emit('message-chunk')` 发送文本片段
- 前端累积片段并实时显示
- 使用 `isStreaming` 标记区分流式和完成状态

### 7.3 工具调用可视化

- 显示当前执行的工具名称
- 显示工具执行状态 (running, success, error)
- 3 秒后自动隐藏工具指示器

### 7.4 错误处理

- API 错误 → 显示友好的错误提示
- 工具执行失败 → 显示工具错误信息
- 取消请求 → 清理状态并停止流式响应

---

## 八、时间估算

| 任务 | 预计时间 | 依赖 |
|------|----------|------|
| 添加 Claurst submodule | 0.5 天 | - |
| 后端封装层实现 | 2 天 | 8.1 |
| Tauri Commands 实现 | 1 天 | 8.2 |
| 配置管理实现 | 0.5 天 | 8.2 |
| 前端组件复用和调整 | 1.5 天 | 8.3 |
| 事件监听和状态管理 | 1 天 | 8.4 |
| 测试和调试 | 1.5 天 | 8.5 |
| **总计** | **8 天** | |

---

## 九、验收标准

### 9.1 功能验收

- ✅ 用户可以配置 API Key 和模型
- ✅ AI 可以感知当前工作目录
- ✅ AI 可以读取文件内容
- ✅ AI 可以执行 shell 命令
- ✅ AI 可以搜索文件和内容
- ✅ 流式响应正常工作
- ✅ 工具调用可视化正常
- ✅ 对话历史持久化
- ✅ 可以清空会话历史

### 9.2 用户体验验收

- ✅ 界面简洁易用
- ✅ 响应速度快 (首字节 < 1s)
- ✅ 错误提示清晰
- ✅ 工具执行过程可见

---

## 十、未来扩展

### 10.1 第二阶段 (账号级会话)

- 每个推特账号有独立的 AI 会话
- 会话 ID 格式: `account-<account_id>-session`
- 在账号详情页显示 AI 对话入口

### 10.2 第三阶段 (脚本生成)

- AI 生成 Python 脚本到工作目录
- 脚本模板参考 ClawBot examples
- 自动创建任务并关联脚本

---

## 十一、参考资料

### 11.1 microcompany 实现

- `microcompany/src-tauri/src/claurst/mod.rs` - ClaurstSession 封装层
- `microcompany/src-tauri/src/commands/session.rs` - 会话管理命令
- `microcompany/src-tauri/src/commands/message.rs` - 消息处理命令
- `microcompany/src/components/ChatInterface.tsx` - 前端对话界面

### 11.2 Claurst 文档

- `microcompany/docs/Claurst架构分析.md` - Claurst 架构详解
- `microcompany/docs/Claurst集成方案.md` - 集成方案详解

---

## 十二、注意事项

### 12.1 简化原则

- 第一阶段只实现单一会话,不实现账号级会话
- 不实现会话列表和切换功能
- 不实现脚本生成功能 (留到第二阶段)
- 界面尽量简洁,只保留核心功能

### 12.2 代码复用

- 尽量复用 microcompany 的实现
- 前端组件可以直接复制并调整
- 后端封装层参考 microcompany 的结构

### 12.3 配置兼容

- 配置文件独立于 TweetPilot 的主配置
- 使用 `~/.tweetpilot/` 目录存储 AI 相关配置
- 支持自定义 Base URL (兼容代理和自建服务)

---

**文档状态**: ✅ 已完成  
**下一步**: 添加 Claurst submodule 并验证编译
