# AI 思考 UI 与历史会话恢复实施方案

## 1. 文档目标

本文档合并以下两份文档，作为后续开发的单一执行依据：

- `docs/ai-thinking-history-recovery-plan.md`
- `docs/ai-thinking-history-task-checklist.md`

目标是用最小改动恢复两个能力：

1. 历史会话可稳定加载
2. AI 思考过程与工具步骤可在实时和历史中稳定显示

本次改造以“先恢复可用，再恢复体验”为原则，不做大重构。

---

## 2. 背景与问题定位

当前 AI 聊天模块出现两个明显回归：

1. **思考过程富 UI 消失或退化**
   - 预期表现：展示较完整的 thinking 内容、工具调用过程、步骤状态等。
   - 当前表现：经常只显示 `AI is thinking...`，或者只显示最终回答，看不到过程层。

2. **历史会话无法稳定加载**
   - 预期表现：可从历史列表中打开旧会话，恢复完整聊天记录。
   - 当前表现：部分历史会话无法加载，或者加载后信息不完整。

这两个问题表面上是两个独立故障，实际上共享同一类根因：

- **会话状态依赖运行时内存，而不是完整持久化数据**
- **前端展示依赖流式事件，但流式事件存在丢失窗口**
- **历史存储模型过于简化，只保存最终文本，未保存过程信息**

### 2.1 关键结论

#### 结论 A：富 UI 没有被删除

当前代码中，富展示相关组件仍然存在：

- `src/components/ChatInterface/AssistantMessage.tsx`
- `src/components/ChatInterface/ThinkingBlock.tsx`
- `src/components/ChatInterface/ProcessSteps.tsx`

真正的问题不是 UI 壳子消失，而是**驱动这些 UI 的数据没有稳定到达组件层**。

#### 结论 B：thinking UI 退化有两个核心原因

**原因 1：实时事件存在 `request_id` 竞态窗口**

前端仅处理与当前 `request_id` 匹配的流式事件，但后端是先启动流，再返回 `request_id`。这会导致：

1. 后端已经开始发送 `thinking-chunk` / `tool-call-start`
2. 前端还没来得及设置当前请求 ID
3. 这些早期事件直接被前端忽略

结果：

- `thinking` 字段为空
- `toolCalls` 字段为空
- UI 只能退化为简单占位文案

**原因 2：历史存储只保存最终文本，不保存过程数据**

当前持久化消息结构只有：

- `role`
- `content`
- `timestamp`

没有保存：

- `thinking`
- `thinkingComplete`
- `toolCalls`
- `status`
- 过程步骤元数据

所以即使某条消息在实时阶段显示过丰富过程 UI，一旦重新加载历史，会话也只能恢复为普通文本消息。

#### 结论 C：历史会话加载失败的直接根因

`load_ai_session` 的实现依赖当前内存里已有 active session，才能拿到工作目录并恢复会话。

这会导致以下问题：

- 应用重启后，内存 session 消失，历史会话加载失败
- 如果 AI 模块尚未初始化完成，历史会话加载失败
- 历史数据本应自洽，却被耦合到运行时状态

这属于架构边界错误：**历史加载应该依赖持久化数据，而不是依赖一个正在运行的 session。**

---

## 3. 改造目标

### 3.1 必达目标

1. 历史会话在应用重启后仍可加载
2. 已加载历史至少能稳定展示完整聊天文本
3. 新产生的会话可持久化思考过程与工具调用信息
4. 重新打开历史时，可恢复思考过程富 UI
5. 实时聊天阶段不再因为 `request_id` 竞态丢失早期 thinking/tool 事件

### 3.2 次级目标

1. 会话存储结构具备版本兼容能力
2. 老历史数据可继续读取，不因新字段引发崩溃
3. 前端消息类型和后端存储结构对齐

### 3.3 非目标

这次不做以下事情：

1. 不重写整个 AI 会话架构
2. 不引入复杂事件回放系统
3. 不新增完整的“时间轴调试器”或“思维树可视化”
4. 不处理与本问题无关的 UI 美化或大规模组件重构

---

## 4. 设计原则

### 4.1 历史恢复必须以持久化数据为准

凡是历史会话需要展示的信息，都应该来自磁盘存储，而不是依赖运行中的 session 对象。

### 4.2 实时态与历史态使用同一消息模型

前端 `ChatMessage`、后端持久化 `StoredMessage`、流式增量事件，最终应收敛到同一套核心字段，否则必然出现：

- 实时可显示，历史无法恢复
- 前端有字段，后端不存
- 后端有数据，前端无类型

### 4.3 向前兼容优先

历史已有数据不能废掉。新结构必须允许：

- 旧消息没有 `thinking` / `toolCalls`
- 新消息有完整过程字段
- 旧数据依然能打开，只是显示较简化

### 4.4 分阶段交付

先修可用性，再补体验。

推荐顺序：

1. 修历史加载
2. 补持久化模型
3. 修实时事件竞态
4. 统一渲染与兼容逻辑

---

## 5. 目标数据模型

### 5.1 前后端统一消息结构

建议将存储消息扩展为如下结构：

```ts
interface PersistedToolCall {
  id: string
  tool: string
  status: 'running' | 'completed' | 'failed'
  input?: string
  output?: string
  startedAt?: number
  completedAt?: number
}

interface PersistedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  thinking?: string
  thinkingComplete?: boolean
  toolCalls?: PersistedToolCall[]
  status?: 'streaming' | 'completed' | 'error'
}
```

Rust 端存储结构与之对应。

### 5.2 会话元数据补齐

建议在 session metadata 中明确保存：

```ts
interface SessionMetadata {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  workspace?: string
  messageCount?: number
  schemaVersion: number
}
```

其中：

- `workspace` 用于历史恢复会话上下文
- `schemaVersion` 用于后续兼容处理

---

## 6. 分阶段实施任务

## Phase 1：先恢复历史会话加载

### 任务 1.1：梳理当前历史加载链路

**文件**
- `src-tauri/src/commands/ai.rs`
- `src-tauri/src/services/conversation_storage.rs`
- `src/components/ChatInterface.tsx`

**动作**
- 找出 `load_ai_session` 当前输入、输出、依赖项
- 确认前端 `handleSelectSession` 现在假设的返回结构
- 确认当前失败点是不是依赖 active session

**完成标准**
- 明确当前历史加载的调用链
- 明确需要改哪些函数签名

### 任务 1.2：移除历史加载对 active session 的强依赖

**文件**
- `src-tauri/src/commands/ai.rs`

**动作**
- 修改 `load_ai_session(session_id)`
- 让它只依赖磁盘存储读取历史数据
- 不再要求当前内存里已有 active session
- 如果 workspace 缺失，也允许以只读方式返回历史消息

**完成标准**
- 应用重启后，无 active session 时仍可加载历史
- 不再出现 “No active session to get working directory” 这类错误

### 任务 1.3：统一历史加载返回结构

**文件**
- `src-tauri/src/commands/ai.rs`
- `src/components/ChatInterface.tsx`

**动作**
- 将历史加载返回值统一为：
  - `session`
  - `messages`
- 前端按新结构解析

**完成标准**
- 前后端对历史会话返回结构一致
- 点击历史会话后，消息能正确渲染

---

## Phase 2：补齐持久化数据模型

### 任务 2.1：扩展后端消息存储结构

**文件**
- `src-tauri/src/services/conversation_storage.rs`

**动作**
- 为 `StoredMessage` 增加字段：
  - `id`
  - `thinking`
  - `thinkingComplete`
  - `toolCalls`
  - `status`
- 为 session metadata 增加字段：
  - `workspace`
  - `schemaVersion`

**完成标准**
- Rust 存储结构支持过程数据
- 新字段可为空，不影响旧数据读取

### 任务 2.2：实现旧数据兼容

**文件**
- `src-tauri/src/services/conversation_storage.rs`

**动作**
- 确保旧格式消息反序列化不报错
- 缺失字段时提供默认值或 `None`
- 引入 `schemaVersion` 缺省兼容策略

**完成标准**
- 老历史数据仍可正常读取
- 新旧 schema 共存不崩溃

### 任务 2.3：assistant 消息结束时写入完整快照

**文件**
- `src-tauri/src/claurst_session.rs`

**动作**
- 在内存中聚合 assistant 消息的：
  - `content`
  - `thinking`
  - `toolCalls`
  - `status`
- 响应结束时一次性写盘
- 完成时写入：
  - `thinkingComplete = true`
  - `status = completed`

**完成标准**
- 一次包含 thinking/tool 调用的对话结束后，磁盘中能看到完整 assistant 消息快照

---

## Phase 3：修复实时 thinking 丢失问题

### 任务 3.1：重排 request_id 生命周期

**文件**
- `src-tauri/src/commands/ai.rs`
- `src/components/ChatInterface.tsx`

**动作**
- 调整后端发送逻辑，优先生成并返回 `request_id`
- 在返回 `request_id` 后，再启动流式事件
- 前端拿到 `request_id` 后立刻设置 `currentRequestId`

**完成标准**
- 不再因为 request_id 尚未设置而丢失首批 thinking/tool 事件

### 任务 3.2：给前端增加兜底缓冲或容错

**文件**
- `src/components/ChatInterface.tsx`

**动作**
- 为早期 `thinking-chunk` / `tool-call-start` / `tool-call-end` 增加短暂缓冲或更稳健的匹配逻辑
- 确保空字段、顺序错位时不会直接丢状态

**完成标准**
- 首包 thinking 稳定显示
- 工具调用步骤不会从中间开始

---

## Phase 4：统一前端消息模型与渲染

### 任务 4.1：统一前端消息类型

**文件**
- `src/components/ChatInterface/types.ts`

**动作**
- 对齐前端 `ChatMessage` 与后端持久化消息字段
- 定义 `ToolCall` 持久化后需要的字段

**完成标准**
- 前后端字段对齐
- 前端类型不再只适配实时态

### 任务 4.2：新增历史消息 mapper

**文件**
- `src/components/ChatInterface.tsx`

**动作**
- 新增一个统一 mapper，例如：
  - `fromPersistedMessage()`
- 所有历史消息都通过该 mapper 转成 UI message
- 不在多个组件里散落做字段兼容

**完成标准**
- 历史消息转换逻辑只有一个入口
- 老历史和新历史都能走同一条路径

### 任务 4.3：收紧 fallback 逻辑

**文件**
- `src/components/ChatInterface/AssistantMessage.tsx`

**动作**
- 渲染顺序明确为：
  1. 有 `thinking`，显示 `ThinkingBlock`
  2. 有 `toolCalls`，显示 `ProcessSteps`
  3. 有 `content`，显示正文
  4. 仅在三者都没有时，才显示 `AI is thinking...`

**完成标准**
- `AI is thinking...` 真正变成兜底，而不是主路径
- 历史富消息与实时消息都可显示过程 UI

---

## Phase 5：测试与验收

### 任务 5.1：后端测试

**动作**
- 增加以下测试：
  - 无 active session 时仍可 `load_ai_session`
  - old schema message 可正常读取
  - new schema message 可保存并读取
  - assistant thinking/toolCalls 可完整落盘

**完成标准**
- 核心存储与加载逻辑有回归测试保护

### 任务 5.2：前端测试

**动作**
- 增加以下测试：
  - 历史纯文本消息渲染
  - 历史富消息渲染
  - thinking chunk 到达后的 UI 更新
  - tool call start/end 状态变化
  - fallback 仅在无任何数据时触发

**完成标准**
- 核心 UI 状态有自动化测试保护

### 任务 5.3：手工验收

**动作**
- 跑 3 组手工用例：
  1. 实时长思考对话
  2. 重启应用后加载刚生成的富会话
  3. 加载旧历史会话

**完成标准**
- 实时态正常
- 新历史正常
- 老历史兼容

---

## 7. 风险与兼容策略

### 7.1 老消息兼容

老消息没有 `thinking` / `toolCalls` 是正常的。

前端与后端都应遵循：

- 字段缺失时视为 `None` / `undefined`
- 绝不因为缺字段报错
- 仅展示可用内容

### 7.2 schemaVersion

建议从现在开始给 session metadata 加 `schemaVersion`。

例如：

- `v1`：仅文本消息
- `v2`：包含 `thinking` / `toolCalls` / `status`

这样以后若还要补更多字段，不需要靠猜测数据形状。

### 7.3 老历史不做回填

本次建议：

- 不做老数据补算
- 老数据继续按 plain text 展示
- 新生成的数据使用新结构

原因很简单，旧历史本来就没保存 thinking 原文，事后无法真实恢复。强行“补”只会制造伪数据。

### 7.4 控制前后端类型漂移

如果 Rust 存储结构与 TypeScript 类型不完全一致，会产生隐蔽兼容 bug。

**控制方式：**
- 明确字段表
- 前端集中做一个 mapper，不在多个组件中散落解析逻辑

### 7.5 控制实时态和落盘态不一致

如果实时内存中的 assistant message 与最终写盘快照不同步，历史恢复会继续出问题。

**控制方式：**
- 由单一聚合源生成最终 assistant message
- 不要让多个模块各自拼装 assistant 输出

---

## 8. 推荐执行顺序

### 第一批，先做
- 任务 1.2
- 任务 1.3
- 任务 2.1
- 任务 2.2

### 第二批，再做
- 任务 2.3
- 任务 3.1
- 任务 3.2

### 第三批，收尾
- 任务 4.1
- 任务 4.2
- 任务 4.3
- 任务 5.1
- 任务 5.2
- 任务 5.3

---

## 9. 里程碑

### M1：历史会话恢复可打开
- 历史会话不再依赖 active session
- 应用重启后仍可打开历史

### M2：新会话支持历史恢复富 UI
- thinking/toolCalls 被持久化
- 新生成会话重开后可恢复过程层

### M3：实时思考 UI 恢复稳定
- thinking 首包不丢
- tool 步骤完整显示

### M4：新旧数据统一兼容
- 老历史可读
- 新历史完整
- fallback 仅在真正空数据时出现

---

## 10. 手工验收脚本

### 用例 1：实时 thinking 恢复

1. 发送一个会触发长思考和工具调用的问题
2. 观察是否先出现 thinking 内容
3. 观察是否完整展示步骤卡片
4. 最终回答出现后，thinking/tool 卡片仍保留

### 用例 2：历史恢复

1. 完成一次富 thinking 会话
2. 关闭应用
3. 重新打开应用
4. 打开刚才的历史会话
5. 验证 thinking/tool/process UI 被恢复

### 用例 3：老历史兼容

1. 加载旧版本生成的历史文件
2. 确认仍能打开
3. 确认仅显示普通文本，不崩溃

---

## 11. 建议开发方式

每完成一个 phase，就做一次最小验收，不要全部改完再一起排错。

推荐节奏：

1. 先让历史能打开
2. 再让新历史能恢复过程
3. 再修实时丢事件
4. 最后统一 UI 与测试

---

## 12. 结论与下一步

这次改造不需要从零重做。

因为：

- 富 UI 组件还在
- 会话列表和历史面板也在
- 真正缺的是数据层和时序层的修复

最合理的策略不是推倒重来，而是：

1. 把历史加载从运行时状态里解耦出来
2. 把思考过程当成正式消息数据持久化
3. 把实时事件时序修稳
4. 让前端用统一模型渲染实时态和历史态

如果直接进入实现阶段，建议按下面顺序开工：

1. 先改 `conversation_storage.rs` 和 `load_ai_session`
2. 再改 `claurst_session.rs` 的 assistant message 聚合与落盘
3. 再改 `ChatInterface.tsx` 的 request_id 时序和历史 mapper
4. 最后收尾 `AssistantMessage.tsx` 的 fallback 逻辑
