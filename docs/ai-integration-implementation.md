# TweetPilot AI 集成 - 开发实施指南

**文档版本**: 1.0  
**创建日期**: 2026-04-21  
**文档类型**: 开发指南  
**配套文档**: [需求和架构设计](ai-integration-plan.md)

---

## 一、准备工作

### 1.1 添加 Claurst 作为 Git Submodule

```bash
cd /Users/hyperorchid/aiwithblockchain/TweetPilot
git submodule add https://github.com/ribencong/claurst.git claurst
git submodule update --init --recursive
```

**验证**：
```bash
ls -la claurst/src-rust/crates/
# 应该看到: core, api, query, tools, plugins, mcp
```

### 1.2 更新 Cargo.toml

编辑 `src-tauri/Cargo.toml`，在 `[dependencies]` 部分添加：

```toml
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
uuid = { version = "1", features = ["v4"] }
chrono = "0.4"
```

**验证编译**：
```bash
cd src-tauri
cargo check
```

---

## 二、后端实现

### 2.1 创建 AI 配置管理

#### 文件：`src-tauri/src/config/ai_config.rs`

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: "claude-sonnet-4-6".to_string(),
            base_url: Some("https://api.anthropic.com".to_string()),
        }
    }
}

impl AiConfig {
    fn config_path() -> Result<PathBuf, String> {
        let home = dirs::home_dir()
            .ok_or("Failed to get home directory")?;
        let config_dir = home.join(".tweetpilot");
        
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }
        
        Ok(config_dir.join("ai_config.json"))
    }

    pub fn load() -> Result<Self, String> {
        let path = Self::config_path()?;
        
        if !path.exists() {
            return Ok(Self::default());
        }
        
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config: {}", e))
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path()?;
        
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        
        fs::write(&path, content)
            .map_err(|e| format!("Failed to write config: {}", e))
    }
}
```

#### 更新 `src-tauri/src/config/mod.rs`

```rust
pub mod ai_config;
pub use ai_config::AiConfig;
```

### 2.2 创建会话存储

#### 文件：`src-tauri/src/storage/conversation.rs`

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    pub role: String,
    pub content: String,
    pub timestamp: i64,
}

pub struct ConversationStorage {
    storage_dir: PathBuf,
}

impl ConversationStorage {
    pub fn new() -> Result<Self, String> {
        let home = dirs::home_dir()
            .ok_or("Failed to get home directory")?;
        let storage_dir = home.join(".tweetpilot").join("conversations");
        
        if !storage_dir.exists() {
            fs::create_dir_all(&storage_dir)
                .map_err(|e| format!("Failed to create storage directory: {}", e))?;
        }
        
        Ok(Self { storage_dir })
    }

    fn session_file(&self, session_id: &str) -> PathBuf {
        self.storage_dir.join(format!("{}.jsonl", session_id))
    }

    pub fn save_message(&self, session_id: &str, message: StoredMessage) -> Result<(), String> {
        let file_path = self.session_file(session_id);
        
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .map_err(|e| format!("Failed to open file: {}", e))?;
        
        let json = serde_json::to_string(&message)
            .map_err(|e| format!("Failed to serialize message: {}", e))?;
        
        writeln!(file, "{}", json)
            .map_err(|e| format!("Failed to write message: {}", e))?;
        
        Ok(())
    }

    pub fn load_messages(&self, session_id: &str) -> Result<Vec<StoredMessage>, String> {
        let file_path = self.session_file(session_id);
        
        if !file_path.exists() {
            return Ok(Vec::new());
        }
        
        let file = fs::File::open(&file_path)
            .map_err(|e| format!("Failed to open file: {}", e))?;
        
        let reader = BufReader::new(file);
        let mut messages = Vec::new();
        
        for line in reader.lines() {
            let line = line.map_err(|e| format!("Failed to read line: {}", e))?;
            let message: StoredMessage = serde_json::from_str(&line)
                .map_err(|e| format!("Failed to parse message: {}", e))?;
            messages.push(message);
        }
        
        Ok(messages)
    }

    pub fn clear_messages(&self, session_id: &str) -> Result<(), String> {
        let file_path = self.session_file(session_id);
        
        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to delete file: {}", e))?;
        }
        
        Ok(())
    }
}
```

#### 更新 `src-tauri/src/storage/mod.rs`

```rust
pub mod conversation;
pub use conversation::{ConversationStorage, StoredMessage};
```

### 2.3 创建 ClaurstSession 封装层

#### 文件：`src-tauri/src/claurst/mod.rs`

**完整复制** microcompany 的实现，路径：
`/Users/hyperorchid/aiwithblockchain/microcompany/src-tauri/src/claurst/mod.rs`

**关键修改点**：
1. 移除数据库相关代码（TweetPilot 暂不需要）
2. 简化会话 ID 生成逻辑（使用 UUID）

```rust
// 在 ClaurstSession::new() 中简化会话 ID
pub fn new(
    session_id: String,
    working_dir: PathBuf,
    api_key: String,
    model: String,
    base_url: Option<String>,
) -> anyhow::Result<Self> {
    // ... 其他代码保持不变
}
```

### 2.4 创建 Tauri Commands

#### 文件：`src-tauri/src/commands/ai_session.rs`

```rust
use tauri::{State, Window};
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::claurst::ClaurstSession;
use tokio_util::sync::CancellationToken;

pub struct AiState {
    pub session: Arc<Mutex<Option<ClaurstSession>>>,
    pub cancel_token: Arc<Mutex<Option<CancellationToken>>>,
    pub active_request_id: Arc<Mutex<Option<String>>>,
}

#[tauri::command]
pub async fn init_ai_session(
    working_dir: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    if !std::path::Path::new(&working_dir).exists() {
        return Err(format!("Directory does not exist: {}", working_dir));
    }

    let ai_config = crate::config::AiConfig::load()
        .map_err(|e| format!("Failed to load AI config: {}", e))?;

    if ai_config.api_key.is_empty() {
        return Err("API key not configured. Please configure in settings.".to_string());
    }

    let session_id = format!("session-{}", uuid::Uuid::new_v4());

    let session = ClaurstSession::new(
        session_id.clone(),
        std::path::PathBuf::from(&working_dir),
        ai_config.api_key,
        ai_config.model,
        ai_config.base_url,
    ).map_err(|e| format!("Failed to create session: {}", e))?;

    *state.session.lock().await = Some(session);
    *state.cancel_token.lock().await = None;
    *state.active_request_id.lock().await = None;

    Ok(session_id)
}

#[tauri::command]
pub async fn send_ai_message(
    message: String,
    state: State<'_, AiState>,
    window: Window,
) -> Result<String, String> {
    let mut session_guard = state.session.lock().await;
    let session = session_guard.as_mut()
        .ok_or("Session not initialized. Please initialize session first.")?;

    let cancel_token = CancellationToken::new();
    let request_id = uuid::Uuid::new_v4().to_string();
    *state.cancel_token.lock().await = Some(cancel_token.clone());
    *state.active_request_id.lock().await = Some(request_id.clone());

    let result = session.send_message(&message, &request_id, window, cancel_token.clone())
        .await
        .map_err(|e| format!("Failed to send message: {}", e));

    *state.cancel_token.lock().await = None;
    *state.active_request_id.lock().await = None;

    result
}

#[tauri::command]
pub async fn cancel_ai_message(
    state: State<'_, AiState>,
) -> Result<(), String> {
    let active_request_id = state.active_request_id.lock().await.clone();
    if active_request_id.is_none() {
        return Err("No active message to cancel".to_string());
    }

    let cancel_token_guard = state.cancel_token.lock().await;
    if let Some(token) = cancel_token_guard.as_ref() {
        token.cancel();
        Ok(())
    } else {
        Err("No active message to cancel".to_string())
    }
}

#[tauri::command]
pub async fn clear_ai_session(
    state: State<'_, AiState>,
) -> Result<(), String> {
    let session_guard = state.session.lock().await;

    if let Some(session) = session_guard.as_ref() {
        let session_id = session.get_session_id();

        let storage = crate::storage::ConversationStorage::new()
            .map_err(|e| format!("Failed to create storage: {}", e))?;

        storage.clear_messages(session_id)
            .map_err(|e| format!("Failed to clear messages: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_ai_config() -> Result<crate::config::AiConfig, String> {
    crate::config::AiConfig::load()
}

#[tauri::command]
pub async fn save_ai_config(config: crate::config::AiConfig) -> Result<(), String> {
    config.save()
}
```

#### 更新 `src-tauri/src/commands/mod.rs`

```rust
pub mod ai_session;
```

### 2.5 注册 Tauri Commands

#### 编辑 `src-tauri/src/main.rs`

```rust
mod claurst;
mod config;
mod storage;
mod commands;

use commands::ai_session::{AiState, init_ai_session, send_ai_message, cancel_ai_message, clear_ai_session, get_ai_config, save_ai_config};
use std::sync::Arc;
use tokio::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .manage(AiState {
            session: Arc::new(Mutex::new(None)),
            cancel_token: Arc::new(Mutex::new(None)),
            active_request_id: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            // ... 现有的 commands
            init_ai_session,
            send_ai_message,
            cancel_ai_message,
            clear_ai_session,
            get_ai_config,
            save_ai_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 三、前端实现

### 3.1 UI 布局说明

根据 TweetPilot 的设计，**右侧整个区域**专门用于 AI 对话界面，采用**极简三段式布局**：

```
┌────────────────────────────────────────────────────────────────┐
│  TitleBar                                                       │
├──────────────┬─────────────────────────────────────────────────┤
│              │  Tab Bar (Workspace / Tasks / ...)              │
│              ├─────────────────────────────────────────────────┤
│  Left        │                                                  │
│  Sidebar     │         Main Content Area                        │
│              │         (任务详情、工作区等)                       │
│  - Tasks     │                                                  │
│  - Accounts  │                                                  │
│  - Explorer  ├──────────────────────────────────────────────────┤
│              │  ┌────────────────────────────────────────────┐ │
│              │  │  Claude Code                      隐藏 ▼   │ │ ← 标题栏
│              │  ├────────────────────────────────────────────┤ │
│              │  │                                            │ │
│              │  │  你好，我是 Claude。右侧顶部自动感知 UI... │ │
│              │  │                                            │ │
│              │  │  ┌──────────────────────────────────────┐ │ │
│              │  │  │ 帮我看看当前 TweetPilot 的 VSCode... │ │ │ ← 用户消息
│              │  │  └──────────────────────────────────────┘ │ │
│              │  │                                            │ │
│              │  │  目前已基本搭建，活动栏、左右面板与 Tab... │ │ ← AI 回复
│              │  │                                            │ │
│              │  │  [工具调用: Reading file.py...]           │ │ ← 工具指示器
│              │  │                                            │ │
│              │  │                                            │ │ ← 消息区域
│              │  │                                            │ │   (可滚动)
│              │  │                                            │ │
│              │  │  │  消息列表 (可滚动)                    │ │ │
│              │  │  │                                      │ │ │
│              │  │  │  👤 用户: 帮我看看这个脚本...         │ │ │
│              │  │  │                                      │ │ │
│              │  │  │  🤖 AI: [调用 Read 工具]             │ │ │
│              │  │  │      好的，让我读取一下...            │ │ │
│              │  │  │                                      │ │ │
│              │  │  │  [工具调用指示器: Reading file.py]   │ │ │
│              │  │  │                                      │ │ │
│              │  │  └──────────────────────────────────────┘ │ │
│              │  │                                            │ │
│              │  │  ─────────────────────────────────────────  │ │
│              │  │  [输入消息...]                  [发送] [📎] │ │
│              │  └────────────────────────────────────────────┘ │
└──────────────┴─────────────────────────────────────────────────┘
```

**关键设计要点**：
1. **右侧区域独立**：AI 对话界面占据右侧整个区域，与左侧内容区域并列
2. **固定布局**：顶部标题栏 + 消息列表 + 底部输入框
3. **流式显示**：AI 回复逐字显示，工具调用实时可见
4. **工具可视化**：显示当前执行的工具（Read、Glob、Grep 等）

### 3.2 复用 microcompany 的组件

从 microcompany 复制以下文件到 TweetPilot：

```bash
# 创建目录
mkdir -p src/components/chat

# 复制核心组件
cp /Users/hyperorchid/aiwithblockchain/microcompany/src/components/MessageList.tsx src/components/chat/
cp /Users/hyperorchid/aiwithblockchain/microcompany/src/components/InputBox.tsx src/components/chat/
cp /Users/hyperorchid/aiwithblockchain/microcompany/src/components/ToolIndicator.tsx src/components/chat/
```

### 3.2 创建简化的 ChatInterface

#### 文件：`src/components/chat/ChatInterface.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import MessageList from './MessageList';
import InputBox from './InputBox';
import ToolIndicator from './ToolIndicator';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp: number;
}

interface ToolCall {
  tool: string;
  action: string;
  success?: boolean;
  result?: string;
}

interface ChatInterfaceProps {
  workingDirectory: string;
}

export default function ChatInterface({ workingDirectory }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentToolCall, setCurrentToolCall] = useState<ToolCall | null>(null);
  const [aiStatus, setAiStatus] = useState<{ phase: string; text: string } | null>(null);

  // 初始化会话
  useEffect(() => {
    const initSession = async () => {
      try {
        const id = await invoke<string>('init_ai_session', {
          workingDir: workingDirectory,
        });
        setSessionId(id);
      } catch (error) {
        console.error('Failed to initialize AI session:', error);
      }
    };

    initSession();
  }, [workingDirectory]);

  // 监听事件
  useEffect(() => {
    const unlistenChunk = listen<{ request_id: string; chunk: string }>('message-chunk', (event) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + event.payload.chunk },
          ];
        }
        return prev;
      });
    });

    const unlistenToolStart = listen<{ request_id: string; tool: string; action: string }>('tool-call-start', (event) => {
      setCurrentToolCall({
        tool: event.payload.tool,
        action: event.payload.action,
      });
    });

    const unlistenToolEnd = listen<{ request_id: string; tool: string; success: boolean; result: string }>('tool-call-end', (event) => {
      setCurrentToolCall((prev) =>
        prev ? { ...prev, success: event.payload.success, result: event.payload.result } : null
      );
      setTimeout(() => setCurrentToolCall(null), 3000);
    });

    const unlistenStatus = listen<{ request_id: string; phase: string; text: string }>('ai-status', (event) => {
      setAiStatus({ phase: event.payload.phase, text: event.payload.text });
    });

    const unlistenEnd = listen<{ request_id: string; result: string; final_text?: string }>('ai-request-end', (event) => {
      setIsLoading(false);
      setAiStatus(null);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, isStreaming: false, content: event.payload.final_text || last.content },
          ];
        }
        return prev;
      });
    });

    return () => {
      unlistenChunk.then((fn) => fn());
      unlistenToolStart.then((fn) => fn());
      unlistenToolEnd.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
      unlistenEnd.then((fn) => fn());
    };
  }, []);

  const handleSendMessage = async (content: string) => {
    if (!sessionId) {
      console.error('Session not initialized');
      return;
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    const assistantMessage: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    try {
      await invoke('send_ai_message', { message: content });
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await invoke('cancel_ai_message');
    } catch (error) {
      console.error('Failed to cancel message:', error);
    }
  };

  return (
    <div className="chat-interface">
      <MessageList messages={messages} />
      {currentToolCall && <ToolIndicator toolCall={currentToolCall} />}
      {aiStatus && (
        <div className="ai-status">
          {aiStatus.text}
        </div>
      )}
      <InputBox
        onSendMessage={handleSendMessage}
        onCancel={handleCancel}
        isLoading={isLoading}
      />
    </div>
  );
}
```

### 3.3 创建 AI 设置界面

#### 文件：`src/components/AiSettingsDialog.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AiConfig {
  api_key: string;
  model: string;
  base_url?: string;
}

interface AiSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AiSettingsDialog({ open, onClose }: AiSettingsDialogProps) {
  const [config, setConfig] = useState<AiConfig>({
    api_key: '',
    model: 'claude-sonnet-4-6',
    base_url: 'https://api.anthropic.com',
  });

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    try {
      const loaded = await invoke<AiConfig>('get_ai_config');
      setConfig(loaded);
    } catch (error) {
      console.error('Failed to load AI config:', error);
    }
  };

  const handleSave = async () => {
    try {
      await invoke('save_ai_config', { config });
      onClose();
    } catch (error) {
      console.error('Failed to save AI config:', error);
    }
  };

  if (!open) return null;

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>AI Settings</h2>
        <div className="form-group">
          <label>API Key</label>
          <input
            type="password"
            value={config.api_key}
            onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Model</label>
          <select
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
          >
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            <option value="claude-opus-4-7">Claude Opus 4.7</option>
            <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
          </select>
        </div>
        <div className="form-group">
          <label>Base URL (Optional)</label>
          <input
            type="text"
            value={config.base_url || ''}
            onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
          />
        </div>
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

### 3.4 集成到主界面

#### 编辑 `src/App.tsx`

```typescript
import ChatInterface from './components/chat/ChatInterface';
import AiSettingsDialog from './components/AiSettingsDialog';

// 在右侧面板添加 AI 对话界面
<div className="right-panel">
  <ChatInterface workingDirectory={currentWorkspace} />
</div>
```

---

## 四、测试验证

### 4.1 编译测试

```bash
cd src-tauri
cargo build
```

### 4.2 运行测试

```bash
./dev-with-log.sh
```

### 4.3 功能测试清单

- [ ] 配置 API Key 和模型
- [ ] 初始化 AI 会话
- [ ] 发送消息并接收流式响应
- [ ] 工具调用可视化（Read、Glob、Grep 等）
- [ ] 取消消息
- [ ] 清空会话历史
- [ ] 会话持久化（重启后恢复）

---

## 五、常见问题

### 5.1 编译错误

**问题**：`claurst-core` 找不到

**解决**：
```bash
git submodule update --init --recursive
```

### 5.2 API Key 未配置

**问题**：提示 "API key not configured"

**解决**：
1. 打开设置界面
2. 输入 Anthropic API Key
3. 保存配置

### 5.3 工具执行失败

**问题**：工具调用返回错误

**解决**：
1. 检查工作目录权限
2. 检查文件路径是否正确
3. 查看 Rust 日志输出

---

## 六、下一步

完成第一阶段后，可以开始第二阶段：

1. **账号级会话**：为每个推特账号创建独立会话
2. **脚本生成**：AI 生成 Python 脚本到工作目录
3. **脚本解释**：AI 解释脚本功能和用法

---

---

## 七、会话历史数据库持久化（待实施）

### 7.1 背景

当前实现使用 JSONL 文件存储会话历史（`~/.tweetpilot/conversations/[session_id].jsonl`），需要改为使用 SQLite 数据库存储，以便：
- 统一存储方案（与任务数据在同一数据库）
- 更好的查询和管理能力
- 更可靠的并发控制

### 7.2 数据库表设计

在现有的 `task_database.rs` 中添加会话历史表：

```sql
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
```

### 7.3 实施步骤

#### 步骤 1：修改 `src-tauri/src/task_database.rs`

在 `TaskDatabase` 结构体中添加会话历史相关方法：

```rust
impl TaskDatabase {
    // 初始化时创建会话历史表
    pub fn new(workspace_root: &str) -> Result<Self, String> {
        // ... 现有代码 ...
        
        // 创建会话历史表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ).map_err(|e| format!("Failed to create conversations table: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id)",
            [],
        ).map_err(|e| format!("Failed to create session_id index: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)",
            [],
        ).map_err(|e| format!("Failed to create timestamp index: {}", e))?;

        // ... 现有代码 ...
    }

    // 保存消息
    pub fn save_conversation_message(
        &self,
        session_id: &str,
        role: &str,
        content: &str,
        timestamp: i64,
    ) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO conversations (session_id, role, content, timestamp) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![session_id, role, content, timestamp],
            )
            .map_err(|e| format!("Failed to save conversation message: {}", e))?;
        Ok(())
    }

    // 加载会话消息
    pub fn load_conversation_messages(&self, session_id: &str) -> Result<Vec<(String, String, i64)>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT role, content, timestamp FROM conversations WHERE session_id = ?1 ORDER BY timestamp ASC")
            .map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let messages = stmt
            .query_map([session_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            })
            .map_err(|e| format!("Failed to query messages: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect messages: {}", e))?;

        Ok(messages)
    }

    // 清空会话消息
    pub fn clear_conversation_messages(&self, session_id: &str) -> Result<(), String> {
        self.conn
            .execute(
                "DELETE FROM conversations WHERE session_id = ?1",
                [session_id],
            )
            .map_err(|e| format!("Failed to clear conversation messages: {}", e))?;
        Ok(())
    }

    // 删除旧会话（可选，用于清理）
    pub fn delete_old_conversations(&self, days: i64) -> Result<usize, String> {
        let cutoff_timestamp = chrono::Utc::now().timestamp() - (days * 86400);
        let deleted = self.conn
            .execute(
                "DELETE FROM conversations WHERE timestamp < ?1",
                [cutoff_timestamp],
            )
            .map_err(|e| format!("Failed to delete old conversations: {}", e))?;
        Ok(deleted)
    }
}
```

#### 步骤 2：修改 `src-tauri/src/services/conversation_storage.rs`

将 JSONL 文件存储改为数据库存储：

```rust
use crate::task_database::TaskDatabase;
use std::sync::Arc;
use parking_lot::Mutex;

pub struct ConversationStorage {
    db: Arc<Mutex<Option<TaskDatabase>>>,
}

impl ConversationStorage {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            db: Arc::new(Mutex::new(None)),
        })
    }

    pub fn set_database(&self, db: Arc<Mutex<Option<TaskDatabase>>>) {
        *self.db.lock() = db.lock().clone();
    }

    pub fn save_message(&self, session_id: &str, message: StoredMessage) -> Result<(), String> {
        let db_guard = self.db.lock();
        let db = db_guard.as_ref().ok_or("Database not initialized")?;
        
        db.save_conversation_message(
            session_id,
            &message.role,
            &message.content,
            message.timestamp,
        )
    }

    pub fn load_messages(&self, session_id: &str) -> Result<Vec<StoredMessage>, String> {
        let db_guard = self.db.lock();
        let db = db_guard.as_ref().ok_or("Database not initialized")?;
        
        let messages = db.load_conversation_messages(session_id)?;
        
        Ok(messages
            .into_iter()
            .map(|(role, content, timestamp)| StoredMessage {
                role,
                content,
                timestamp,
            })
            .collect())
    }

    pub fn clear_messages(&self, session_id: &str) -> Result<(), String> {
        let db_guard = self.db.lock();
        let db = db_guard.as_ref().ok_or("Database not initialized")?;
        
        db.clear_conversation_messages(session_id)
    }
}
```

#### 步骤 3：修改 `src-tauri/src/claurst_session.rs`

更新 `ClaurstSession::new()` 以接收数据库引用：

```rust
pub fn new(
    session_id: String,
    working_dir: PathBuf,
    api_key: String,
    model: String,
    base_url: Option<String>,
    db: Arc<Mutex<Option<TaskDatabase>>>,
) -> anyhow::Result<Self> {
    // ... 现有代码 ...

    let mut storage = ConversationStorage::new()
        .map_err(|e| anyhow::anyhow!("{}", e))?;
    storage.set_database(db);

    // ... 现有代码 ...
}
```

#### 步骤 4：修改 `src-tauri/src/commands/ai.rs`

更新 `init_ai_session` 命令以传递数据库引用：

```rust
#[tauri::command]
pub async fn init_ai_session(
    working_dir: String,
    state: State<'_, AiState>,
    task_state: State<'_, TaskState>,  // 添加 TaskState 依赖
) -> Result<String, String> {
    // ... 现有代码 ...

    let session = ClaurstSession::new(
        session_id.clone(),
        std::path::PathBuf::from(&working_dir),
        ai_config.api_key,
        ai_config.model,
        ai_config.base_url,
        task_state.db.clone(),  // 传递数据库引用
    ).map_err(|e| format!("Failed to create session: {}", e))?;

    // ... 现有代码 ...
}
```

### 7.4 迁移现有数据（可选）

如果需要迁移现有的 JSONL 文件到数据库：

```rust
pub fn migrate_jsonl_to_db(
    jsonl_dir: &Path,
    db: &TaskDatabase,
) -> Result<usize, String> {
    let mut migrated_count = 0;

    for entry in std::fs::read_dir(jsonl_dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
            let session_id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .ok_or("Invalid filename")?;

            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            for line in content.lines() {
                if line.trim().is_empty() {
                    continue;
                }

                let message: StoredMessage = serde_json::from_str(line)
                    .map_err(|e| format!("Failed to parse message: {}", e))?;

                db.save_conversation_message(
                    session_id,
                    &message.role,
                    &message.content,
                    message.timestamp,
                )?;

                migrated_count += 1;
            }
        }
    }

    Ok(migrated_count)
}
```

### 7.5 测试验证

- [ ] 数据库表创建成功
- [ ] 消息保存到数据库
- [ ] 消息从数据库加载
- [ ] 清空会话历史
- [ ] 多会话并发访问
- [ ] 数据库文件位置正确（workspace/.tweetpilot/tasks.db）

---

**文档状态**: ✅ 已完成（第七节待实施）  
**配套文档**: [需求和架构设计](ai-integration-plan.md)
