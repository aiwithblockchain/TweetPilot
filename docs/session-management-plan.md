# TweetPilot AI 会话管理功能实现计划

**版本:** 1.0  
**日期:** 2026-04-21  
**状态:** 设计方案

---

## 执行摘要

当前 AI 聊天界面每次打开都创建新会话，用户无法访问历史对话。本方案实现类似 Claude IDE 插件的会话管理功能，包括会话列表、切换、新建和删除功能。

**核心目标:**
- 用户可以查看和切换历史会话
- 支持新建会话和删除会话
- 会话持久化存储（已有后端支持）
- 会话元数据展示（标题、时间、消息数）

---

## 问题分析

### 当前问题

1. **无会话管理**
   - 每次打开 AI 界面都创建新会话
   - 无法访问历史对话
   - 会话文件存储在 `~/.tweetpilot/conversations/` 但前端无法访问

2. **用户体验差**
   - 无法回顾之前的对话
   - 无法继续未完成的讨论
   - 会话文件不断累积但无法管理

3. **缺少上下文连续性**
   - 每次都是全新对话，AI 无法利用历史上下文
   - 用户需要重复说明背景信息

### 参考设计

Claude IDE 插件的会话管理功能：
- 顶部有历史记录图标和新建会话按钮
- 点击历史记录显示会话列表
- 每个会话显示：第一条消息摘要、时间、消息数
- 支持删除会话

---

## 设计方案

### 1. 会话数据结构

#### 会话元数据
```typescript
interface SessionMetadata {
  id: string                    // 会话 ID (如 "session-uuid")
  title: string                 // 会话标题（第一条用户消息的摘要）
  created_at: number            // 创建时间戳
  updated_at: number            // 最后更新时间戳
  message_count: number         // 消息总数
  workspace: string             // 关联的工作区路径
}
```

#### 会话列表项
```typescript
interface SessionListItem {
  id: string
  title: string
  preview: string               // 最后一条消息预览
  timestamp: number             // 最后更新时间
  messageCount: number
  isActive: boolean             // 是否是当前会话
}
```

---

## 实现方案

### Phase 1: 后端 API 扩展

#### 1.1 扩展 ConversationStorage

**文件:** `src-tauri/src/services/conversation_storage.rs`

**新增方法:**

```rust
impl ConversationStorage {
    // 列出所有会话（按更新时间倒序）
    pub fn list_sessions(&self) -> Result<Vec<SessionMetadata>, String> {
        // 1. 读取 conversations 目录下所有 .jsonl 文件
        // 2. 解析每个文件获取元数据
        // 3. 按 updated_at 倒序排序
        // 4. 返回 SessionMetadata 列表
    }

    // 获取单个会话的元数据
    pub fn get_session_metadata(&self, session_id: &str) -> Result<SessionMetadata, String> {
        // 1. 读取会话文件
        // 2. 解析消息
        // 3. 提取元数据：
        //    - title: 第一条用户消息的前 50 个字符
        //    - created_at: 第一条消息的时间戳
        //    - updated_at: 最后一条消息的时间戳
        //    - message_count: 消息总数
    }

    // 删除会话
    pub fn delete_session(&self, session_id: &str) -> Result<(), String> {
        // 删除对应的 .jsonl 文件
    }

    // 重命名会话（可选功能）
    pub fn rename_session(&self, session_id: &str, new_title: &str) -> Result<(), String> {
        // 在会话文件开头添加元数据行（可选实现）
    }
}
```

**元数据提取逻辑:**
- 标题：第一条用户消息的前 50 个字符 + "..."
- 创建时间：第一条消息的 timestamp
- 更新时间：最后一条消息的 timestamp
- 消息数：文件行数

#### 1.2 新增 Tauri 命令

**文件:** `src-tauri/src/commands/ai.rs`

**新增命令:**

```rust
#[tauri::command]
pub async fn list_ai_sessions() -> Result<Vec<SessionMetadata>, String> {
    let storage = ConversationStorage::new()?;
    storage.list_sessions()
}

#[tauri::command]
pub async fn get_session_metadata(session_id: String) -> Result<SessionMetadata, String> {
    let storage = ConversationStorage::new()?;
    storage.get_session_metadata(&session_id)
}

#[tauri::command]
pub async fn load_ai_session(
    session_id: String,
    state: State<'_, AiState>,
    window: Window,
) -> Result<Vec<StoredMessage>, String> {
    // 1. 加载会话消息
    let storage = ConversationStorage::new()?;
    let messages = storage.load_messages(&session_id)?;
    
    // 2. 重新初始化 ClaurstSession，恢复消息历史
    // 注意：需要将 StoredMessage 转换为 claurst_core::Message
    
    Ok(messages)
}

#[tauri::command]
pub async fn delete_ai_session(session_id: String) -> Result<(), String> {
    let storage = ConversationStorage::new()?;
    storage.delete_session(&session_id)
}

#[tauri::command]
pub async fn create_new_session(
    working_dir: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    // 1. 生成新的 session_id
    // 2. 初始化新的 ClaurstSession
    // 3. 返回 session_id
}
```

**注册命令:**

在 `src-tauri/src/main.rs` 中注册新命令：
```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有命令 ...
    ai::list_ai_sessions,
    ai::get_session_metadata,
    ai::load_ai_session,
    ai::delete_ai_session,
    ai::create_new_session,
])
```

---

### Phase 2: 前端服务层

#### 2.1 扩展 AI Service

**文件:** `src/services/ai/tauri.ts`

**新增接口和方法:**

```typescript
export interface SessionMetadata {
  id: string
  title: string
  created_at: number
  updated_at: number
  message_count: number
  workspace: string
}

export interface SessionListItem {
  id: string
  title: string
  preview: string
  timestamp: number
  messageCount: number
  isActive: boolean
}

export const aiService = {
  // ... 现有方法 ...

  async listSessions(): Promise<SessionMetadata[]> {
    return invoke('list_ai_sessions')
  },

  async getSessionMetadata(sessionId: string): Promise<SessionMetadata> {
    return invoke('get_session_metadata', { sessionId })
  },

  async loadSession(sessionId: string): Promise<StoredMessage[]> {
    return invoke('load_ai_session', { sessionId })
  },

  async deleteSession(sessionId: string): Promise<void> {
    return invoke('delete_ai_session', { sessionId })
  },

  async createNewSession(workingDir: string): Promise<string> {
    return invoke('create_new_session', { workingDir })
  },
}
```

---

### Phase 3: UI 组件实现

#### 3.1 会话列表组件

**文件:** `src/components/ChatInterface/SessionList.tsx`

**功能:**
- 显示会话列表（按时间倒序）
- 每个会话显示：标题、时间、消息数
- 高亮当前会话
- 点击切换会话
- 删除会话按钮（带确认）

**UI 结构:**
```
┌─ Session List ────────────────────────────┐
│ ┌─ Session Item (active) ───────────────┐ │
│ │ 📝 查看当前目录下的文件                 │ │
│ │ 2026-04-21 22:15 · 8 messages         │ │
│ │                                    [×] │ │
│ └───────────────────────────────────────┘ │
│ ┌─ Session Item ────────────────────────┐ │
│ │ 💬 帮我分析这段代码                     │ │
│ │ 2026-04-21 18:30 · 12 messages        │ │
│ │                                    [×] │ │
│ └───────────────────────────────────────┘ │
│ ┌─ Session Item ────────────────────────┐ │
│ │ 🔧 修复 UI 样式问题                     │ │
│ │ 2026-04-20 15:45 · 6 messages         │ │
│ │                                    [×] │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

**组件代码结构:**
```tsx
interface SessionListProps {
  sessions: SessionListItem[]
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onClose: () => void
}

export function SessionList({ ... }: SessionListProps) {
  return (
    <div className="session-list">
      <div className="session-list-header">
        <h3>会话历史</h3>
        <button onClick={onClose}>×</button>
      </div>
      <div className="session-list-content">
        {sessions.map(session => (
          <SessionListItem
            key={session.id}
            session={session}
            isActive={session.id === currentSessionId}
            onSelect={() => onSelectSession(session.id)}
            onDelete={() => onDeleteSession(session.id)}
          />
        ))}
      </div>
    </div>
  )
}
```

#### 3.2 会话列表项组件

**文件:** `src/components/ChatInterface/SessionListItem.tsx`

**功能:**
- 显示会话标题、时间、消息数
- 高亮激活状态
- Hover 显示删除按钮
- 时间格式化（今天、昨天、具体日期）

**样式:**
- 激活状态：蓝色边框 + 背景高亮
- Hover 状态：背景变深
- 删除按钮：Hover 时显示，点击需确认

#### 3.3 会话管理面板

**文件:** `src/components/ChatInterface/SessionPanel.tsx`

**功能:**
- 侧边栏或下拉面板
- 包含 SessionList 组件
- 支持搜索会话（可选）
- 空状态提示

**打开方式:**
- 点击顶部历史记录图标
- 从右侧滑入或从顶部下拉

---

### Phase 4: ChatInterface 集成

#### 4.1 更新 ChatInterface 组件

**文件:** `src/components/ChatInterface.tsx`

**新增状态:**
```typescript
const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
const [sessions, setSessions] = useState<SessionListItem[]>([])
const [showSessionPanel, setShowSessionPanel] = useState(false)
```

**新增功能:**

1. **加载会话列表**
```typescript
useEffect(() => {
  const loadSessions = async () => {
    try {
      const sessionList = await aiService.listSessions()
      setSessions(sessionList.map(s => ({
        id: s.id,
        title: s.title,
        preview: '',
        timestamp: s.updated_at,
        messageCount: s.message_count,
        isActive: s.id === currentSessionId,
      })))
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }
  loadSessions()
}, [currentSessionId])
```

2. **切换会话**
```typescript
const handleSelectSession = async (sessionId: string) => {
  try {
    const messages = await aiService.loadSession(sessionId)
    setMessages(messages.map(m => ({
      id: `${m.role}-${m.timestamp}`,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
    })))
    setCurrentSessionId(sessionId)
    setShowSessionPanel(false)
    toast.success('会话已加载')
  } catch (error) {
    console.error('Failed to load session:', error)
    toast.error('加载会话失败')
  }
}
```

3. **新建会话**
```typescript
const handleNewSession = async () => {
  try {
    const workingDir = await workspaceService.getCurrentWorkspace()
    if (!workingDir) {
      toast.error('请先选择工作区')
      return
    }
    const sessionId = await aiService.createNewSession(workingDir)
    setMessages([])
    setCurrentSessionId(sessionId)
    setShowSessionPanel(false)
    toast.success('新会话已创建')
  } catch (error) {
    console.error('Failed to create session:', error)
    toast.error('创建会话失败')
  }
}
```

4. **删除会话**
```typescript
const handleDeleteSession = async (sessionId: string) => {
  if (!confirm('确定要删除这个会话吗？')) return
  
  try {
    await aiService.deleteSession(sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    
    if (sessionId === currentSessionId) {
      // 如果删除的是当前会话，创建新会话
      await handleNewSession()
    }
    
    toast.success('会话已删除')
  } catch (error) {
    console.error('Failed to delete session:', error)
    toast.error('删除会话失败')
  }
}
```

#### 4.2 更新 UI 布局

**顶部工具栏添加按钮:**
```tsx
<div className="flex items-center justify-between px-3 py-2 border-b">
  <div className="flex items-center gap-2">
    <span className="text-xs font-medium">Claude Code</span>
    {currentSessionId && (
      <span className="text-xs text-secondary">
        · {sessions.find(s => s.id === currentSessionId)?.title}
      </span>
    )}
  </div>
  <div className="flex items-center gap-2">
    <button
      onClick={() => setShowSessionPanel(!showSessionPanel)}
      className="p-1.5 hover:bg-surface rounded transition-colors"
      title="会话历史"
    >
      🕐
    </button>
    <button
      onClick={handleNewSession}
      className="p-1.5 hover:bg-surface rounded transition-colors"
      title="新建会话"
    >
      ➕
    </button>
    <button
      onClick={handleClear}
      className="text-xs text-secondary hover:text-primary transition-colors"
    >
      Clear
    </button>
  </div>
</div>

{/* Session Panel */}
{showSessionPanel && (
  <SessionPanel
    sessions={sessions}
    currentSessionId={currentSessionId}
    onSelectSession={handleSelectSession}
    onDeleteSession={handleDeleteSession}
    onClose={() => setShowSessionPanel(false)}
  />
)}
```

---

## 视觉设计

### 设计系统参考

**直接使用现有的 VSCode Dark+ 设计系统**（已在 [docs/ai-chat-ui-redesign-spec.md](docs/ai-chat-ui-redesign-spec.md) 中定义）：

**颜色（适配 dark/light 模式）:**
- 背景：`var(--color-surface)` - 卡片/面板背景
- 边框：`var(--color-border)` - 默认边框
- 文字：`var(--color-text)` - 主要文字
- 次要文字：`var(--color-text-secondary)` - 元数据、时间
- 激活状态：`#007ACC` - 蓝色高亮
- Hover 背景：`var(--color-bg)` - 悬停时背景变深

**字体大小:**
- 11px - 元数据（时间、消息数）
- 12px - 会话标题
- 13px - 面板标题

**间距（4px 基准单位）:**
- 8px (sm) - 列表项内边距
- 12px (md) - 列表项之间间距
- 16px (lg) - 面板边距

**圆角:**
- 6px (md) - 会话列表项
- 8px (lg) - 面板容器

### 会话列表样式

```css
/* Session Panel - 使用现有设计系统 */
.session-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  width: 320px;
  max-height: 480px;
  overflow-y: auto;
}

/* Session Item - 与 ToolCallCard 风格一致 */
.session-item {
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 150ms, opacity 150ms;
}

.session-item:hover {
  background: var(--color-bg);
  opacity: 0.8;
}

/* Active Session - 蓝色左边框（类似 VSCode 激活状态）*/
.session-item.active {
  background: rgba(0, 122, 204, 0.1);
  border-left: 3px solid #007ACC;
  padding-left: 9px; /* 12px - 3px border */
}

/* Session Title */
.session-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Session Meta - 与 ToolCallCard 元数据风格一致 */
.session-meta {
  font-size: 11px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Delete Button - Hover 时显示 */
.session-delete {
  opacity: 0;
  transition: opacity 150ms;
  color: var(--color-text-secondary);
}

.session-item:hover .session-delete {
  opacity: 1;
}

.session-delete:hover {
  color: #F48771; /* 错误红色 */
}
```

### 动画效果

**面板滑入动画（200ms，与现有组件一致）:**
```css
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.session-panel {
  animation: slide-in-right 200ms ease-out;
}
```

### 图标使用

**使用 Lucide React 图标（与现有组件一致）:**
- 历史记录：`<Clock />` 或 `<History />`
- 新建会话：`<Plus />` 或 `<FilePlus />`
- 删除会话：`<Trash2 />`
- 展开/折叠：`<ChevronRight />` / `<ChevronDown />`

**不使用 emoji 作为图标**（遵循设计规范）

---

## 实现优先级

### P0 - 核心功能（必须实现）
1. 后端会话列表 API
2. 后端加载会话 API
3. 前端会话列表 UI
4. 前端切换会话功能
5. 新建会话按钮

### P1 - 重要功能（应该实现）
1. 删除会话功能
2. 会话元数据展示（时间、消息数）
3. 当前会话高亮
4. 会话面板动画

### P2 - 增强功能（可选实现）
1. 会话搜索
2. 会话重命名
3. 会话导出
4. 会话标签/分类

---

## 技术细节

### 会话 ID 生成

使用 UUID v4 格式：
```rust
use uuid::Uuid;

let session_id = format!("session-{}", Uuid::new_v4());
```

### 时间格式化

前端时间显示逻辑：
```typescript
function formatSessionTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const oneDay = 24 * 60 * 60 * 1000
  
  if (diff < oneDay) {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } else if (diff < 2 * oneDay) {
    return '昨天'
  } else if (diff < 7 * oneDay) {
    return `${Math.floor(diff / oneDay)} 天前`
  } else {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    })
  }
}
```

### 会话标题生成

后端逻辑：
```rust
fn generate_session_title(first_message: &str) -> String {
    let max_len = 50;
    if first_message.len() <= max_len {
        first_message.to_string()
    } else {
        format!("{}...", &first_message[..max_len])
    }
}
```

---

## 数据迁移

### 现有会话文件处理

当前已有的会话文件格式：
```jsonl
{"role":"user","content":"消息内容","timestamp":1713715200}
{"role":"assistant","content":"回复内容","timestamp":1713715205}
```

**兼容性保证:**
- 现有文件无需迁移
- 新功能向后兼容
- 元数据动态生成（不修改原文件）

---

## 测试计划

### 单元测试

1. **后端测试:**
   - `list_sessions()` 返回正确的会话列表
   - `get_session_metadata()` 正确提取元数据
   - `load_messages()` 正确加载历史消息
   - `delete_session()` 正确删除文件

2. **前端测试:**
   - 会话列表正确渲染
   - 切换会话正确加载消息
   - 删除会话正确更新列表

### 集成测试

1. **会话生命周期:**
   - 创建新会话 → 发送消息 → 关闭界面 → 重新打开 → 会话出现在列表中
   - 切换会话 → 消息正确加载 → 继续对话 → 消息正确追加

2. **边界情况:**
   - 空会话列表
   - 会话文件损坏
   - 并发创建会话
   - 删除当前会话

### 手动测试

1. 创建 5 个会话，验证列表显示
2. 切换到历史会话，验证消息加载
3. 删除会话，验证列表更新
4. 新建会话，验证清空消息
5. 验证 dark/light 模式下的样式

---

## 性能考虑

### 会话列表加载

- 只加载元数据，不加载完整消息内容
- 列表按时间倒序，最多显示 50 个会话
- 使用虚拟滚动（如果会话数量很大）

### 消息加载

- 按需加载：只在切换会话时加载
- 大会话分页加载（可选）
- 缓存当前会话消息

---

## 安全考虑

### 会话隔离

- 每个会话独立存储
- 会话 ID 使用 UUID，不可预测
- 删除会话时彻底删除文件

### 数据验证

- 验证 session_id 格式
- 防止路径遍历攻击
- 验证 JSONL 文件格式

---

## 未来扩展

### Phase 2 功能（未来考虑）

1. **会话分组/标签**
   - 按项目分组
   - 自定义标签
   - 智能分类

2. **会话搜索**
   - 全文搜索
   - 按时间筛选
   - 按工作区筛选

3. **会话导出**
   - 导出为 Markdown
   - 导出为 PDF
   - 分享会话链接

4. **会话同步**
   - 云端同步（需要账号系统）
   - 多设备同步

---

## 实施时间估算

- **Phase 1 (后端 API):** 3-4 小时
- **Phase 2 (前端服务):** 1 小时
- **Phase 3 (UI 组件):** 3-4 小时
- **Phase 4 (集成测试):** 2-3 小时
- **总计:** 9-12 小时

---

## 成功标准

实现后应达到：

**功能完整性:**
- ✅ 用户可以查看所有历史会话
- ✅ 用户可以切换到任意历史会话
- ✅ 用户可以创建新会话
- ✅ 用户可以删除不需要的会话
- ✅ 会话元数据正确显示

**用户体验:**
- ✅ 会话切换流畅，无明显延迟
- ✅ UI 清晰直观，符合 Claude IDE 风格
- ✅ 支持 dark/light 模式
- ✅ 操作有明确的反馈（toast 提示）

**技术质量:**
- ✅ 代码结构清晰，易于维护
- ✅ 错误处理完善
- ✅ 性能良好（会话列表加载 <500ms）
- ✅ 向后兼容现有会话文件

---

## 附录

### 参考资料

- Claude IDE 插件会话管理 UI
- VSCode 扩展开发最佳实践
- Tauri 命令模式文档

### 相关文件

- [ChatInterface.tsx](src/components/ChatInterface.tsx) - 主聊天界面
- [conversation_storage.rs](src-tauri/src/services/conversation_storage.rs) - 会话存储服务
- [ai.rs](src-tauri/src/commands/ai.rs) - AI 命令模块

---

**文档状态:** 待审核  
**作者:** Claude (Sonnet 4.6)  
**最后更新:** 2026-04-21
