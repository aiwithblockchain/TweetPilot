# 后台通知架构与任务模块接入方案

## 版本信息
- **版本**: v3.0
- **更新时间**: 2026-04-24
- **状态**: 可实施技术方案
- **目标**: 将“后端事件通知”拆分为两部分：
  1. **通用后台通知架构**：基于消息 ID 的订阅与分发机制
  2. **任务模块接入方案**：使用通用架构完成任务相关消息的发布与监听

---

## 一、为什么要重新拆分

之前的文档虽然已经能落地，但它把“通知机制本身”和“任务模块如何使用通知机制”混在了一起。

这样会带来两个问题：

1. **架构层和业务层耦合过重**
   - 文档一开始就在讨论 `task-executed`、`task-created`
   - 容易让实现偏向“只给任务模块服务”

2. **缺少通用性**
   - 你真正要的不是“任务页自动刷新”这一件事
   - 而是一套**谁能发消息、谁能订阅消息、按消息 ID 分发**的后台通知基础设施
   - 任务模块只是第一个接入者，不应该成为架构本身

因此，新的方案应明确拆成两层：

### 第一层：通用后台通知架构
关注这些问题：
- 消息如何定义
- 如何按消息 ID 订阅
- 如何按消息 ID 广播
- 谁可以发消息
- 谁可以收消息
- 如何清理监听

### 第二层：任务模块接入
关注这些问题：
- 任务模块哪些地方发消息
- 前端任务列表 / 详情如何订阅
- 如何避免重复刷新

---

## 二、总目标

建立一套**通用的后台通知架构**，满足以下要求：

1. **按消息 ID 订阅与分发**
2. **发送方和接收方解耦**
3. **接收方不限定为前端**
   - 可以是前端页面
   - 也可以是后端内部其他模块
   - 未来也可以扩展为窗口级、模块级、服务级监听器
4. **第一版先用 Tauri event system 做跨后端 → 前端广播**
5. **任务模块作为第一批接入者，验证架构可用性**

---

## 三、架构拆分

## 3.1 Part 1：通用后台通知架构

### 核心思想

不要把系统理解成“后端直接给某个页面发事件”。

而应该理解成：

```text
发布方 -> 向某个 message_id 发送消息
通知架构 -> 找到所有订阅了该 message_id 的监听者
通知架构 -> 把消息广播给这些监听者
```

也就是说，消息是围绕 **message_id** 组织的，而不是围绕某个业务组件组织的。

### message_id 的意义

`message_id` 是通知通道的标识。

例如：
- `task-executed`
- `task-created`
- `task-updated`
- `task-deleted`
- `accounts-changed`

它表达的是：

> “谁订阅了这个 ID，谁就能收到这一类消息。”

### 架构边界

通用后台通知架构只负责以下事情：

1. 维护消息 ID 命名规范
2. 提供统一发布入口
3. 保证消息能广播给所有订阅者
4. 屏蔽底层实现细节（当前是 Tauri event）
5. 不关心具体业务含义

它**不负责**：
- 业务状态更新
- 页面刷新逻辑
- 任务模块的统计计算
- 账号模块的同步策略

这些都属于业务层。

---

## 3.2 Part 2：任务模块接入

任务模块只做两件事：

1. 在合适的业务节点**发布消息**
2. 在需要自动刷新的地方**订阅消息**

也就是说：

- 通知架构不关心“任务详情页要不要刷新”
- 任务模块也不关心“消息怎么广播给所有订阅者”

两者通过 `message_id` 对接。

---

## 四、基于当前代码的现实约束

本方案不是从零设计，而是基于当前代码结构来做，所以需要明确几个现实约束。

### 4.1 当前最适合的底层实现：Tauri event system

当前项目已经在 `workspace-changed` 等场景使用 Tauri 事件。

因此第一版通用通知架构，底层直接建立在 Tauri event system 上：

- 后端发布：`app.emit(message_id, payload)`
- 前端订阅：`listen(message_id, callback)`

这意味着：

### 当前第一版的“广播对象”
主要是：
- 当前应用中的前端监听者

### 但架构定义不应限制未来扩展
对文档和封装来说，应保持表述为：

> 这是一个通用通知架构，当前第一版使用 Tauri event 作为广播实现，因此目前最直接的接收方是前端监听者。

未来如果要支持：
- 后端内部订阅者
- 窗口级订阅
- 更复杂的本地消息总线

可以在不改业务语义的情况下替换底层实现。

---

## 五、Part 1：通用后台通知架构设计

## 5.1 架构职责

### 发布方（Publisher）
职责：
- 只负责声明“我要向某个 `message_id` 发送一条消息”
- 不关心有谁在监听
- 不关心监听者数量
- 不关心监听者是前端还是其他模块

### 订阅方（Subscriber）
职责：
- 注册自己感兴趣的 `message_id`
- 收到消息后决定怎么处理
- 自己负责取消订阅和清理

### 通知架构（Notification Architecture）
职责：
- 提供统一发布接口
- 以 `message_id` 为维度广播消息
- 让所有注册了该 `message_id` 的监听者都能收到消息

---

## 5.2 当前第一版的实现形态

### 后端侧统一入口
新增统一模块：
- `src-tauri/src/app_events.rs`

它的职责不是“定义任务模块事件”，而是：

> 定义消息 ID、消息 payload、统一发布函数。

第一版的发布流程是：

```text
业务模块 -> app_events.rs -> Tauri emit(message_id, payload)
```

### 前端侧监听方式
前端任何组件 / hook 只要注册了某个 `message_id`：

```typescript
listen('task-executed', callback)
```

它就会收到对应消息。

这就是当前架构里的“订阅”。

---

## 5.3 message_id 设计原则

### 原则 1：message_id 是稳定通道名
例如：
- `task-executed`
- `task-created`
- `accounts-changed`

不要让 message_id 携带页面信息或 UI 信息，例如：
- `task-detail-pane-refresh`
- `left-sidebar-reload`

因为这些名字会让架构退化成“面向页面的硬编码通知”。

### 原则 2：message_id 表达“事件类型”，不是“处理动作”
例如：
- 好：`task-updated`
- 差：`refresh-task-list`

前者是业务语义，后者是 UI 动作。

### 原则 3：同一个 message_id 可以有多个订阅者
例如：
- 任务详情页监听 `task-executed`
- 任务列表监听 `task-executed`
- 未来统计面板也可以监听 `task-executed`

发布方不需要知道这些订阅者的存在。

### 原则 4：message_id 必须可长期演进
一旦某个 message_id 被多个模块使用，就不应频繁改名。

如果语义发生重大变化，不要复用旧 ID，而应新增新的 message_id，例如：
- `task-executed-v2`
- 或者新增更明确的业务事件 ID

### 原则 5：message_id 使用 kebab-case
统一使用小写短横线风格：
- `task-executed`
- `accounts-changed`

不要混用：
- `taskExecuted`
- `TASK_EXECUTED`
- `task_executed`

Rust 常量名可以是大写，但消息通道实际字符串统一为 kebab-case。

---

## 5.4 payload 设计规范

通用通知架构不仅要规范 `message_id`，还要规范 payload 的形状。

### 规范 1：payload 必须是结构化对象
推荐：
```json
{
  "taskId": "123",
  "status": "success",
  "timestamp": "2026-04-24T10:00:00Z"
}
```

不推荐：
```json
"123"
```
或：
```json
["123", "success"]
```

原因：
- 可读性差
- 扩展性差
- 前后端容易约定漂移

### 规范 2：字段命名统一使用 camelCase
因为当前前端 TypeScript 层更自然使用 camelCase，所以 payload 对外统一使用：
- `taskId`
- `createdAt`
- `messageId`
- `timestamp`

Rust 中通过：
```rust
#[serde(rename_all = "camelCase")]
```
保持一致。

### 规范 3：payload 只承载“通知所需最小信息”
通知架构第一版的目标是“通知 + reload”，而不是完整数据同步。

因此 payload 只保留：
- 用于识别对象的 ID
- 用于辅助判断的状态字段
- 用于日志与排序的时间戳

不要一开始就把整个任务详情、整个账号快照都塞进 payload。

### 规范 4：时间字段统一为 RFC3339 字符串
例如：
- `2026-04-24T10:00:00Z`

不要混用：
- Unix timestamp
- 本地时间字符串
- 非标准格式字符串

### 规范 5：payload 允许向后兼容地扩展字段
例如：
当前：
```json
{
  "taskId": "123",
  "status": "success",
  "timestamp": "..."
}
```

未来可以扩展：
```json
{
  "taskId": "123",
  "status": "success",
  "timestamp": "...",
  "duration": 1.24
}
```

但不要移除已有字段，避免影响旧订阅方。

---

## 5.5 建议引入统一消息信封（Envelope）语义

当前第一版可以继续直接发布业务 payload，但文档层面建议明确“统一消息信封”的演进方向。

### 目标
让所有消息在概念上都具有统一外层结构：

```json
{
  "messageId": "task-executed",
  "timestamp": "2026-04-24T10:00:00Z",
  "payload": {
    "taskId": "123",
    "status": "success"
  }
}
```

### 当前为什么暂不强制实现
因为 Tauri 当前就是按：
- 通道名 = `message_id`
- 内容 = payload

来使用的。

如果第一版强行再包一层 envelope，会让前端监听代码变得更重，而当前收益不明显。

### 文档结论
- **语义层面**：建议采用 envelope 思维
- **实现层面**：第一版暂时仍用 `message_id + payload` 直发

也就是：

```text
message_id = 通道
payload = 消息体
```

---

## 5.7 通用后台通知模块设计

### 文件
- `src-tauri/src/app_events.rs`

### 目标
提供一个统一发布层，而不是在业务代码里散落：

```rust
app.emit("task-executed", ...)
```

### 第一版建议结构

```rust
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const TASK_EXECUTED: &str = "task-executed";
pub const TASK_CREATED: &str = "task-created";
pub const TASK_UPDATED: &str = "task-updated";
pub const TASK_DELETED: &str = "task-deleted";
pub const TASK_PAUSED: &str = "task-paused";
pub const TASK_RESUMED: &str = "task-resumed";
pub const ACCOUNTS_CHANGED: &str = "accounts-changed";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskChangedPayload {
    pub task_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskExecutedPayload {
    pub task_id: String,
    pub status: String,
    pub timestamp: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsChangedPayload {
    pub timestamp: String,
}

pub fn publish_task_created(app: &AppHandle, task_id: &str) {
    let _ = app.emit(TASK_CREATED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_updated(app: &AppHandle, task_id: &str) {
    let _ = app.emit(TASK_UPDATED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_deleted(app: &AppHandle, task_id: &str) {
    let _ = app.emit(TASK_DELETED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_paused(app: &AppHandle, task_id: &str) {
    let _ = app.emit(TASK_PAUSED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_resumed(app: &AppHandle, task_id: &str) {
    let _ = app.emit(TASK_RESUMED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_executed(app: &AppHandle, task_id: &str, status: &str) {
    let _ = app.emit(TASK_EXECUTED, TaskExecutedPayload {
        task_id: task_id.to_string(),
        status: status.to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    });
}

pub fn publish_accounts_changed(app: &AppHandle) {
    let _ = app.emit(ACCOUNTS_CHANGED, AccountsChangedPayload {
        timestamp: chrono::Utc::now().to_rfc3339(),
    });
}
```

### 为什么函数名建议用 `publish_*`
因为这一层本质上是“通用通知架构的发布接口”。

用 `emit_*` 也可以，但 `publish_*` 更能表达：
- 这是一个消息发布动作
- 底层当前虽然是 `emit`，但语义上不是 UI 细节，而是消息架构

### 额外建议：给发布接口增加统一入口约束
如果后续消息 ID 继续增多，可以进一步演进为：

```rust
pub fn publish<M: Serialize>(app: &AppHandle, message_id: &str, payload: M)
```

然后业务层只调用更高层封装：
- `publish_task_created(...)`
- `publish_task_executed(...)`

这样做的好处是：
- 保留统一底座
- 业务层继续拥有强类型 helper
- 将来若底层广播方式变化，只改一处

---

## 5.8 当前第一版的订阅模型

当前第一版不实现一个后端内存里的“注册表 + 分发器”，原因是：

1. 现有项目已经有成熟可用的 Tauri event system
2. 当前最明确的监听方就是前端
3. 直接复用 Tauri，可以避免过度设计

因此，第一版的订阅模型是：

```text
前端组件 / hook 调用 listen(message_id, callback)
= 注册该 message_id 的订阅
```

通知架构负责保证：
- 发布到该 `message_id` 的消息
- 会广播给所有注册了该 `message_id` 的监听者

这已经满足你提出的核心要求：

> 只要注册了某个消息 ID，就可以收到这个消息。

---

## 5.9 架构约束

### 约束 1：业务代码不得直接散落裸 `app.emit(...)`
除了通知架构模块本身，其他业务代码都应通过：

- `publish_task_executed(...)`
- `publish_accounts_changed(...)`

来发消息。

### 约束 2：通知架构不处理业务逻辑
通知架构只发布消息，不做：
- 数据库更新
- 列表刷新
- 页面跳转
- 统计计算

### 约束 3：订阅方自己决定收到消息后的行为
例如：
- 任务列表收到 `task-created` -> reload list
- 任务详情收到 `task-executed` -> reload detail
- 未来别的模块收到同一消息，也可以有不同处理方式

### 约束 4：同一订阅方应避免重复注册同一 message_id
这是当前前端实现里非常容易踩坑的地方。

例如 React 组件重复 mount / rerender 时，如果没有正确 cleanup，可能导致：
- 同一消息被处理多次
- 重复刷新
- 内存泄漏

因此规范要求：
- 谁注册监听，谁负责 cleanup
- 监听逻辑优先写在 `useEffect` 中
- cleanup 中必须调用对应的 `unlisten`

### 约束 5：消息发布失败不能影响主流程
通知架构属于增强能力，不能反过来影响业务主链路。

因此要求：
- 发布消息失败时不得让任务执行失败
- 发布消息失败时不得让数据库事务回滚
- 统一采用忽略错误或记录日志的方式处理

---

## 六、Part 2：任务模块通过通用架构实现订阅与分发

## 6.1 任务模块的目标

任务模块接入通用通知架构后，需要达到：

1. 创建任务后，任务列表自动更新
2. 更新任务后，任务详情和任务列表自动更新
3. 删除任务后，任务列表自动更新
4. 暂停 / 恢复任务后，任务详情和任务列表自动更新
5. 手动执行任务后，任务详情自动更新
6. 定时任务后台执行后，任务详情自动更新

---

## 6.2 任务模块的消息 ID

任务模块第一版使用以下消息 ID：

- `task-created`
- `task-updated`
- `task-deleted`
- `task-paused`
- `task-resumed`
- `task-executed`

这些消息 ID 都属于通用通知架构的一部分，但由任务模块发布和消费。

### 各 message_id 的职责边界

#### `task-created`
语义：
- 新任务已经被成功创建
- 如果需要注册 timer，则 timer 也已经注册成功

适合订阅者：
- 任务列表
- 未来的任务统计面板

#### `task-updated`
语义：
- 任务配置已更新
- 相关 timer 重建已完成

适合订阅者：
- 任务详情页
- 任务列表

#### `task-deleted`
语义：
- 任务已从数据库删除
- 对应 timer 已注销

适合订阅者：
- 任务列表
- 当前打开该任务详情的页面

#### `task-paused`
语义：
- 任务状态已更新为 paused
- 对应 timer 已注销

适合订阅者：
- 任务详情页
- 任务列表

#### `task-resumed`
语义：
- 任务状态已恢复为 idle
- 若为 scheduled task，则 timer 已恢复注册

适合订阅者：
- 任务详情页
- 任务列表

#### `task-executed`
语义：
- 一次任务执行已经完成
- 与该次执行相关的数据库状态已收尾完成

适合订阅者：
- 任务详情页
- 任务列表
- 未来的执行统计模块

### 为什么不只保留一个 `task-changed`

理论上也可以只定义一个：
- `task-changed`

但第一版保留多个更细粒度的 message_id 更合适，原因是：

1. 调试更清晰
2. 订阅方可以按需监听
3. 未来可以更容易做差异化处理

如果后续发现事件过多，也可以在上层再抽象聚合监听，而不是一开始就把语义压扁。

---

## 6.3 任务模块发布方设计

### 手动任务命令属于发布方
文件：`src-tauri/src/task_commands.rs`

这些命令在状态更新完成后发布消息：
- `create_task`
- `update_task`
- `delete_task`
- `pause_task`
- `resume_task`
- `execute_task`

### 发布原则
必须在**状态写入完成后**发布，而不是过早发布。

例如：
- `create_task`：数据库创建成功 + 定时器注册成功后，再发布 `task-created`
- `update_task`：数据库更新 + 任务 timer 重建完成后，再发布 `task-updated`
- `execute_task`：执行结果和状态写回数据库后，再发布 `task-executed`

### 各命令的推荐发布时机

#### `create_task`
发布条件：
1. `create_task(config)` 成功
2. 如果该任务需要注册 timer，则 `register_timer(timer)` 成功

然后再：
- `publish_task_created(...)`

#### `update_task`
发布条件：
1. 数据库更新成功
2. 旧 task timers 已清理
3. 新 task timers 已重建

然后再：
- `publish_task_updated(...)`

#### `delete_task`
发布条件：
1. 任务已从数据库删除
2. 对应 timer 已注销

然后再：
- `publish_task_deleted(...)`

#### `pause_task`
发布条件：
1. 状态已更新为 `paused`
2. 对应 timer 已注销

然后再：
- `publish_task_paused(...)`

#### `resume_task`
发布条件：
1. 状态已恢复为 `idle`
2. 如为定时任务，则 timer 已恢复注册

然后再：
- `publish_task_resumed(...)`

#### `execute_task`
成功分支发布条件：
1. 执行记录已保存
2. 状态已更新为 `idle`
3. 若为 scheduled 且成功，相关执行时间更新逻辑已完成或已尝试完成

失败分支发布条件：
1. 状态已更新为 `failed`

然后再：
- `publish_task_executed(...)`

---

## 6.4 定时器任务执行的发布方设计

文件：
- `src-tauri/src/unified_timer/event_loop.rs`
- `src-tauri/src/unified_timer/executors/python_script.rs`

### 核心原则

**不要在 `PythonScriptExecutor::execute()` 内直接发布 `task-executed`。**

原因：
- 该时刻执行记录虽然已写入，但后续状态还没完全收尾
- `post_execution()` 还会更新执行时间
- `EventLoop` 还会更新 timer 状态

### 正确发布位置
应在 `EventLoop::execute_timer()` 里，在以下步骤全部完成后发布：

1. `executor.execute(context)` 完成
2. `updated_timer` 已更新
3. `executor.post_execution(&updated_timer)` 完成
4. `registry.update_timer(updated_timer)` 完成
5. 若 `timer.id` 以 `task-` 开头，则发布 `task-executed`

也就是说：

```text
执行完成 -> 状态收尾完成 -> publish(task-executed)
```

---

## 6.5 任务模块订阅方设计

### 任务详情页是订阅方
文件：`src/components/TaskDetailContentPane.tsx`

### 监听的消息 ID
- `task-executed`
- `task-updated`
- `task-paused`
- `task-resumed`
- 可选：`task-deleted`

### 行为
如果 payload 里的 `taskId === 当前 taskId`：
- `loadDetail()`

如果是 `task-deleted` 且当前任务被删：
- `onDeleted?.()`

### 订阅策略建议
1. 在组件 mount / `taskId` 变化时注册监听
2. 在 cleanup 时释放监听
3. 只处理和当前 `taskId` 匹配的消息
4. 第一版统一采用 reload detail，而不是局部增量 patch

---

## 6.6 任务列表是订阅方

文件：`src/hooks/useTasksSidebarItems.ts`

### 监听的消息 ID
- `task-created`
- `task-updated`
- `task-deleted`
- `task-paused`
- `task-resumed`
- `task-executed`

### 行为
收到这些消息后：
- 调用 `loadTasks()`

### 优化
采用简单的 300ms 合并刷新策略，避免短时间重复请求。

---

## 七、具体实施方案

## 7.1 Part 1：通用后台通知架构落地

### 文件 1：`src-tauri/src/app_events.rs`

#### 需要实现
1. message_id 常量
2. payload struct
3. `publish_*` 函数

#### 目标
提供统一发布入口，屏蔽底层 Tauri event 细节。

### 文件 2：后端模块入口

#### 需要修改
增加：
```rust
mod app_events;
```

### 文件 3：定时器系统接入 `AppHandle`

涉及文件：
- `src-tauri/src/unified_timer/mod.rs`
- `src-tauri/src/unified_timer/event_loop.rs`
- `src-tauri/src/task_commands.rs`
- `src-tauri/src/commands/workspace.rs`

#### 目标
让任务定时器执行路径和账号同步路径都能调用统一的 `publish_*` 接口。

#### 具体改动
1. `UnifiedTimerManager::new(app_handle: Option<AppHandle>)`
2. `EventLoop` 保存 `app_handle`
3. `WorkspaceContext` 保存 `app_handle`
4. `set_current_workspace()` 创建 context 时传入 `AppHandle`

---

## 7.2 Part 2：任务模块接入落地

### 文件：`src-tauri/src/task_commands.rs`

#### 需要修改的命令
- `create_task`
- `update_task`
- `delete_task`
- `pause_task`
- `resume_task`
- `execute_task`

#### 改动原则
这些命令都新增：
```rust
app: tauri::AppHandle
```

并在完成状态更新后调用：
- `publish_task_created`
- `publish_task_updated`
- `publish_task_deleted`
- `publish_task_paused`
- `publish_task_resumed`
- `publish_task_executed`

### 文件：`src-tauri/src/unified_timer/event_loop.rs`

#### 需要修改
在 `execute_timer()` 完整收尾后，如果是任务 timer：
- `publish_task_executed`

### 文件：`src/components/TaskDetailContentPane.tsx`

#### 需要修改
1. `listen(message_id, callback)` 注册监听
2. 针对当前 `taskId` 过滤消息
3. 收到相关消息后 `loadDetail()`
4. cleanup 时释放监听器

### 文件：`src/hooks/useTasksSidebarItems.ts`

#### 需要修改
1. 监听任务相关消息 ID
2. 收到消息后合并触发 `loadTasks()`
3. cleanup 时释放监听器和 timeout

---

## 八、编码任务清单（按文件拆分）

## 8.1 通用后台通知架构

### `src-tauri/src/app_events.rs`
- [ ] 定义 `message_id` 常量
- [ ] 定义任务类 payload
- [ ] 定义账号类 payload
- [ ] 实现 `publish_*` 发布函数
- [ ] 明确字符串命名统一为 kebab-case
- [ ] 统一使用 `#[serde(rename_all = "camelCase")]`

### 后端模块入口
- [ ] 注册 `app_events` 模块

### `src-tauri/src/unified_timer/mod.rs`
- [ ] 修改 `UnifiedTimerManager::new()` 签名
- [ ] 构造 `EventLoop` 时注入 `AppHandle`

### `src-tauri/src/unified_timer/event_loop.rs`
- [ ] 给 `EventLoop` 增加 `app_handle`
- [ ] 修改 `EventLoop::new()`
- [ ] 修改 `execute_timer()`，使其可访问 `app_handle`

### `src-tauri/src/task_commands.rs`
- [ ] 给 `WorkspaceContext` 增加 `app_handle`
- [ ] 修改 `WorkspaceContext::new()`
- [ ] 用 `app_handle` 初始化 `UnifiedTimerManager`

### `src-tauri/src/commands/workspace.rs`
- [ ] 修改 `set_current_workspace()` 签名
- [ ] 创建 `WorkspaceContext` 时传入 `AppHandle`
- [ ] 修复 `open_folder_dialog()` 调用

---

## 8.2 任务模块接入

### `src-tauri/src/task_commands.rs`
- [ ] `create_task` 发布 `task-created`
- [ ] `update_task` 发布 `task-updated`
- [ ] `delete_task` 发布 `task-deleted`
- [ ] `pause_task` 发布 `task-paused`
- [ ] `resume_task` 发布 `task-resumed`
- [ ] `execute_task` 发布 `task-executed`

### `src-tauri/src/unified_timer/event_loop.rs`
- [ ] 定时器任务完整收尾后发布 `task-executed`

### `src/components/TaskDetailContentPane.tsx`
- [ ] 订阅任务详情相关消息 ID
- [ ] 按 `taskId` 过滤
- [ ] 收到消息后 reload detail
- [ ] cleanup 释放监听器
- [ ] `task-deleted` 时处理当前详情页退出逻辑

### `src/hooks/useTasksSidebarItems.ts`
- [ ] 订阅任务列表相关消息 ID
- [ ] 收到消息后合并 reload tasks
- [ ] cleanup 清理监听器和 timeout
- [ ] 确保重复进入页面不会导致重复订阅

---

## 九、接口级规范

本节定义通用后台通知架构在第一版中的“接口级约定”。

目标是把以下内容固定下来：
- 每个 message_id 的字符串值
- 每个消息 payload 的标准字段
- 每个发布接口的函数签名
- 每个订阅接口应如何使用
- 哪些字段是必填，哪些字段是可选
- 哪些语义边界不能混用

---

### 9.1 message_id 一览表

| message_id | 发布方 | 订阅方 | 语义 |
|---|---|---|---|
| `task-created` | 任务命令 | 任务列表 | 新任务已创建完成，若需要注册 timer，则 timer 也已注册完成 |
| `task-updated` | 任务命令 | 任务列表、任务详情 | 任务配置已更新完成，相关 timer 已重建完成 |
| `task-deleted` | 任务命令 | 任务列表、任务详情 | 任务已删除，对应 timer 已注销 |
| `task-paused` | 任务命令 | 任务列表、任务详情 | 任务已暂停，对应 timer 已注销 |
| `task-resumed` | 任务命令 | 任务列表、任务详情 | 任务已恢复，若为定时任务则 timer 已重新注册 |
| `task-executed` | 手动执行命令 / 定时器事件循环 | 任务列表、任务详情 | 一次任务执行已完成，相关执行状态已收尾完成 |
| `accounts-changed` | 账号同步执行器 | 账号列表、账号详情 | 一轮账号同步已完成，账号相关数据已稳定 |

#### 约束
1. 同一个 message_id 只表达一种稳定语义
2. 不允许把 UI 动作名当作 message_id
3. 若语义发生重大变化，应新增新 message_id，而不是偷偷复用旧 ID

---

### 9.2 Payload 标准结构表

#### `task-created`

```ts
interface TaskChangedPayload {
  taskId: string
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `taskId` | `string` | 是 | 任务唯一 ID |

#### `task-updated`

```ts
interface TaskChangedPayload {
  taskId: string
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `taskId` | `string` | 是 | 被更新的任务 ID |

#### `task-deleted`

```ts
interface TaskChangedPayload {
  taskId: string
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `taskId` | `string` | 是 | 被删除的任务 ID |

#### `task-paused`

```ts
interface TaskChangedPayload {
  taskId: string
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `taskId` | `string` | 是 | 被暂停的任务 ID |

#### `task-resumed`

```ts
interface TaskChangedPayload {
  taskId: string
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `taskId` | `string` | 是 | 被恢复的任务 ID |

#### `task-executed`

```ts
interface TaskExecutedPayload {
  taskId: string
  status: 'success' | 'failed'
  timestamp: string
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `taskId` | `string` | 是 | 执行完成的任务 ID |
| `status` | `'success' | 'failed'` | 是 | 该次执行最终结果 |
| `timestamp` | `string` | 是 | 发布时间，RFC3339 格式 |

#### `accounts-changed`

```ts
interface AccountsChangedPayload {
  timestamp: string
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `timestamp` | `string` | 是 | 本轮账号同步完成时间，RFC3339 格式 |

#### Payload 通用约束
1. 对外字段统一使用 camelCase
2. 时间字段统一使用 RFC3339 字符串
3. 第一版不允许把完整详情对象塞入 payload
4. 允许未来新增字段，但不应移除现有字段

---

### 9.3 Rust 发布接口规范

第一版建议在 `src-tauri/src/app_events.rs` 中提供以下接口。

#### 统一底层发布接口（建议）

```rust
pub fn publish<M: serde::Serialize>(
    app: &tauri::AppHandle,
    message_id: &str,
    payload: M,
)
```

#### 语义化发布接口（业务层实际调用）

```rust
pub fn publish_task_created(app: &AppHandle, task_id: &str)
pub fn publish_task_updated(app: &AppHandle, task_id: &str)
pub fn publish_task_deleted(app: &AppHandle, task_id: &str)
pub fn publish_task_paused(app: &AppHandle, task_id: &str)
pub fn publish_task_resumed(app: &AppHandle, task_id: &str)
pub fn publish_task_executed(app: &AppHandle, task_id: &str, status: &str)
pub fn publish_accounts_changed(app: &AppHandle)
```

#### `publish` 底层接口行为约束
1. 必须调用底层广播实现发送消息
2. 发送失败不得影响主业务流程
3. 可以记录日志，但不能 panic
4. 不应在此层写任何业务判断

#### `publish_task_executed` 额外约束
1. `status` 第一版只允许 `success` 或 `failed`
2. 不允许传入 `running`、`idle`、`paused` 等任务状态字段值
3. 这是“执行结果状态”，不是“任务生命周期状态”

---

### 9.4 Rust Payload 结构定义规范

建议统一使用：

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
```

#### 标准定义

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskChangedPayload {
    pub task_id: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskExecutedPayload {
    pub task_id: String,
    pub status: String,
    pub timestamp: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsChangedPayload {
    pub timestamp: String,
}
```

#### 约束
1. 对外统一输出 camelCase
2. 内部字段名允许使用 Rust 风格 snake_case
3. 第一版不在 payload struct 中引入泛型抽象
4. 如果未来字段变多，再考虑抽象公共基类或 envelope

---

### 9.5 订阅接口规范（前端）

当前第一版前端订阅统一基于：

```ts
listen<T>(messageId, callback)
```

#### 标准使用方式

```ts
import { listen } from '@tauri-apps/api/event'

const unlisten = await listen<TaskExecutedPayload>('task-executed', (event) => {
  // handle event.payload
})
```

#### 订阅方约束
1. 必须在组件或 hook 生命周期内注册
2. 必须保存 `unlisten`
3. 必须在 cleanup 中释放 `unlisten`
4. 若消息只作用于当前对象，必须先按 ID 过滤再处理

#### 推荐模式

```ts
useEffect(() => {
  let disposed = false
  let unlisten: null | (() => void) = null

  const setup = async () => {
    const fn = await listen<TaskChangedPayload>('task-updated', (event) => {
      if (event.payload.taskId === taskId) {
        void loadDetail()
      }
    })

    if (disposed) {
      fn()
      return
    }

    unlisten = fn
  }

  void setup()

  return () => {
    disposed = true
    unlisten?.()
  }
}, [taskId])
```

---

### 9.6 任务模块发布接口与触发时机对照表

| 发布接口 | 触发文件 | 触发函数 | 触发时机 |
|---|---|---|---|
| `publish_task_created` | `task_commands.rs` | `create_task` | 数据库创建成功且 timer 注册完成后 |
| `publish_task_updated` | `task_commands.rs` | `update_task` | 数据库更新成功且 task timers 重建完成后 |
| `publish_task_deleted` | `task_commands.rs` | `delete_task` | 数据库删除成功且 timer 注销后 |
| `publish_task_paused` | `task_commands.rs` | `pause_task` | 状态变更为 paused 且 timer 注销后 |
| `publish_task_resumed` | `task_commands.rs` | `resume_task` | 状态恢复且 timer 注册后 |
| `publish_task_executed` | `task_commands.rs` | `execute_task` | 手动执行结果已写回数据库后 |
| `publish_task_executed` | `event_loop.rs` | `execute_timer` | 定时器任务执行已完整收尾后 |
| `publish_accounts_changed` | `localbridge_sync_executor.rs` | `execute` | 一轮账号同步全部完成后 |

#### 特别说明
- `task-executed` 有两个发布入口是合理的，因为它们对应两条执行路径：
  - 手动执行路径
  - 定时器执行路径
- 但两条路径必须保证**对外语义完全一致**

---

### 9.7 任务模块订阅接口与处理行为对照表

| 订阅方 | 文件 | 监听 message_id | 收到后行为 |
|---|---|---|---|
| 任务详情 | `TaskDetailContentPane.tsx` | `task-executed` | 若 taskId 匹配，则 reload detail |
| 任务详情 | `TaskDetailContentPane.tsx` | `task-updated` | 若 taskId 匹配，则 reload detail |
| 任务详情 | `TaskDetailContentPane.tsx` | `task-paused` | 若 taskId 匹配，则 reload detail |
| 任务详情 | `TaskDetailContentPane.tsx` | `task-resumed` | 若 taskId 匹配，则 reload detail |
| 任务详情 | `TaskDetailContentPane.tsx` | `task-deleted` | 若 taskId 匹配，则退出当前详情 |
| 任务列表 | `useTasksSidebarItems.ts` | `task-created` | 合并 reload tasks |
| 任务列表 | `useTasksSidebarItems.ts` | `task-updated` | 合并 reload tasks |
| 任务列表 | `useTasksSidebarItems.ts` | `task-deleted` | 合并 reload tasks |
| 任务列表 | `useTasksSidebarItems.ts` | `task-paused` | 合并 reload tasks |
| 任务列表 | `useTasksSidebarItems.ts` | `task-resumed` | 合并 reload tasks |
| 任务列表 | `useTasksSidebarItems.ts` | `task-executed` | 合并 reload tasks |

---

### 9.8 错误处理接口约定

#### 发布侧
- `publish_*` 不向业务层抛出通知失败异常
- 失败时可记录日志
- 主流程继续执行

#### 订阅侧
- callback 内异常不应导致整个页面崩溃
- 如果收到非法 payload，应忽略并记录调试信息
- 不应因为某一次 reload 失败而移除监听器

---

### 9.9 版本演进约定

如果未来要升级通知架构，建议遵守以下顺序：

1. **先扩展 payload 字段**
   - 向后兼容成本最低
2. **再增加新的 message_id**
   - 用于承载新语义
3. **最后才考虑替换底层广播机制**
   - 例如从纯 Tauri event 扩展为后端内总线 + 前端桥接

不建议一开始就：
- 大规模重命名已有 message_id
- 用一个超级泛化事件承载所有业务变化
- 为当前项目引入复杂总线库

---

## 十、后续扩展：账号模块作为第二批接入者

账号模块不是本次文档的重点，但为了验证通用架构具有复用性，文档保留它的接入方向。

### 消息 ID
- `accounts-changed`

### 发布方
文件：`src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs`

#### 原则
在一轮同步结束后统一发布一次：
- 不逐账号发布
- 不在 `process_user_info()` 中发布

### 订阅方
文件：
- `src/hooks/useAppLayoutState.ts`
- `src/components/AccountDetailPane.tsx`

#### 行为
- 账号列表收到 `accounts-changed` -> `reloadAccounts()`
- 账号详情收到 `accounts-changed` -> `reloadDetail()`

---

## 十一、测试计划

### 11.1 通用架构验证

#### 用例 1：同一 message_id 多订阅者都能收到消息
1. 让任务列表和任务详情同时监听 `task-executed`
2. 发布一条 `task-executed`
3. 验证两个订阅方都收到通知

#### 用例 2：未订阅者不会收到消息
1. 仅注册 `task-executed`
2. 发布 `task-created`
3. 验证未监听 `task-created` 的组件无动作

### 11.2 任务模块验证

#### 用例 3：创建任务后列表自动刷新
1. 打开任务页
2. 创建任务
3. 验证任务列表自动刷新

#### 用例 4：更新任务后详情自动刷新
1. 打开任务详情
2. 修改配置
3. 验证详情自动刷新

#### 用例 5：手动执行任务后详情自动刷新
1. 打开任务详情
2. 点击执行
3. 验证执行历史与统计自动刷新

#### 用例 6：定时任务执行后详情自动刷新
1. 创建短间隔定时任务
2. 保持详情页打开
3. 等待后台执行
4. 验证详情自动刷新

### 11.3 稳定性验证

#### 用例 7：重复进入页面不会造成重复订阅泄漏
1. 进入任务页
2. 离开任务页
3. 再返回任务页
4. 验证同一消息不会被处理多次

#### 用例 8：短时间连续事件不会造成严重抖动
1. 连续触发多个任务相关消息
2. 验证任务列表刷新被合理合并

---

## 十二、风险与注意事项

### 12.1 通知架构和业务逻辑必须分层
不要在通知模块中写任务模块的业务逻辑，也不要在业务代码里散落裸 `app.emit(...)`。

### 12.2 事件必须在状态真正完成后再发布
尤其是 `task-executed`，不能在执行器过早发布。

### 12.3 当前第一版的广播实现依赖 Tauri event
这意味着当前最直接的接收方是前端监听者。
但文档和封装应保持通用，不把架构写死成“只能通知前端”。

### 12.4 订阅方必须自己 cleanup
谁注册监听，谁负责释放监听。

---

## 十三、实施优先级

### 高优先级
1. Part 1：通用后台通知架构
2. Part 2：任务模块接入

### 中优先级
3. 任务列表的合并刷新优化
4. 账号模块接入

### 低优先级
5. 更丰富的 payload
6. 更复杂的后端内部订阅模型

---

## 十四、最终结论

这项工作应该明确拆成两部分：

### 第一部分：通用后台通知架构
- 基于 `message_id` 的发布与订阅语义
- 发送方只负责向某个 `message_id` 发送消息
- 通知架构负责将消息广播给所有注册了该 `message_id` 的监听者
- 当前第一版通过 Tauri event system 实现跨后端 → 前端广播

### 第二部分：任务模块通过通用架构实现订阅与分发
- 任务模块在正确的业务节点发布消息
- 任务详情与任务列表按需订阅这些消息
- 通过消息架构解耦业务状态更新与界面刷新

这样整理后，架构层和业务层边界更清晰，也更符合后续扩展到账号模块、数据积木模块甚至后端内部监听器的方向。
