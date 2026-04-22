# TweetPilot AI 集成方案

**文档版本**: 5.0  
**更新日期**: 2026-04-22  
**文档类型**: 架构设计与实现说明  
**状态**: ✅ 已完成第一阶段  
**参考项目**: microcompany (Claurst 集成实现)

**更新说明**：
- v5.0: 整合账号级 AI Session、人设管理、全局敏感词过滤机制

---

## 一、项目背景与目标

### 1.1 业务需求

TweetPilot 需要集成 AI 对话功能，帮助用户：
1. 理解和使用当前工作目录下的 Python 脚本
2. 为每个推特账号配置固定的 AI 会话，提供个性化的脚本建议

### 1.2 核心原则

- **简单实用**：第一阶段只实现基础会话功能和模型配置
- **渐进式开发**：分阶段实现，先验证核心功能再扩展
- **复用优先**：参考 microcompany 的成熟实现，避免重复造轮子

---

## 二、实现状态

### 2.1 ✅ 已完成功能（第一阶段）

**核心功能**：
- ✅ **会话管理** - 支持创建、加载、切换、删除会话
- ✅ **会话历史** - 会话列表面板，显示所有历史会话
- ✅ **工作目录上下文** - AI 能感知当前工作目录的文件和脚本
- ✅ **多提供商配置** - 支持配置多个 AI 提供商（Anthropic、OpenAI、自定义）
- ✅ **模型配置** - 用户可以配置 API Key、模型、Base URL
- ✅ **基础工具能力** - Read、Edit、Write、Bash、Glob、Grep
- ✅ **流式响应** - 实时显示 AI 回复（支持 thinking 和 content）
- ✅ **工具调用可视化** - 显示工具执行过程和结果
- ✅ **会话持久化** - 保存对话历史到 JSONL 文件
- ✅ **UI 设计** - VSCode Dark+ 风格，支持深色/浅色模式

**实现的组件**：
- 后端：[ClaurstSession](src-tauri/src/claurst_session.rs)、[ConversationStorage](src-tauri/src/services/conversation_storage.rs)、[AI Commands](src-tauri/src/commands/ai.rs)
- 前端：[ChatInterface](src/components/ChatInterface.tsx)、[AssistantMessage](src/components/ChatInterface/AssistantMessage.tsx)、[SessionPanel](src/components/ChatInterface/SessionPanel.tsx)
- 配置：[AI Settings](src/types/ai-settings.ts)、[AI Service](src/services/ai/tauri.ts)

### 2.2 未来扩展（第二阶段）

#### 核心功能

- ⏳ **AI 自主工作流任务** - 定时任务触发 AI Session 自主执行复杂工作流
  - 与 UnifiedTimerManager 集成
  - **账号级 AI Session**：每个推特账号拥有独立的 AI Session（Session ID: `account-{account_id}`）
  - **人设管理**：账号人设注入到 System Prompt，保持语气和风格一致性
  - **全局敏感词过滤**：多层防护机制，确保推文内容安全合规
  - 用户通过自然语言配置任务（无需定义步骤）
  - AI 自主调用工具完成整个流程（Bash 执行 Python、Read 读取输出、分析内容、再次执行脚本等）
  - 支持知识库集成（产品信息 + 账号人设 + 全局内容策略）
  - 典型场景：定时获取热点 → AI 分析 → 生成符合人设的推文 → 敏感词检查 → 自动发送
  - **详细设计文档**: [AI 自主工作流任务技术方案](ai-autonomous-workflow-design.md)
  - **实施周期**: 8-12 天
  - **核心组件**:
    - AiAutonomousExecutor (Rust 执行器，支持账号级 Session)
    - 知识库组织系统 (产品知识库 + 账号人设 + 全局敏感词库)
    - ContentReviewer (多层敏感词过滤)
    - 任务配置界面 (React UI，支持账号选择和人设编辑)
    - 成本控制和安全机制

#### 其他功能

- ⏳ **脚本生成** - AI 生成 Python 脚本到工作目录
- ⏳ **脚本解释** - AI 解释脚本功能和用法
- ⏳ **附件上传** - 支持上传文件到 AI 对话

---

## 二.五、第二阶段核心架构设计

### 2.5.1 账号级 AI Session 架构

**设计原则**：
- 每个推特账号拥有独立的 AI Session（Session ID: `account-{account_id}`）
- Session 绑定账号人设，保持语气和风格一致性
- 利用 Claurst 内置的 Compact 机制自动管理上下文
- Session 复用，避免重复加载知识库和人设

**Session 生命周期**：
```
1. 首次执行任务
   ↓
2. 创建账号级 Session (account-123)
   - 加载账号人设
   - 加载全局敏感词库
   - 注入到 System Prompt
   ↓
3. 执行任务（生成推文）
   - AI 记住人设和敏感词规则
   - 生成符合人设的内容
   - 自动避免敏感词
   ↓
4. Session 持久化
   - 保存对话历史
   - 记住已发送的推文
   ↓
5. 下次执行任务
   - 复用现有 Session
   - AI 记得历史推文，避免重复
   - 上下文达到 90% 时自动 Compact
```

**System Prompt 结构**：
```
优先级 1: 全局内容审核规则（最高优先级）
优先级 2: 全局敏感词库（绝对禁止）
优先级 3: 账号人设（在遵守全局规则的前提下）
```

### 2.5.2 知识库组织架构

```
knowledge/
├── global/                          # 全局配置（所有账号共享）
│   ├── sensitive-words.md           # 敏感词库
│   └── content-policy.md            # 内容审核策略
├── personas/                        # 账号人设
│   ├── account-123.md               # 账号 123 的人设
│   └── account-456.md               # 账号 456 的人设
└── products/                        # 产品知识库
    ├── meshnet-protocol/            # 产品 A
    └── another-product/             # 产品 B
```

**加载优先级**：
1. 全局敏感词库（所有 Session 必须加载）
2. 全局内容策略（所有 Session 必须加载）
3. 账号人设（账号级 Session 加载）
4. 产品知识库（任务执行时按需加载）

### 2.5.3 多层敏感词过滤架构

**第一层：AI 自我审查**
- 通过 System Prompt 注入敏感词规则
- AI 在生成推文时自动避免敏感词
- 成本：0（无额外开销）
- 准确率：~95%（依赖 AI 理解能力）

**第二层：发送前检查**
- `ContentReviewer` 组件执行二次验证
- 完全匹配检查（精确匹配敏感词）
- 正则表达式检测变体（拼音、谐音、空格分隔）
- PII 检测（手机号、邮箱等）
- 成本：极低（本地正则匹配）
- 准确率：~99%（规则引擎）

**第三层：人工审核模式**（可选）
- 高风险账号或敏感时期启用
- AI 生成推文后，发送前需人工批准
- 成本：人工时间
- 准确率：100%

**防护效果**：
- 三层防护确保敏感词不会出现在推文中
- 即使 AI 误判，发送前检查也会拦截
- 支持敏感词库动态更新，无需重启服务

### 2.5.4 数据模型扩展

**tasks 表扩展**：
```sql
ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'python_script';
ALTER TABLE tasks ADD COLUMN ai_workflow_config TEXT;
ALTER TABLE tasks ADD COLUMN account_id INTEGER;  -- 关联推特账号
```

**accounts 表扩展**：
```sql
ALTER TABLE accounts ADD COLUMN persona TEXT;  -- 账号人设描述
```

**AI 工作流配置格式**：
```json
{
  "account_id": 123,
  "initial_prompt": "执行 scripts/fetch_trends.py 获取热点...",
  "working_dir": "/Users/hyperorchid/MeshNetProtocol",
  "knowledge_base": "knowledge/meshnet-protocol/",
  "timeout_seconds": 600,
  "max_retries": 3
}
```

---

## 三、UI 布局设计

### 3.1 整体布局

TweetPilot 采用**左右分栏布局**，右侧整个区域专门用于 AI 对话：

```
┌────────────────────────────────────────────────────────────────┐
│  TitleBar (标题栏)                                              │
├──────────────┬─────────────────────────────────────────────────┤
│              │  Tab Bar (Workspace / Tasks / ...)              │
│              ├─────────────────────────────────────────────────┤
│              │                                                  │
│  Left        │                                                  │
│  Sidebar     │         Main Content Area                        │
│              │         (任务详情、工作区等)                       │
│  - Tasks     │                                                  │
│  - Accounts  │                                                  │
│  - Explorer  │                                                  │
│              │                                                  │
│              │                                                  │
├──────────────┼──────────────────────────────────────────────────┤
│              │                                                  │
│              │  ┌────────────────────────────────────────────┐ │
│              │  │  Claude Code (AI 对话界面)                 │ │
│              │  │                                            │ │
│              │  │  ┌──────────────────────────────────────┐ │ │
│              │  │  │  欢迎消息 / AI 介绍                   │ │ │
│              │  │  └──────────────────────────────────────┘ │ │
│              │  │                                            │ │
│              │  │  ┌──────────────────────────────────────┐ │ │
│              │  │  │  消息列表 (流式显示)                  │ │ │
│              │  │  │  - 用户消息                           │ │ │
│              │  │  │  - AI 回复                            │ │ │
│              │  │  │  - 工具调用指示器                     │ │ │
│              │  │  │  - AI 状态提示                        │ │ │
│              │  │  └──────────────────────────────────────┘ │ │
│              │  │                                            │ │
│              │  │  ┌──────────────────────────────────────┐ │ │
│              │  │  │  输入框                               │ │ │
│              │  │  │  [输入消息...]            [发送] [⚙️] │ │ │
│              │  │  └──────────────────────────────────────┘ │ │
│              │  └────────────────────────────────────────────┘ │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

### 3.2 右侧 AI 对话区域详细设计

右侧区域占据**整个右半屏**，专门用于 AI 对话，采用**极简三段式布局**：

```
┌────────────────────────────────────────────────┐
│  Claude Code                          隐藏 ▼   │  ← 顶部标题栏
├────────────────────────────────────────────────┤
│                                                │
│  你好，我是 Claude。右侧顶部自动感知 UI 占位处， │
│  后续接入真实助手能力。                         │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ 帮我看看当前 TweetPilot 的 VSCode 风格布局│ │  ← 用户消息（蓝色）
│  │ 还需要还原哪些细节呢。                    │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  目前已基本搭建，活动栏、左右面板与 Tab 外壳，  │  ← AI 回复（灰色）
│  下一步建议补真实数据和交互逻辑。              │
│                                                │
│  [工具调用: Reading file.py...]               │  ← 工具指示器（可选）
│                                                │
│                                                │  ← 消息列表（可滚动）
│                                                │
│                                                │
│                                                │
├────────────────────────────────────────────────┤
│  输入消息...                        [附件] [发送]│  ← 底部输入框
└────────────────────────────────────────────────┘
```

#### 3.2.1 顶部标题栏
- 显示 "Claude Code" 标题
- 右侧"隐藏"按钮（可折叠 AI 面板）
- **无设置按钮**（设置通过主菜单或快捷键打开）

#### 3.2.2 消息显示区域（中间可滚动）
- **用户消息**：
  - 右对齐，蓝色背景卡片
  - 显示消息内容
  
- **AI 消息**：
  - 左对齐，灰色/白色背景
  - 支持 Markdown 渲染
  - 流式显示（逐字输出）
  
- **工具调用指示器**（内嵌在消息流中）：
  - 显示当前执行的工具（Read、Glob、Grep 等）
  - 格式：`[工具调用: Reading file.py...]`
  - 执行完成后保留在消息历史中

#### 3.2.3 底部输入框
- **输入框**：
  - 单行文本输入（自动扩展）
  - Enter 发送消息
  - 占位符："输入消息..."
  
- **附件按钮**：
  - 图标按钮，用于上传文件（第二阶段）
  
- **发送按钮**：
  - 蓝色按钮，显示"发送"
  - 加载状态时可取消请求

### 3.3 响应式设计

- **桌面端**：右侧 AI 区域占据 40-50% 宽度
- **移动端**：AI 区域可通过底部按钮展开为全屏对话

---

## 四、技术架构

### 4.1 整体架构

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

### 3.2 核心组件

#### 3.2.1 ClaurstSession (Rust 封装层)

**实现文件**: [src-tauri/src/claurst_session.rs](src-tauri/src/claurst_session.rs)

**职责**：
- 初始化 Claurst 会话
- 注册工具 (Read, Edit, Write, Bash, Glob, Grep)
- 处理流式响应（thinking 和 content）
- 发送事件到前端
- 保存消息历史

**关键设计**：
- 使用 `PermissionMode::BypassPermissions` 自动允许所有工具
- 通过 `window.emit()` 发送流式事件到前端
- 支持取消请求（CancellationToken）
- 保存消息历史到 ConversationStorage

#### 3.2.2 Tauri Commands

**实现文件**: [src-tauri/src/commands/ai.rs](src-tauri/src/commands/ai.rs)

**会话管理**：
- `init_ai_session` - 初始化会话
- `create_new_session` - 创建新会话
- `load_ai_session` - 加载历史会话
- `list_ai_sessions` - 列出所有会话
- `delete_ai_session` - 删除会话
- `get_session_metadata` - 获取会话元数据

**消息处理**：
- `send_ai_message` - 发送消息
- `cancel_ai_message` - 取消消息

**配置管理**：
- `get_ai_config` - 获取 AI 配置
- `save_ai_config` - 保存 AI 配置

#### 3.2.3 配置管理

**实现文件**: [src-tauri/src/config/ai_config.rs](src-tauri/src/config/ai_config.rs)

**配置文件位置**: `~/.tweetpilot/ai_config.json`

**配置结构**：
```json
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "api_key": "sk-ant-...",
      "model": "claude-sonnet-4-6",
      "base_url": "https://api.anthropic.com"
    }
  ],
  "active_provider": "anthropic"
}
```

#### 3.2.4 会话存储

**实现文件**: [src-tauri/src/services/conversation_storage.rs](src-tauri/src/services/conversation_storage.rs)

**存储位置**: `~/.tweetpilot/conversations/<session_id>.jsonl`

**存储格式**：
```jsonl
{"role":"user","content":"帮我看看这个脚本","timestamp":1713686400}
{"role":"assistant","content":"好的,让我读取一下...","timestamp":1713686401}
```

**功能**：
- 保存消息到 JSONL 文件
- 加载会话消息
- 列出所有会话（带元数据）
- 删除会话
- 提取会话元数据（标题、时间、消息数）

### 3.3 数据流

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

#### 前端事件监听

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

## 四、用户体验流程

### 4.1 首次使用

```
1. 用户打开 TweetPilot
2. 点击右侧 AI 对话区域
3. 提示配置 API Key
4. 用户输入 API Key、选择模型
5. 保存配置
6. AI 会话初始化完成
```

### 4.2 日常使用

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

## 五、技术细节

### 5.1 工具权限

使用 `PermissionMode::BypassPermissions` 自动允许所有工具调用，简化用户体验。

### 5.2 流式响应

- 后端通过 `window.emit('message-chunk')` 发送文本片段
- 前端累积片段并实时显示
- 使用 `isStreaming` 标记区分流式和完成状态

### 5.3 工具调用可视化

- 显示当前执行的工具名称
- 显示工具执行状态 (running, success, error)
- 3 秒后自动隐藏工具指示器

### 5.4 错误处理

- API 错误 → 显示友好的错误提示
- 工具执行失败 → 显示工具错误信息
- 取消请求 → 清理状态并停止流式响应

---

## 六、关键文件索引

### 后端 (Rust)
- [src-tauri/src/claurst_session.rs](src-tauri/src/claurst_session.rs) - ClaurstSession 封装层
- [src-tauri/src/commands/ai.rs](src-tauri/src/commands/ai.rs) - Tauri Commands
- [src-tauri/src/services/conversation_storage.rs](src-tauri/src/services/conversation_storage.rs) - 会话存储
- [src-tauri/src/config/ai_config.rs](src-tauri/src/config/ai_config.rs) - AI 配置管理

### 前端 (React/TypeScript)
- [src/components/ChatInterface.tsx](src/components/ChatInterface.tsx) - 主对话界面
- [src/components/ChatInterface/AssistantMessage.tsx](src/components/ChatInterface/AssistantMessage.tsx) - AI 消息渲染
- [src/components/ChatInterface/ThinkingBlock.tsx](src/components/ChatInterface/ThinkingBlock.tsx) - Thinking 显示
- [src/components/ChatInterface/ProcessSteps.tsx](src/components/ChatInterface/ProcessSteps.tsx) - 工具调用步骤
- [src/components/ChatInterface/ToolCallCard.tsx](src/components/ChatInterface/ToolCallCard.tsx) - 工具调用卡片
- [src/components/ChatInterface/SessionPanel.tsx](src/components/ChatInterface/SessionPanel.tsx) - 会话历史面板
- [src/components/ChatInterface/SessionList.tsx](src/components/ChatInterface/SessionList.tsx) - 会话列表
- [src/components/ChatInterface/SessionListItem.tsx](src/components/ChatInterface/SessionListItem.tsx) - 会话列表项
- [src/services/ai/tauri.ts](src/services/ai/tauri.ts) - AI 服务层
- [src/types/ai-settings.ts](src/types/ai-settings.ts) - AI 配置类型定义

### 样式
- [src/styles/globals.css](src/styles/globals.css) - 全局样式（包含 VSCode Dark+ 主题变量）

---

## 七、使用指南

### 7.1 配置 AI

1. 打开设置界面（通过主菜单或快捷键）
2. 选择 AI 提供商（Anthropic、OpenAI 或自定义）
3. 输入 API Key
4. 选择模型
5. （可选）配置 Base URL
6. 保存配置

### 7.2 使用 AI 对话

1. 在右侧 AI 对话区域输入消息
2. AI 会实时流式显示回复
3. 工具调用会显示在消息流中
4. 可以随时取消正在进行的请求

### 7.3 会话管理

1. 点击顶部的历史图标（Clock）查看所有会话
2. 点击会话可以加载历史对话
3. 点击新建图标（Plus）创建新会话
4. 悬停在会话上可以删除会话

---

## 八、未来扩展

### 8.1 第二阶段 (账号级会话)

- 每个推特账号有独立的 AI 会话
- 会话 ID 格式: `account-<account_id>-session`
- 在账号详情页显示 AI 对话入口

### 8.2 第三阶段 (脚本生成)

- AI 生成 Python 脚本到工作目录
- 脚本模板参考 ClawBot examples
- 自动创建任务并关联脚本

---

## 九、参考资料

### 9.1 microcompany 实现

- `microcompany/src-tauri/src/claurst/mod.rs` - ClaurstSession 封装层
- `microcompany/src-tauri/src/commands/session.rs` - 会话管理命令
- `microcompany/src-tauri/src/commands/message.rs` - 消息处理命令
- `microcompany/src/components/ChatInterface.tsx` - 前端对话界面

### 9.2 Claurst 文档

- `microcompany/docs/Claurst架构分析.md` - Claurst 架构详解
- `microcompany/docs/Claurst集成方案.md` - 集成方案详解

---

**文档状态**: ✅ 第一阶段已完成  
**最后更新**: 2026-04-22
