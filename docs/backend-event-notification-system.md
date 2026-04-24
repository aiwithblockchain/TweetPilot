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

### 约束 4：消息架构只负责收发，订阅方必须异步处理自己的逻辑
这是本方案的硬约束。

通知架构的职责到“把消息送达订阅方”为止，不负责等待订阅方把业务逻辑执行完。

因此要求：
- 消息发布动作只负责广播，不串行等待各订阅方业务完成
- 订阅方收到消息后，必须自行异步处理后续逻辑
- 某个订阅方执行自己的 reload / 同步 / 计算时，不得阻塞其他订阅方继续接收同一条消息
- 不允许把“一个订阅方处理完成”作为“下一个订阅方开始接收”的前置条件

可以把它理解成：

```text
消息架构负责投递
订阅方各自并发/异步消费
订阅方之间互不等待
```

落地要求：
- 后端通知层不实现“按订阅方顺序串行执行回调”的语义
- 前端监听回调中，如需执行耗时逻辑，应立即转入自己的异步流程，不要把消息通道当作串行任务队列
- 第一版前端推荐模式仍然是：收到消息 -> 触发 `void load...()` / debounce reload
- 如果未来引入后端内部订阅者，也必须遵守同样原则：收消息与处理业务解耦

### 约束 5：同一订阅方应避免重复注册同一 message_id
这是当前前端实现里非常容易踩坑的地方。

例如 React 组件重复 mount / rerender 时，如果没有正确 cleanup，可能导致：
- 同一消息被处理多次
- 重复刷新
- 内存泄漏

因此规范要求：
- 谁注册监听，谁负责 cleanup
- 监听逻辑优先写在 `useEffect` 中
- cleanup 中必须调用对应的 `unlisten`

### 约束 6：消息发布失败不能影响主流程
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

## 九、伪代码级规范

本节把“接口级规范”继续下沉一层，直接约束到**伪代码执行顺序**。

目标不是写成可直接编译的最终代码，而是把以下内容固定下来：
- 每条发布链路的调用顺序
- 每个发布点的前置条件
- 每个订阅方的标准实现骨架
- `AppHandle` 在上下文与定时器系统中的传递方式
- 哪些位置可以发布，哪些位置不能发布

要求：
- 伪代码必须尽量贴近当前代码结构
- 先约束顺序，再约束抽象
- 第一版不引入额外总线层，不引入复杂注册中心

---

### 9.1 `app_events.rs` 伪代码规范

文件：`src-tauri/src/app_events.rs`

#### 目标
提供一个唯一的“消息发布层”，屏蔽业务代码中的裸 `app.emit(...)`。

#### 伪代码骨架

```rust
use chrono::Utc;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const TASK_CREATED: &str = "task-created";
pub const TASK_UPDATED: &str = "task-updated";
pub const TASK_DELETED: &str = "task-deleted";
pub const TASK_PAUSED: &str = "task-paused";
pub const TASK_RESUMED: &str = "task-resumed";
pub const TASK_EXECUTED: &str = "task-executed";
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

pub fn publish<M: Serialize>(app: &AppHandle, message_id: &str, payload: M) {
    if let Err(error) = app.emit(message_id, payload) {
        // 只记录日志，不中断业务主流程
        eprintln!("failed to publish {message_id}: {error}");
    }
}

pub fn publish_task_created(app: &AppHandle, task_id: &str) {
    publish(app, TASK_CREATED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_updated(app: &AppHandle, task_id: &str) {
    publish(app, TASK_UPDATED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_deleted(app: &AppHandle, task_id: &str) {
    publish(app, TASK_DELETED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_paused(app: &AppHandle, task_id: &str) {
    publish(app, TASK_PAUSED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_resumed(app: &AppHandle, task_id: &str) {
    publish(app, TASK_RESUMED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_executed(app: &AppHandle, task_id: &str, status: &str) {
    publish(app, TASK_EXECUTED, TaskExecutedPayload {
        task_id: task_id.to_string(),
        status: status.to_string(),
        timestamp: Utc::now().to_rfc3339(),
    });
}

pub fn publish_accounts_changed(app: &AppHandle) {
    publish(app, ACCOUNTS_CHANGED, AccountsChangedPayload {
        timestamp: Utc::now().to_rfc3339(),
    });
}
```

#### 强约束
1. 业务模块不得直接写裸 `app.emit(...)`
2. `publish()` 失败时只能记录日志，不能 `panic`
3. `publish_task_executed()` 的 `status` 只允许 `success` / `failed`
4. 第一版不要在这里塞业务判断和数据库逻辑

---

### 9.2 `AppHandle` 传递链路伪代码规范

#### 目标
保证三条路径都能拿到统一发布能力：
1. 手动任务命令路径
2. 定时器执行路径
3. 账号同步执行器路径

#### 约束链路

```text
Tauri command / app runtime
  -> AppHandle
  -> WorkspaceContext
  -> UnifiedTimerManager
  -> EventLoop / executors
  -> app_events::publish_*(...)
```

#### `WorkspaceContext` 伪代码

```rust
pub struct WorkspaceContext {
    pub db: Arc<std::sync::Mutex<TaskDatabase>>,
    pub executor: Arc<TaskExecutor>,
    pub timer_manager: UnifiedTimerManager,
    pub workspace_path: String,
    pub app_handle: tauri::AppHandle,
}

impl WorkspaceContext {
    pub fn new(
        workspace_path: String,
        app_handle: tauri::AppHandle,
    ) -> Result<Self, String> {
        let db = /* create db */;
        let executor = Arc::new(TaskExecutor::new());
        let timer_manager = UnifiedTimerManager::new(Some(app_handle.clone()));

        Ok(Self {
            db,
            executor,
            timer_manager,
            workspace_path,
            app_handle,
        })
    }
}
```

#### `set_current_workspace()` 伪代码

```rust
#[tauri::command]
pub async fn set_current_workspace(
    path: String,
    app: tauri::AppHandle,
    task_state: tauri::State<'_, TaskState>,
) -> Result<(), String> {
    validate_path(&path)?;
    ensure_workspace_initialized(&path).await?;

    {
        let mut guard = task_state.workspace_context.lock().await;
        let old = guard.take();
        drop(guard);

        if let Some(old_ctx) = old {
            old_ctx.shutdown().await?;
        }
    }

    let new_ctx = WorkspaceContext::new(path.clone(), app.clone())?;
    new_ctx.start_timers().await?;

    {
        let mut guard = task_state.workspace_context.lock().await;
        *guard = Some(new_ctx);
    }

    persist_current_workspace(path)?;
    Ok(())
}
```

#### 强约束
1. `AppHandle` 必须进入 `WorkspaceContext`
2. `UnifiedTimerManager` 必须在创建时拿到 `AppHandle`
3. 定时器执行路径不得依赖“临时现取全局 app”这种隐式方式
4. 后续所有发布动作都应可从上下文对象稳定拿到 `app_handle`

---

### 9.3 任务命令发布链路伪代码规范

文件：`src-tauri/src/task_commands.rs`

#### 统一原则
每个命令都遵循：

```text
读取上下文
-> 执行业务修改
-> 完成数据库 / timer 收尾
-> 发布消息
-> 返回结果
```

不能反过来写成：

```text
发布消息
-> 再去写数据库 / 改 timer
```

#### `create_task` 伪代码

```rust
#[tauri::command]
pub async fn create_task(
    request: CreateTaskRequest,
    state: State<'_, TaskState>,
) -> Result<TaskConfig, String> {
    let ctx = state.require_workspace_context()?;

    let task = ctx.db.lock()?.create_task(request.clone())?;

    if task.task_type == "scheduled" && task.enabled {
        let timer = build_task_timer(&task, &ctx.workspace_path)?;
        ctx.timer_manager.register_timer(timer).await?;
    }

    app_events::publish_task_created(&ctx.app_handle, &task.id);

    Ok(task)
}
```

#### `update_task` 伪代码

```rust
#[tauri::command]
pub async fn update_task(
    request: UpdateTaskRequest,
    state: State<'_, TaskState>,
) -> Result<TaskConfig, String> {
    let ctx = state.require_workspace_context()?;

    let existing = ctx.db.lock()?.get_task(&request.id)?;

    unregister_task_timers(&ctx.timer_manager, &existing.id).await?;

    let updated = ctx.db.lock()?.update_task(request)?;

    if updated.task_type == "scheduled" && updated.enabled && updated.status != "paused" {
        let timer = build_task_timer(&updated, &ctx.workspace_path)?;
        ctx.timer_manager.register_timer(timer).await?;
    }

    app_events::publish_task_updated(&ctx.app_handle, &updated.id);

    Ok(updated)
}
```

#### `delete_task` 伪代码

```rust
#[tauri::command]
pub async fn delete_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let ctx = state.require_workspace_context()?;

    unregister_task_timers(&ctx.timer_manager, &task_id).await?;
    ctx.db.lock()?.delete_task(&task_id)?;

    app_events::publish_task_deleted(&ctx.app_handle, &task_id);

    Ok(())
}
```

#### `pause_task` 伪代码

```rust
#[tauri::command]
pub async fn pause_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let ctx = state.require_workspace_context()?;

    ctx.db.lock()?.update_task_status(&task_id, "paused")?;
    unregister_task_timers(&ctx.timer_manager, &task_id).await?;

    app_events::publish_task_paused(&ctx.app_handle, &task_id);

    Ok(())
}
```

#### `resume_task` 伪代码

```rust
#[tauri::command]
pub async fn resume_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let ctx = state.require_workspace_context()?;

    let task = ctx.db.lock()?.get_task(&task_id)?;
    ctx.db.lock()?.update_task_status(&task_id, "idle")?;

    if task.task_type == "scheduled" && task.enabled {
        let timer = build_task_timer(&task, &ctx.workspace_path)?;
        ctx.timer_manager.register_timer(timer).await?;
    }

    app_events::publish_task_resumed(&ctx.app_handle, &task_id);

    Ok(())
}
```

#### `execute_task` 伪代码

```rust
#[tauri::command]
pub async fn execute_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<ExecutionResult, String> {
    let ctx = state.require_workspace_context()?;

    let task = ctx.db.lock()?.get_task(&task_id)?;
    ensure_not_running(&task)?;

    ctx.db.lock()?.update_task_status(&task_id, "running")?;

    let result = ctx.executor.execute_task(&task, &ctx.workspace_path).await;

    match result {
        Ok(exec_result) => {
            ctx.db.lock()?.save_execution(&exec_result)?;
            ctx.db.lock()?.update_task_status(&task_id, "idle")?;
            try_update_schedule_metadata(&ctx, &task, &exec_result).await?;

            app_events::publish_task_executed(&ctx.app_handle, &task_id, "success");
            Ok(exec_result)
        }
        Err(error) => {
            ctx.db.lock()?.update_task_status(&task_id, "failed")?;

            app_events::publish_task_executed(&ctx.app_handle, &task_id, "failed");
            Err(error)
        }
    }
}
```

#### 强约束
1. 所有 `publish_task_*` 都必须放在数据库状态稳定之后
2. 如果 timer 注册失败，则不能提前发布成功类消息
3. `execute_task` 的成功消息必须在 execution 保存与状态恢复后发布
4. `execute_task` 的失败消息必须在状态改成 `failed` 后发布

---

### 9.4 定时器执行发布链路伪代码规范

文件：`src-tauri/src/unified_timer/event_loop.rs`

#### 目标
统一规范定时任务执行完成后的 `task-executed` 发布点。

#### 禁止做法
不要在：
- `PythonScriptExecutor::execute()`
- `PythonScriptExecutor::post_execution()`

里直接发布 `task-executed`。

原因：这些位置都不是“整条执行链已经稳定收尾”的最终点。

#### `EventLoop::execute_timer()` 伪代码

```rust
async fn execute_timer(&self, timer: Timer) -> Result<(), String> {
    let executor = self.registry.get_executor(&timer.executor_type).await?;

    self.registry.mark_running(&timer.id).await?;

    let execution_result = executor.execute(timer.execution_context()).await;

    let mut updated_timer = timer.clone();
    updated_timer = build_next_timer_state(updated_timer, &execution_result)?;

    executor.post_execution(&updated_timer).await?;
    self.registry.update_timer(updated_timer.clone()).await?;

    if is_task_timer(&updated_timer.id) {
        if let Some(task_id) = parse_task_id(&updated_timer.id) {
            let status = if execution_result.is_ok() { "success" } else { "failed" };

            if let Some(app_handle) = &self.app_handle {
                app_events::publish_task_executed(app_handle, &task_id, status);
            }
        }
    }

    Ok(())
}
```

#### 强约束
1. `publish_task_executed()` 只能在 `registry.update_timer()` 之后触发
2. 必须先完成 `post_execution()`
3. 必须从 timer id 中稳定解析出 task id 后才能发布
4. 若 `app_handle` 缺失，则允许跳过发布，但不能影响定时器主流程

---

### 9.5 账号同步发布链路伪代码规范

文件：`src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs`

#### 目标
把 `accounts-changed` 发布点固定在“一轮同步真正结束之后”。

#### 禁止做法
不要在 `process_user_info()` 内逐账号发布 `accounts-changed`。

因为该函数只代表：
- 单个账号处理完成
- 不是整轮同步稳定完成

#### `execute()` 伪代码

```rust
async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult, String> {
    let users = load_online_users(&context).await?;

    for user in users {
        self.process_user_info(&user).await?;
    }

    if let Some(app_handle) = &self.app_handle {
        app_events::publish_accounts_changed(app_handle);
    }

    Ok(build_sync_result())
}
```

#### `process_user_info()` 伪代码

```rust
async fn process_user_info(&self, user: &UserInfo) -> Result<(), String> {
    upsert_account(user)?;

    if should_insert_snapshot(user)? {
        insert_account_snapshot(user)?;
    }

    // 这里不能发布 accounts-changed
    Ok(())
}
```

#### 强约束
1. 一轮同步最多发布一次 `accounts-changed`
2. 发布点必须在全部账号处理完成后
3. `process_user_info()` 里保留纯数据处理职责，不承担通知职责

---

### 9.6 前端任务详情订阅伪代码规范

文件：`src/components/TaskDetailContentPane.tsx`

#### 目标
当前详情页只响应与“当前 taskId”有关的消息。

#### 伪代码

```ts
useEffect(() => {
  if (!taskId) return

  let disposed = false
  const unlistenFns: Array<() => void> = []

  const bind = async () => {
    const messageIds = [
      'task-executed',
      'task-updated',
      'task-paused',
      'task-resumed',
      'task-deleted',
    ] as const

    for (const messageId of messageIds) {
      const unlisten = await listen<TaskChangedPayload | TaskExecutedPayload>(messageId, (event) => {
        const payload = event.payload

        if (!payload || payload.taskId !== taskId) {
          return
        }

        if (messageId === 'task-deleted') {
          onDeleted?.()
          return
        }

        void loadDetail()
      })

      if (disposed) {
        unlisten()
      } else {
        unlistenFns.push(unlisten)
      }
    }
  }

  void bind()

  return () => {
    disposed = true
    for (const fn of unlistenFns) {
      fn()
    }
  }
}, [taskId, loadDetail, onDeleted])
```

#### 强约束
1. 必须先判断 `payload.taskId === 当前 taskId`
2. `task-deleted` 不再 reload detail，而是退出详情态
3. cleanup 必须释放全部 `unlisten`
4. 第一版统一 reload detail，不做局部 patch
5. 监听回调本身不得承载串行阻塞逻辑；收到消息后应立即进入自己的异步流程，例如 `void loadDetail()`

---

### 9.7 前端任务列表订阅伪代码规范

文件：`src/hooks/useTasksSidebarItems.ts`

#### 目标
任务列表可以订阅多个消息，但把高频刷新合并成一次请求。

#### 伪代码

```ts
useEffect(() => {
  let disposed = false
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  const unlistenFns: Array<() => void> = []

  const scheduleReload = () => {
    if (reloadTimer) {
      clearTimeout(reloadTimer)
    }

    reloadTimer = setTimeout(() => {
      reloadTimer = null
      void loadTasks()
    }, 300)
  }

  const bind = async () => {
    const messageIds = [
      'task-created',
      'task-updated',
      'task-deleted',
      'task-paused',
      'task-resumed',
      'task-executed',
    ] as const

    for (const messageId of messageIds) {
      const unlisten = await listen(messageId, () => {
        scheduleReload()
      })

      if (disposed) {
        unlisten()
      } else {
        unlistenFns.push(unlisten)
      }
    }
  }

  void bind()

  return () => {
    disposed = true

    if (reloadTimer) {
      clearTimeout(reloadTimer)
    }

    for (const fn of unlistenFns) {
      fn()
    }
  }
}, [loadTasks])
```

#### 强约束
1. 任务列表不按 `taskId` 过滤，统一合并 reload
2. 必须清理 timeout 和全部 `unlisten`
3. 第一版 debounce / merge 窗口固定为 300ms 即可，不做复杂调度
4. 监听回调中只负责调度 reload，不直接做耗时串行工作，避免影响同一批消息的后续消费

---

### 9.8 账号列表与账号详情订阅伪代码规范

文件：
- `src/hooks/useAppLayoutState.ts`
- `src/components/AccountDetailPane.tsx`

#### 账号列表订阅伪代码

```ts
useEffect(() => {
  let unlisten: null | (() => void) = null
  let disposed = false

  const bind = async () => {
    const fn = await listen<AccountsChangedPayload>('accounts-changed', () => {
      void reloadAccounts()
    })

    if (disposed) {
      fn()
      return
    }

    unlisten = fn
  }

  void bind()

  return () => {
    disposed = true
    unlisten?.()
  }
}, [reloadAccounts])
```

#### 账号详情订阅伪代码

```ts
useEffect(() => {
  if (!selectedAccountId) return

  let unlisten: null | (() => void) = null
  let disposed = false

  const bind = async () => {
    const fn = await listen<AccountsChangedPayload>('accounts-changed', () => {
      void reloadAccountDetail(selectedAccountId)
    })

    if (disposed) {
      fn()
      return
    }

    unlisten = fn
  }

  void bind()

  return () => {
    disposed = true
    unlisten?.()
  }
}, [selectedAccountId, reloadAccountDetail])
```

#### 强约束
1. 第一版账号模块统一只监听 `accounts-changed`
2. 不做逐账号消息拆分
3. 账号详情收到消息后直接 reload 当前选中账号详情
4. 收到消息后立即进入各自异步 reload，不在监听回调里串行处理复杂业务

---

### 9.9 发布时序总表（伪代码级）

```text
create_task:
  db.create_task
  -> register_timer_if_needed
  -> publish_task_created
  -> return

update_task:
  unregister_old_timers
  -> db.update_task
  -> register_new_timer_if_needed
  -> publish_task_updated
  -> return

delete_task:
  unregister_task_timers
  -> db.delete_task
  -> publish_task_deleted
  -> return

pause_task:
  db.update_status(paused)
  -> unregister_task_timers
  -> publish_task_paused
  -> return

resume_task:
  db.update_status(idle)
  -> register_timer_if_needed
  -> publish_task_resumed
  -> return

execute_task (manual):
  db.update_status(running)
  -> executor.execute_task
  -> save_execution / set failed
  -> update final status
  -> publish_task_executed
  -> return

execute_timer (scheduled):
  executor.execute
  -> build_next_timer_state
  -> post_execution
  -> registry.update_timer
  -> publish_task_executed
  -> return

localbridge sync:
  for each user -> process_user_info
  -> publish_accounts_changed
  -> return
```

#### 最终约束
1. 所有通知都是“收尾后发布”，不是“处理中发布”
2. 所有订阅都是“生命周期内注册，cleanup 时释放”
3. 第一版统一以“收到消息后 reload”为主，不做复杂增量同步
4. 如果以后要升级成更复杂总线，也必须保持这里定义的 message_id 和发布语义稳定

---

## 十、接口级规范

## 十一、当前代码映射表（AI 施工必读）

本节不是再讲“应该怎么设计”，而是把**当前代码真实状态**和**目标修改点**逐条对齐。

目标：
- 让 AI 知道当前代码已经长什么样
- 让 AI 明确哪些地方是“新增”，哪些地方是“改签名”，哪些地方只是“插入调用”
- 避免 AI 按文档脑补不存在的结构

---

### 11.1 `src-tauri/src/task_commands.rs`

#### 当前状态

`WorkspaceContext` 当前定义为：

```rust
pub struct WorkspaceContext {
    pub db: Arc<Mutex<TaskDatabase>>,
    pub executor: Arc<TaskExecutor>,
    pub timer_manager: UnifiedTimerManager,
    pub workspace_path: String,
}
```

`WorkspaceContext::new()` 当前签名：

```rust
pub fn new(workspace_path: String) -> Result<Self, String>
```

`execute_task()` 已存在，并且当前顺序基本是：

```text
get task
-> update_task_status(running)
-> executor.execute_task(...)
-> 成功时 save_execution + update_task_status(idle)
-> 失败时 update_task_status(failed)
-> 返回
```

任务相关命令当前都已存在：
- `create_task`
- `update_task`
- `delete_task`
- `pause_task`
- `resume_task`
- `execute_task`

#### 目标状态

需要把 `WorkspaceContext` 改为：

```rust
pub struct WorkspaceContext {
    pub db: Arc<Mutex<TaskDatabase>>,
    pub executor: Arc<TaskExecutor>,
    pub timer_manager: UnifiedTimerManager,
    pub workspace_path: String,
    pub app_handle: tauri::AppHandle,
}
```

并把构造函数改为：

```rust
pub fn new(workspace_path: String, app_handle: tauri::AppHandle) -> Result<Self, String>
```

#### AI 施工说明
1. 这是**改已有结构**，不是新增平行结构
2. 不要新建第二个 workspace context 类型
3. 所有任务命令都继续从 `ctx.app_handle` 发布消息，不要在每个命令里额外单独查全局 app

---

### 11.2 `src-tauri/src/unified_timer/mod.rs`

#### 当前状态

`UnifiedTimerManager` 当前构造函数：

```rust
pub fn new() -> Self
```

内部当前这样创建事件循环：

```rust
let event_loop = Arc::new(EventLoop::new(registry.clone()));
```

#### 目标状态

改为显式接收 `AppHandle`：

```rust
pub fn new(app_handle: Option<tauri::AppHandle>) -> Self
```

并在内部传给 `EventLoop::new(...)`。

#### AI 施工说明
1. 第一版保留 `Option<AppHandle>` 是为了兼容初始化路径
2. 不是所有路径都必须强制 `Some(app_handle)`，但 workspace 正常创建路径应传入 `Some`
3. 不要在 `UnifiedTimerManager` 里加入额外事件业务逻辑，它只负责把能力传下去

---

### 11.3 `src-tauri/src/unified_timer/event_loop.rs`

#### 当前状态

`EventLoop` 当前字段：

```rust
pub struct EventLoop {
    registry: Arc<Mutex<TimerRegistry>>,
    running: Arc<RwLock<bool>>,
    executors: Arc<RwLock<HashMap<String, Arc<dyn TimerExecutor>>>>,
    wakeup: Arc<Notify>,
}
```

`EventLoop::new()` 当前签名：

```rust
pub fn new(registry: Arc<Mutex<TimerRegistry>>) -> Self
```

`execute_timer()` 当前顺序：

```text
executor.execute(context)
-> 成功时更新 updated_timer
-> executor.post_execution(&updated_timer)
-> registry.update_timer(updated_timer)
```

失败分支当前会：

```text
calculate_next_execution(now)
-> registry.update_timer(updated_timer)
```

#### 目标状态

需要增加：

```rust
app_handle: Option<tauri::AppHandle>
```

并把构造函数改为：

```rust
pub fn new(
    registry: Arc<Mutex<TimerRegistry>>,
    app_handle: Option<tauri::AppHandle>,
) -> Self
```

#### AI 施工说明
1. `task-executed` 的定时器发布点就在这个文件，不在 `python_script.rs`
2. 发布时机必须在 `post_execution()` 与 `registry.update_timer(...)` 之后
3. 只对 `task-<id>` 形式的 timer 发布 `task-executed`
4. 不要把所有 timer 都当任务 timer

---

### 11.4 `src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs`

#### 当前状态

当前已有明确 TODO：

```rust
// 3. TODO: Notify UI about data changes
log::debug!("[process_user_info] UI notification not yet implemented");
```

`LocalBridgeSyncExecutor` 当前字段：

```rust
pub struct LocalBridgeSyncExecutor {
    last_user_info_query: Mutex<HashMap<String, DateTime<Utc>>>,
    account_binding_cache: Arc<Mutex<HashMap<String, AccountBindingSnapshot>>>,
    unmanaged_online_accounts: Arc<Mutex<HashMap<String, UnmanagedAccountRecord>>>,
    db: Arc<Mutex<crate::task_database::TaskDatabase>>,
}
```

构造函数当前签名：

```rust
pub fn new(db: Arc<Mutex<crate::task_database::TaskDatabase>>) -> Self
```

`execute()` 当前会：

```text
get instances
-> 并发 spawn process_user_info(...)
-> join handles
-> prune_unmanaged_online_accounts(...)
-> return ExecutionResult
```

#### 目标状态

增加：

```rust
app_handle: Option<tauri::AppHandle>
```

构造函数改为：

```rust
pub fn new(
    db: Arc<Mutex<crate::task_database::TaskDatabase>>,
    app_handle: Option<tauri::AppHandle>,
) -> Self
```

#### AI 施工说明
1. `accounts-changed` 只在 `execute()` 尾部发布一次
2. `process_user_info()` 仍然只处理单账号数据，不负责发消息
3. 这里不是按账号粒度通知，而是按“整轮同步完成”通知

---

### 11.5 `src-tauri/src/commands/workspace.rs`

#### 当前状态

`set_current_workspace()` 当前签名：

```rust
pub async fn set_current_workspace(
    path: String,
    task_state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<(), String>
```

当前创建新 context 的代码是：

```rust
let new_ctx = crate::task_commands::WorkspaceContext::new(path.clone())?;
```

旧 workspace 清理时当前会：

```rust
old_ctx.timer_manager.stop().await;
```

#### 目标状态

函数签名改为接收 `AppHandle`：

```rust
pub async fn set_current_workspace(
    path: String,
    app: tauri::AppHandle,
    task_state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<(), String>
```

新 context 的创建改为：

```rust
let new_ctx = crate::task_commands::WorkspaceContext::new(path.clone(), app.clone())?;
```

#### AI 施工说明
1. 这是整个通知架构接通的关键入口
2. 如果这里不传 `AppHandle`，后续 timer / sync 路径就拿不到发布能力
3. 改完后要检查所有前端 invoke 参数是否仍兼容 Tauri command 签名

---

### 11.6 `src/components/TaskDetailContentPane.tsx`

#### 当前状态

当前只有：

```ts
useEffect(() => {
  void loadDetail()
}, [taskId])
```

也就是说当前详情只在：
- 初次加载
- `taskId` 变化

时刷新，没有任何事件订阅。

#### 目标状态

新增一个 `useEffect`：
- 监听 `task-executed`
- 监听 `task-updated`
- 监听 `task-paused`
- 监听 `task-resumed`
- 监听 `task-deleted`

并按 `payload.taskId === taskId` 过滤。

#### AI 施工说明
1. 不要替换已有 `loadDetail()`，而是在其基础上加监听
2. `task-deleted` 命中当前 task 时，调用 `onDeleted?.()`
3. 其他事件命中当前 task 时，调用 `loadDetail()`

---

### 11.7 `src/hooks/useTasksSidebarItems.ts`

#### 当前状态

当前只有一次初始加载：

```ts
useEffect(() => {
  void loadTasks()
}, [])
```

没有消息订阅，也没有合并刷新逻辑。

#### 目标状态

新增任务事件订阅：
- `task-created`
- `task-updated`
- `task-deleted`
- `task-paused`
- `task-resumed`
- `task-executed`

收到后合并触发 `loadTasks()`。

#### AI 施工说明
1. 这里统一 reload list，不需要按 taskId 过滤
2. 第一版只做简单 300ms merge/debounce
3. 必须在 cleanup 中同时释放 `unlisten` 和 `timeout`

---

### 11.8 `src/hooks/useAppLayoutState.ts`

#### 当前状态

当前账号列表数据由：
- `getManagedAccounts`
- `getUnmanagedOnlineAccounts`

拉取生成，但刷新仍主要依赖主动 reload 流程，而不是事件订阅。

#### 目标状态

新增对 `accounts-changed` 的订阅，收到后触发账号列表 reload。

#### AI 施工说明
1. 只补事件驱动刷新，不要重写现有账号列表建模逻辑
2. 保持 `buildAccountSidebarItems(...)` 和现有 state 组织不变
3. 文档目标是“补通知”，不是重构账号页状态管理

---

### 11.9 `src/components/AccountDetailPane.tsx`

#### 当前状态

当前详情页只有基于 `item?.id` 的加载：

```ts
useEffect(() => {
  void run()
}, [item?.id])
```

没有监听 `accounts-changed`。

#### 目标状态

新增一个 effect：
- 当有选中账号时，监听 `accounts-changed`
- 收到后 reload 当前详情

#### AI 施工说明
1. 第一版不区分是哪个账号变化，统一 reload 当前选中详情即可
2. 不要在这里引入更细粒度账号事件模型

---

## 十二、逐函数改造点清单（可直接照着改）

本节是给 AI 直接施工用的“插入点说明”。

格式约定：
- **位置**：文件 + 函数
- **现状**：当前代码执行到哪里
- **改法**：新增什么
- **插入点**：放在哪一段之后
- **验证**：改完如何判断正确

---

### 12.1 新增 `src-tauri/src/app_events.rs`

#### 改法
新增文件，包含：
- message_id 常量
- payload struct
- `publish()`
- `publish_task_created()` 等 helper

#### 验证
1. 编译通过
2. 其他文件可以正常 `use crate::app_events`
3. 没有业务文件继续直接散落裸 `app.emit("task-executed", ...)`

---

### 12.2 `task_commands.rs -> WorkspaceContext`

#### 改法
把：

```rust
pub struct WorkspaceContext {
    pub db: Arc<Mutex<TaskDatabase>>,
    pub executor: Arc<TaskExecutor>,
    pub timer_manager: UnifiedTimerManager,
    pub workspace_path: String,
}
```

改为：

```rust
pub struct WorkspaceContext {
    pub db: Arc<Mutex<TaskDatabase>>,
    pub executor: Arc<TaskExecutor>,
    pub timer_manager: UnifiedTimerManager,
    pub workspace_path: String,
    pub app_handle: tauri::AppHandle,
}
```

并同步修改 `WorkspaceContext::new(...)`。

#### 插入点
直接修改原结构与原构造函数，不新增平替版本。

#### 验证
1. `task_commands.rs` 编译通过
2. 所有创建 `WorkspaceContext` 的调用方都被修正

---

### 12.3 `workspace.rs -> set_current_workspace()`

#### 现状
当前创建 context 的位置是：

```rust
let new_ctx = crate::task_commands::WorkspaceContext::new(path.clone())?;
```

#### 改法
把函数签名改为接收 `app: tauri::AppHandle`，并改成：

```rust
let new_ctx = crate::task_commands::WorkspaceContext::new(path.clone(), app.clone())?;
```

#### 插入点
就在当前创建 new context 的那一行直接替换。

#### 验证
1. 切换工作区仍然成功
2. 旧 timer 仍会被 stop
3. 新 workspace 定时器仍能正常启动

---

### 12.4 `unified_timer/mod.rs -> UnifiedTimerManager::new()`

#### 现状
当前：

```rust
pub fn new() -> Self
```

#### 改法
改成：

```rust
pub fn new(app_handle: Option<tauri::AppHandle>) -> Self
```

并把 `app_handle` 传给 `EventLoop::new(...)`。

#### 插入点
直接改原构造函数。

#### 验证
1. `WorkspaceContext::new(...)` 调用可编译
2. `EventLoop` 内可以访问 `app_handle`

---

### 12.5 `event_loop.rs -> EventLoop::new()`

#### 现状
当前：

```rust
pub fn new(registry: Arc<Mutex<TimerRegistry>>) -> Self
```

#### 改法
改为：

```rust
pub fn new(
    registry: Arc<Mutex<TimerRegistry>>,
    app_handle: Option<tauri::AppHandle>,
) -> Self
```

并增加字段：

```rust
app_handle: Option<tauri::AppHandle>
```

#### 插入点
直接修改结构体和构造函数。

#### 验证
1. 事件循环仍能正常 start / stop
2. timer 执行逻辑不受影响

---

### 12.6 `task_commands.rs -> create_task()`

#### 现状
当前顺序：

```text
db.create_task
-> 若是 scheduled 则 register_timer
-> return task
```

#### 改法
在 timer 注册完成后、返回前新增：

```rust
app_events::publish_task_created(&ctx.app_handle, &task.id);
```

#### 插入点
放在：
- scheduled task 的 timer 注册逻辑结束后
- `Ok(task)` 之前

#### 验证
1. 创建即时任务后能收到 `task-created`
2. 创建定时任务且 timer 注册成功后能收到 `task-created`
3. 若 timer 注册失败，不应提前发成功消息

---

### 12.7 `task_commands.rs -> update_task()`

#### 现状
当前顺序：

```text
db.update_task
-> clear_task_timers
-> 重新装载全部 scheduled task timers
-> return
```

#### 改法
在全部 timer 重建完成后新增：

```rust
app_events::publish_task_updated(&ctx.app_handle, &task_id);
```

#### 插入点
放在最后一个 timer register 完成之后、`Ok(())` 之前。

#### 验证
1. 更新任务后能收到 `task-updated`
2. 定时器重建失败时不应发成功类消息

---

### 12.8 `task_commands.rs -> delete_task()`

#### 现状
当前顺序：

```text
db.delete_task
-> unregister task timer
-> return
```

#### 建议改法
顺序调整为：

```text
unregister task timer
-> db.delete_task
-> publish_task_deleted
-> return
```

并新增：

```rust
app_events::publish_task_deleted(&ctx.app_handle, &task_id);
```

#### 插入点
放在删除与 timer 注销都完成之后、`Ok(())` 之前。

#### 验证
1. 删除任务后列表自动刷新
2. 当前打开该任务详情时能退出详情页

---

### 12.9 `task_commands.rs -> pause_task()`

#### 现状
当前顺序：

```text
update_task_status(paused)
-> unregister task timer
-> return
```

#### 改法
在 timer 注销后新增：

```rust
app_events::publish_task_paused(&ctx.app_handle, &task_id);
```

#### 插入点
放在 `unregister` 完成之后、`Ok(())` 之前。

#### 验证
1. 暂停任务后列表 / 详情自动刷新
2. timer 被移除

---

### 12.10 `task_commands.rs -> resume_task()`

#### 现状
当前顺序：

```text
update_task_status(idle)
-> get_task
-> 若是 scheduled 则 register_timer
-> return
```

#### 改法
在 timer 重建完成后新增：

```rust
app_events::publish_task_resumed(&ctx.app_handle, &task_id);
```

#### 插入点
放在可能的 timer 注册逻辑之后、`Ok(())` 之前。

#### 验证
1. 恢复任务后列表 / 详情自动刷新
2. scheduled task 的 timer 被恢复

---

### 12.11 `task_commands.rs -> execute_task()`

#### 现状
成功分支当前会：

```text
save_execution
-> update_task_status(idle)
-> scheduled success 时 update_next_execution_time
-> return Ok(exec_result)
```

失败分支当前会：

```text
update_task_status(failed)
-> return Err(e)
```

#### 改法
成功分支在返回前新增：

```rust
app_events::publish_task_executed(&ctx.app_handle, &task_id, "success");
```

失败分支在返回前新增：

```rust
app_events::publish_task_executed(&ctx.app_handle, &task_id, "failed");
```

#### 插入点
- 成功：`update_task_status(idle)` 与后续调度时间更新完成之后
- 失败：`update_task_status(failed)` 之后

#### 验证
1. 手动执行成功时详情自动刷新
2. 手动执行失败时详情也自动刷新
3. 发布失败不能影响命令返回

---

### 12.12 `localbridge_sync_executor.rs -> LocalBridgeSyncExecutor::new()`

#### 改法
新增 `app_handle: Option<tauri::AppHandle>` 字段，并改构造函数签名。

#### 插入点
直接修改原 struct 与原 `new(...)`。

#### 验证
1. `WorkspaceContext::start_timers()` 中注册 `LocalBridgeSyncExecutor` 时可传入 app handle
2. 账号同步执行器仍能正常运行

---

### 12.13 `localbridge_sync_executor.rs -> execute()`

#### 现状
当前流程：

```text
get instances
-> spawn process_user_info
-> join all handles
-> prune_unmanaged_online_accounts
-> return ExecutionResult
```

#### 改法
在 `prune_unmanaged_online_accounts(...)` 之后、返回前新增：

```rust
if let Some(app_handle) = &self.app_handle {
    app_events::publish_accounts_changed(app_handle);
}
```

#### 插入点
放在整轮同步完成之后，只发一次。

#### 验证
1. 一轮同步后收到一次 `accounts-changed`
2. 不是每个账号都收到一次通知

---

### 12.14 `localbridge_sync_executor.rs -> process_user_info()`

#### 现状
当前尾部有 TODO 注释。

#### 改法
不要在这里发事件；只需要把文档中的 TODO 变为“由 `execute()` 统一发布”。

#### 插入点
无需在本函数中加 `publish_accounts_changed`。

#### 验证
全局搜索确认这里没有发布账号通知。

---

### 12.15 `event_loop.rs -> execute_timer()`

#### 现状
成功分支当前在：

```rust
executor.post_execution(&updated_timer).await
let mut reg = registry.lock().await;
reg.update_timer(updated_timer);
```

之后直接结束。

#### 改法
在 `reg.update_timer(updated_timer)` 完成后，增加：

```rust
if updated_timer.id.starts_with("task-") {
    if let Some(task_id) = updated_timer.id.strip_prefix("task-") {
        if let Some(app_handle) = &self.app_handle {
            app_events::publish_task_executed(app_handle, task_id, "success");
        }
    }
}
```

失败分支也在 `reg.update_timer(updated_timer)` 后增加同类逻辑，但状态为 `failed`。

#### AI 施工注意
当前 `execute_timer()` 是静态函数风格：

```rust
async fn execute_timer(...)
```

如果要访问 `self.app_handle`，需要把它改成可访问实例字段的形式。可选方式：
1. 改为实例方法
2. 或把 `app_handle` 显式作为参数继续往里传

**推荐方式：改为实例方法。**

#### 验证
1. 定时任务执行成功后能收到 `task-executed(success)`
2. 定时任务执行失败后能收到 `task-executed(failed)`
3. 非任务 timer 不会错误发任务消息

---

### 12.16 `TaskDetailContentPane.tsx`

#### 改法
新增一个 `useEffect` 订阅：
- `task-executed`
- `task-updated`
- `task-paused`
- `task-resumed`
- `task-deleted`

#### 插入点
放在现有：

```ts
useEffect(() => {
  void loadDetail()
}, [taskId])
```

之后最合适，保持“先定义 loadDetail，再定义订阅 effect”。

#### 验证
1. 手动执行任务时当前详情自动刷新
2. 定时执行任务时当前详情自动刷新
3. 删除当前任务时退出详情而不是报错卡死
4. 重复进入页面不会重复处理同一消息

---

### 12.17 `useTasksSidebarItems.ts`

#### 改法
新增一个 effect：
- 注册多个 `listen(...)`
- 使用一个 300ms timeout 合并 `loadTasks()`

#### 插入点
放在当前初始加载 effect 之后。

#### 验证
1. 创建 / 更新 / 删除 / 暂停 / 恢复 / 执行任务时列表都会刷新
2. 短时间连续事件不会导致多次无意义请求
3. 卸载 hook 后不会继续响应消息

---

### 12.18 `useAppLayoutState.ts`

#### 改法
在账号列表相关 reload 能力已存在的基础上，新增：
- 监听 `accounts-changed`
- 收到后 reload managed/unmanaged accounts

#### 插入点
放在账号列表数据加载相关 effect 附近，不要分散到无关区域。

#### 验证
1. 一轮同步结束后左侧账号列表自动更新
2. 不影响现有手动刷新行为

---

### 12.19 `AccountDetailPane.tsx`

#### 改法
新增 effect：
- 当 `item?.id` 存在时监听 `accounts-changed`
- 收到后执行 `reloadDetail()`

#### 插入点
放在现有详情加载 effect 后。

#### 验证
1. 同步完成后当前账号详情自动刷新
2. 切换账号时旧监听会正确释放

---

## 十三、分阶段实施与验证清单（适合 AI 分步执行）

### Phase 1：建立通用发布层

#### 目标
先把后端“能发消息”这件事建立起来，但暂时不接前端订阅。

#### 步骤
1. 新增 `src-tauri/src/app_events.rs`
2. 在后端模块入口注册 `mod app_events;`
3. 编译通过

#### 验证
- Rust 编译通过
- `app_events` 可被 `task_commands.rs` 正常引用

#### 通过标准
说明通知底座已经可用。

---

### Phase 2：接通手动任务命令发布链路

#### 目标
先完成最直接、最容易验证的任务命令通知。

#### 步骤
1. 给 `WorkspaceContext` 增加 `app_handle`
2. 修改 `WorkspaceContext::new(...)`
3. 修改 `set_current_workspace(...)` 传入 `AppHandle`
4. 在 `create_task / update_task / delete_task / pause_task / resume_task / execute_task` 中接入 `publish_*`

#### 验证
- 创建任务后能收到 `task-created`
- 更新任务后能收到 `task-updated`
- 删除任务后能收到 `task-deleted`
- 手动执行成功/失败都能收到 `task-executed`

#### 通过标准
说明“命令型发布链路”已经接通。

---

### Phase 3：接通定时器执行发布链路

#### 目标
让后台定时任务执行完成后也能发出统一消息。

#### 步骤
1. 修改 `UnifiedTimerManager::new(...)`
2. 修改 `EventLoop` 结构与构造函数
3. 让 `execute_timer()` 能访问 `app_handle`
4. 在定时器收尾完成后发布 `task-executed`

#### 验证
- 创建一个短间隔 scheduled task
- 等待其自动执行
- 前端能收到 `task-executed`

#### 通过标准
说明“后台自动执行链路”已经接通。

---

### Phase 4：接通账号同步发布链路

#### 目标
让账号同步结束后能统一通知 UI。

#### 步骤
1. 给 `LocalBridgeSyncExecutor` 增加 `app_handle`
2. 修改其构造函数
3. 在 `execute()` 尾部发布一次 `accounts-changed`
4. 确认 `process_user_info()` 不发布通知

#### 验证
- 触发一次 LocalBridge sync
- 只收到一次 `accounts-changed`

#### 通过标准
说明账号模块也接入了同一套架构。

---

### Phase 5：接通前端任务订阅

#### 目标
让任务页真正对后端事件产生可见响应。

#### 步骤
1. 在 `TaskDetailContentPane.tsx` 新增监听
2. 在 `useTasksSidebarItems.ts` 新增监听与合并刷新

#### 验证
- 当前详情页在任务变更后自动刷新
- 左侧任务列表在任务变更后自动刷新
- 没有重复订阅导致的一次事件多次处理

#### 通过标准
说明任务模块实现端到端闭环。

---

### Phase 6：接通前端账号订阅

#### 目标
让账号列表与账号详情对同步事件自动响应。

#### 步骤
1. 在 `useAppLayoutState.ts` 监听 `accounts-changed`
2. 在 `AccountDetailPane.tsx` 监听 `accounts-changed`

#### 验证
- 同步后左侧账号列表自动更新
- 当前账号详情自动刷新

#### 通过标准
说明账号模块实现端到端闭环。

---

## 十四、AI 施工边界与禁止事项

### 14.1 本次任务允许改动的范围
- `src-tauri/src/app_events.rs`（新增）
- `src-tauri/src/task_commands.rs`
- `src-tauri/src/commands/workspace.rs`
- `src-tauri/src/unified_timer/mod.rs`
- `src-tauri/src/unified_timer/event_loop.rs`
- `src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs`
- `src/components/TaskDetailContentPane.tsx`
- `src/hooks/useTasksSidebarItems.ts`
- `src/hooks/useAppLayoutState.ts`
- `src/components/AccountDetailPane.tsx`

### 14.2 本次任务不要做的事
1. 不要顺手重构任务系统
2. 不要顺手重构账号页状态管理
3. 不要把第一版升级成复杂后端内消息总线
4. 不要把前端从 reload 改成复杂增量 patch
5. 不要扩展更多业务消息 ID，先只做文档已定义的这些

### 14.3 如果 AI 施工时遇到歧义，优先级按以下顺序判断
1. 以“当前代码真实结构”为准
2. 以“收尾后发布”为准
3. 以“最小改动接入”为准
4. 以“先打通链路，再谈抽象”为准

---

## 十五、接口级规范

## 十六、可直接编码模板版（AI 施工最终参考）

本节提供**接近可直接落地的代码模板**。

定位：
- 不是要 100% 保证复制即编译
- 而是把 AI 最容易犹豫的部分直接模板化
- 让实施过程从“理解设计”进一步收敛到“按模板改代码”

使用原则：
1. 先以本节模板为主
2. 再以“当前代码映射表”和“逐函数改造点清单”校正
3. 若模板与当前代码细节冲突，以当前代码真实签名为准

---

### 16.1 `src-tauri/src/app_events.rs` 完整初稿模板

```rust
use chrono::Utc;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const TASK_CREATED: &str = "task-created";
pub const TASK_UPDATED: &str = "task-updated";
pub const TASK_DELETED: &str = "task-deleted";
pub const TASK_PAUSED: &str = "task-paused";
pub const TASK_RESUMED: &str = "task-resumed";
pub const TASK_EXECUTED: &str = "task-executed";
pub const ACCOUNTS_CHANGED: &str = "accounts-changed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskChangedPayload {
    pub task_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskExecutedPayload {
    pub task_id: String,
    pub status: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsChangedPayload {
    pub timestamp: String,
}

pub fn publish<M: Serialize>(app: &AppHandle, message_id: &str, payload: M) {
    if let Err(error) = app.emit(message_id, payload) {
        log::warn!("[app_events] Failed to publish {}: {}", message_id, error);
    }
}

pub fn publish_task_created(app: &AppHandle, task_id: &str) {
    publish(app, TASK_CREATED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_updated(app: &AppHandle, task_id: &str) {
    publish(app, TASK_UPDATED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_deleted(app: &AppHandle, task_id: &str) {
    publish(app, TASK_DELETED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_paused(app: &AppHandle, task_id: &str) {
    publish(app, TASK_PAUSED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_resumed(app: &AppHandle, task_id: &str) {
    publish(app, TASK_RESUMED, TaskChangedPayload {
        task_id: task_id.to_string(),
    });
}

pub fn publish_task_executed(app: &AppHandle, task_id: &str, status: &str) {
    publish(app, TASK_EXECUTED, TaskExecutedPayload {
        task_id: task_id.to_string(),
        status: status.to_string(),
        timestamp: Utc::now().to_rfc3339(),
    });
}

pub fn publish_accounts_changed(app: &AppHandle) {
    publish(app, ACCOUNTS_CHANGED, AccountsChangedPayload {
        timestamp: Utc::now().to_rfc3339(),
    });
}
```

#### 建议配套改动
在后端模块入口增加：

```rust
mod app_events;
```

---

### 16.2 `task_commands.rs` import 模板

在现有 import 基础上，建议新增：

```rust
use crate::app_events;
use tauri::{AppHandle, State};
```

如果当前文件已经有：

```rust
use tauri::State;
```

则改成：

```rust
use tauri::{AppHandle, State};
```

---

### 16.3 `WorkspaceContext` 目标代码模板

```rust
pub struct WorkspaceContext {
    pub db: Arc<Mutex<TaskDatabase>>,
    pub executor: Arc<TaskExecutor>,
    pub timer_manager: UnifiedTimerManager,
    pub workspace_path: String,
    pub app_handle: AppHandle,
}

impl WorkspaceContext {
    pub fn new(workspace_path: String, app_handle: AppHandle) -> Result<Self, String> {
        log::info!("[WorkspaceContext] Creating new workspace context for: {}", workspace_path);

        let db_path = std::path::Path::new(&workspace_path)
            .join(".tweetpilot/tweetpilot.db");

        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let db = TaskDatabase::new(db_path).map_err(|e| e.to_string())?;

        log::info!("[WorkspaceContext] Recalculating next execution times after database initialization...");
        db.recalculate_missed_executions().map_err(|e| {
            log::error!("[WorkspaceContext] Failed to recalculate missed executions: {}", e);
            e.to_string()
        })?;

        let executor = Arc::new(TaskExecutor::new());
        let timer_manager = UnifiedTimerManager::new(Some(app_handle.clone()));

        Ok(Self {
            db: Arc::new(Mutex::new(db)),
            executor,
            timer_manager,
            workspace_path,
            app_handle,
        })
    }
}
```

---

### 16.4 `WorkspaceContext::start_timers()` 关键修改模板

当前注册 executor 的地方，建议改为：

```rust
self.timer_manager.register_executor(
    "localbridge_sync".to_string(),
    Arc::new(LocalBridgeSyncExecutor::new(
        self.db.clone(),
        Some(self.app_handle.clone()),
    )),
).await;

self.timer_manager.register_executor(
    "python_script".to_string(),
    Arc::new(PythonScriptExecutor::new(
        self.workspace_path.clone(),
        self.db.clone(),
    )),
).await;
```

#### 说明
- `PythonScriptExecutor` 第一版不需要注入 `app_handle`
- 定时任务通知从 `EventLoop` 发，不从 python executor 发

---

### 16.5 `set_current_workspace()` 目标代码模板

```rust
#[tauri::command]
pub async fn set_current_workspace(
    path: String,
    app: tauri::AppHandle,
    task_state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<(), String> {
    log::info!("[set_current_workspace] Starting workspace switch to: {}", path);

    if path.trim().is_empty() {
        return Err("工作目录不能为空".to_string());
    }

    let workspace_path = std::path::Path::new(&path);
    let marker_file = workspace_path.join(".tweetpilot.json");

    if !marker_file.exists() {
        initialize_workspace(path.clone()).await?;
    }

    {
        let mut workspace_ctx = task_state.get_context().await;
        if let Some(old_ctx) = workspace_ctx.take() {
            old_ctx.timer_manager.stop().await;
            drop(old_ctx);
        }
    }

    let new_ctx = crate::task_commands::WorkspaceContext::new(path.clone(), app.clone())?;
    new_ctx.start_timers().await?;

    {
        let mut workspace_ctx = task_state.get_context().await;
        *workspace_ctx = Some(new_ctx);
    }

    persist_current_workspace(path)
}
```

---

### 16.6 `UnifiedTimerManager` 目标代码模板

```rust
pub struct UnifiedTimerManager {
    pub registry: Arc<Mutex<TimerRegistry>>,
    event_loop: Arc<EventLoop>,
}

impl UnifiedTimerManager {
    pub fn new(app_handle: Option<tauri::AppHandle>) -> Self {
        let registry = Arc::new(Mutex::new(TimerRegistry::new()));
        let event_loop = Arc::new(EventLoop::new(registry.clone(), app_handle));

        Self {
            registry,
            event_loop,
        }
    }
}
```

---

### 16.7 `EventLoop` 结构与构造函数模板

```rust
pub struct EventLoop {
    registry: Arc<Mutex<TimerRegistry>>,
    running: Arc<RwLock<bool>>,
    executors: Arc<RwLock<HashMap<String, Arc<dyn TimerExecutor>>>>,
    wakeup: Arc<Notify>,
    app_handle: Option<tauri::AppHandle>,
}

impl EventLoop {
    pub fn new(
        registry: Arc<Mutex<TimerRegistry>>,
        app_handle: Option<tauri::AppHandle>,
    ) -> Self {
        let mut executors: HashMap<String, Arc<dyn TimerExecutor>> = HashMap::new();
        executors.insert("dummy".to_string(), Arc::new(DummyExecutor));

        Self {
            registry,
            running: Arc::new(RwLock::new(false)),
            executors: Arc::new(RwLock::new(executors)),
            wakeup: Arc::new(Notify::new()),
            app_handle,
        }
    }
}
```

---

### 16.8 `EventLoop::start()` 改造模板

因为当前 `execute_timer()` 是静态风格，推荐改成实例方法。

#### 推荐改法骨架

```rust
pub async fn start(&self) {
    let mut running = self.running.write().await;
    if *running {
        return;
    }
    *running = true;
    drop(running);

    let this = Arc::new(Self {
        registry: self.registry.clone(),
        running: self.running.clone(),
        executors: self.executors.clone(),
        wakeup: self.wakeup.clone(),
        app_handle: self.app_handle.clone(),
    });

    tokio::spawn(async move {
        loop {
            let is_running = *this.running.read().await;
            if !is_running {
                break;
            }

            let next_timer = {
                let mut reg = this.registry.lock().await;
                reg.pop_next()
            };

            match next_timer {
                Some(timer) => {
                    let now = chrono::Utc::now();

                    if let Some(next_time) = timer.next_execution {
                        if next_time <= now {
                            this.execute_timer(timer).await;
                        } else {
                            let duration = (next_time - now).to_std().unwrap_or(tokio::time::Duration::from_secs(1));
                            let sleep_duration = duration.min(tokio::time::Duration::from_secs(60));

                            tokio::select! {
                                _ = tokio::time::sleep(sleep_duration) => {}
                                _ = this.wakeup.notified() => {}
                            }

                            let mut reg = this.registry.lock().await;
                            reg.update_timer(timer);
                        }
                    }
                }
                None => {
                    tokio::select! {
                        _ = tokio::time::sleep(tokio::time::Duration::from_secs(60)) => {}
                        _ = this.wakeup.notified() => {}
                    }
                }
            }
        }
    });
}
```

#### 实施提醒
如果不想在这一版里重组 `start()` 太多，也可以退而求其次：
- 保持 `execute_timer(...)` 为静态函数
- 额外把 `app_handle: Option<AppHandle>` 作为参数继续传进去

但从文档约束和后续可维护性看，**实例方法更优先**。

---

### 16.9 `EventLoop::execute_timer()` 目标代码模板

```rust
async fn execute_timer(&self, timer: Timer) {
    log::info!("[EventLoop] Starting execution of timer: {} ({})", timer.id, timer.name);

    let executor = {
        let executors = self.executors.read().await;
        executors.get(&timer.executor).cloned()
    };

    let Some(executor) = executor else {
        log::error!("[EventLoop] Executor '{}' not found for timer {}", timer.executor, timer.id);
        return;
    };

    let context = ExecutionContext {
        timer_id: timer.id.clone(),
        config: timer.executor_config.clone(),
    };

    match executor.execute(context).await {
        Ok(result) => {
            let mut updated_timer = timer.clone();
            updated_timer.last_execution = Some(result.end_time);
            updated_timer.next_execution = updated_timer.calculate_next_execution(result.end_time);

            if let Err(error) = executor.post_execution(&updated_timer).await {
                log::warn!("[EventLoop] Post-execution callback failed for timer {}: {}", timer.id, error);
            }

            {
                let mut reg = self.registry.lock().await;
                reg.update_timer(updated_timer.clone());
            }

            if updated_timer.id.starts_with("task-") {
                if let Some(task_id) = updated_timer.id.strip_prefix("task-") {
                    if let Some(app_handle) = &self.app_handle {
                        crate::app_events::publish_task_executed(app_handle, task_id, "success");
                    }
                }
            }
        }
        Err(error) => {
            log::error!("[EventLoop] Timer {} execution failed: {}", timer.id, error);

            let mut updated_timer = timer.clone();
            updated_timer.next_execution = updated_timer.calculate_next_execution(chrono::Utc::now());

            {
                let mut reg = self.registry.lock().await;
                reg.update_timer(updated_timer.clone());
            }

            if updated_timer.id.starts_with("task-") {
                if let Some(task_id) = updated_timer.id.strip_prefix("task-") {
                    if let Some(app_handle) = &self.app_handle {
                        crate::app_events::publish_task_executed(app_handle, task_id, "failed");
                    }
                }
            }
        }
    }
}
```

---

### 16.10 `LocalBridgeSyncExecutor` 结构模板

```rust
pub struct LocalBridgeSyncExecutor {
    last_user_info_query: Mutex<HashMap<String, DateTime<Utc>>>,
    account_binding_cache: Arc<Mutex<HashMap<String, AccountBindingSnapshot>>>,
    unmanaged_online_accounts: Arc<Mutex<HashMap<String, UnmanagedAccountRecord>>>,
    db: Arc<Mutex<crate::task_database::TaskDatabase>>,
    app_handle: Option<tauri::AppHandle>,
}

impl LocalBridgeSyncExecutor {
    pub fn new(
        db: Arc<Mutex<crate::task_database::TaskDatabase>>,
        app_handle: Option<tauri::AppHandle>,
    ) -> Self {
        let account_binding_cache = {
            let db_guard = db.lock().unwrap();
            let managed_accounts = db_guard.get_managed_accounts().unwrap_or_default();
            let mut cache = HashMap::new();
            for account in managed_accounts {
                if let (Some(instance_id), Some(extension_name)) = (account.instance_id, account.extension_name) {
                    cache.insert(
                        account.twitter_id,
                        AccountBindingSnapshot {
                            instance_id,
                            extension_name,
                        },
                    );
                }
            }
            Arc::new(Mutex::new(cache))
        };

        Self {
            last_user_info_query: Mutex::new(HashMap::new()),
            account_binding_cache,
            unmanaged_online_accounts: Arc::new(Mutex::new(HashMap::new())),
            db,
            app_handle,
        }
    }
}
```

---

### 16.11 `LocalBridgeSyncExecutor::execute()` 尾部模板

在当前 `join handles` 和 `prune_unmanaged_online_accounts(...)` 之后，加：

```rust
self.prune_unmanaged_online_accounts(&online_instance_ids);

if let Some(app_handle) = &self.app_handle {
    crate::app_events::publish_accounts_changed(app_handle);
}

let unmanaged_count = self.unmanaged_online_accounts.lock().unwrap().len();
log::info!(
    "[LocalBridgeSyncExecutor] Sync round summary: instances={}, online_instance_ids={}, resolved_instance_ids={}, unmanaged_online_accounts={}",
    instances.len(),
    online_instance_ids.len(),
    resolved_instance_ids.len(),
    unmanaged_count
);
```

#### 关键约束
- 发布点放在整轮同步完成后
- 不放进 `process_user_info()`

---

### 16.12 `create_task()` 模板片段

```rust
#[tauri::command]
pub async fn create_task(
    config: TaskConfigInput,
    state: State<'_, TaskState>,
) -> Result<crate::task_database::Task, String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let task = ctx.db.lock().unwrap().create_task(config).map_err(|e| e.to_string())?;

    if task.enabled && task.task_type == "scheduled" {
        match WorkspaceContext::build_task_timer(&task) {
            Ok(Some(timer)) => {
                ctx.timer_manager.register_timer(timer).await?;
            }
            Ok(None) => {
                log::warn!("[create_task] Failed to build timer for task: {}", task.name);
            }
            Err(e) => {
                log::error!("[create_task] Error building timer for task {}: {}", task.name, e);
            }
        }
    }

    app_events::publish_task_created(&ctx.app_handle, &task.id);
    Ok(task)
}
```

---

### 16.13 `update_task()` 模板片段

```rust
#[tauri::command]
pub async fn update_task(
    task_id: String,
    config: TaskConfigInput,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    ctx.db.lock().unwrap().update_task(&task_id, config).map_err(|e| e.to_string())?;

    ctx.timer_manager.clear_task_timers().await;

    let tasks = ctx.db.lock().unwrap().get_all_tasks().map_err(|e| e.to_string())?;
    for task in tasks {
        if !task.enabled || task.task_type != "scheduled" {
            continue;
        }

        match WorkspaceContext::build_task_timer(&task) {
            Ok(Some(timer)) => {
                ctx.timer_manager.register_timer(timer).await?;
            }
            Ok(None) => {
                log::warn!("[update_task] Failed to build timer for task: {}", task.name);
            }
            Err(e) => {
                log::error!("[update_task] Error building timer for task {}: {}", task.name, e);
            }
        }
    }

    app_events::publish_task_updated(&ctx.app_handle, &task_id);
    Ok(())
}
```

---

### 16.14 `delete_task()` 模板片段

```rust
#[tauri::command]
pub async fn delete_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    {
        let mut registry = ctx.timer_manager.registry.lock().await;
        let _ = registry.unregister(&format!("task-{}", task_id));
    }

    ctx.db.lock().unwrap().delete_task(&task_id).map_err(|e| e.to_string())?;

    app_events::publish_task_deleted(&ctx.app_handle, &task_id);
    Ok(())
}
```

---

### 16.15 `pause_task()` / `resume_task()` 模板片段

```rust
app_events::publish_task_paused(&ctx.app_handle, &task_id);
```

```rust
app_events::publish_task_resumed(&ctx.app_handle, &task_id);
```

插入位置分别是：
- `pause_task()` 中 timer 注销之后
- `resume_task()` 中 timer 恢复之后

---

### 16.16 `execute_task()` 模板片段

```rust
match result {
    Ok(exec_result) => {
        ctx.db.lock().unwrap().save_execution(&exec_result).map_err(|e| e.to_string())?;
        ctx.db.lock().unwrap().update_task_status(&task_id, "idle").map_err(|e| e.to_string())?;

        if task.task_type == "scheduled" && exec_result.status == "success" {
            if let Ok(updated_task) = ctx.db.lock().unwrap().get_task(&task_id) {
                if let Err(error) = ctx.db.lock().unwrap().update_next_execution_time(&task_id, &updated_task) {
                    log::error!("[execute_task] Failed to update next execution time: {}", error);
                }
            }
        }

        app_events::publish_task_executed(&ctx.app_handle, &task_id, "success");
        Ok(exec_result)
    }
    Err(e) => {
        ctx.db.lock().unwrap().update_task_status(&task_id, "failed").map_err(|e2| e2.to_string())?;
        app_events::publish_task_executed(&ctx.app_handle, &task_id, "failed");
        Err(e)
    }
}
```

---

### 16.17 前端共享事件类型模板

建议在前端某个共享类型文件中定义：

```ts
export interface TaskChangedPayload {
  taskId: string
}

export interface TaskExecutedPayload {
  taskId: string
  status: 'success' | 'failed'
  timestamp: string
}

export interface AccountsChangedPayload {
  timestamp: string
}
```

如果第一版不想新增共享文件，也可以先在使用处局部定义。

---

### 16.18 `TaskDetailContentPane.tsx` import 模板

```ts
import { listen } from '@tauri-apps/api/event'
```

如果采用局部类型定义，可在文件顶部补：

```ts
type TaskChangedPayload = {
  taskId: string
}

type TaskExecutedPayload = {
  taskId: string
  status: 'success' | 'failed'
  timestamp: string
}
```

---

### 16.19 `TaskDetailContentPane.tsx` 监听模板

```ts
useEffect(() => {
  if (!taskId) return

  let disposed = false
  const unlistenFns: Array<() => void> = []

  const bind = async () => {
    const messageIds = [
      'task-executed',
      'task-updated',
      'task-paused',
      'task-resumed',
      'task-deleted',
    ] as const

    for (const messageId of messageIds) {
      const unlisten = await listen<TaskChangedPayload | TaskExecutedPayload>(messageId, (event) => {
        const payload = event.payload
        if (!payload || payload.taskId !== taskId) {
          return
        }

        if (messageId === 'task-deleted') {
          onDeleted?.()
          return
        }

        void loadDetail()
      })

      if (disposed) {
        unlisten()
      } else {
        unlistenFns.push(unlisten)
      }
    }
  }

  void bind()

  return () => {
    disposed = true
    for (const fn of unlistenFns) {
      fn()
    }
  }
}, [taskId, onDeleted])
```

#### 实施提醒
如果 ESLint / hooks 依赖规则要求把 `loadDetail` 放进依赖，需要先用 `useCallback` 包装 `loadDetail`。

---

### 16.20 `useTasksSidebarItems.ts` import 与监听模板

#### import

```ts
import { listen } from '@tauri-apps/api/event'
```

#### 监听 effect

```ts
useEffect(() => {
  let disposed = false
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  const unlistenFns: Array<() => void> = []

  const scheduleReload = () => {
    if (reloadTimer) {
      clearTimeout(reloadTimer)
    }

    reloadTimer = setTimeout(() => {
      reloadTimer = null
      void loadTasks()
    }, 300)
  }

  const bind = async () => {
    const messageIds = [
      'task-created',
      'task-updated',
      'task-deleted',
      'task-paused',
      'task-resumed',
      'task-executed',
    ] as const

    for (const messageId of messageIds) {
      const unlisten = await listen(messageId, () => {
        scheduleReload()
      })

      if (disposed) {
        unlisten()
      } else {
        unlistenFns.push(unlisten)
      }
    }
  }

  void bind()

  return () => {
    disposed = true

    if (reloadTimer) {
      clearTimeout(reloadTimer)
    }

    for (const fn of unlistenFns) {
      fn()
    }
  }
}, [])
```

#### 实施提醒
如果你希望减少闭包漂移，可先把 `loadTasks` 包成 `useCallback`，再把依赖从 `[]` 改成 `[loadTasks]`。

---

### 16.21 `AccountDetailPane.tsx` 监听模板

#### import

```ts
import { listen } from '@tauri-apps/api/event'
```

#### 局部类型

```ts
type AccountsChangedPayload = {
  timestamp: string
}
```

#### effect 模板

```ts
useEffect(() => {
  if (!item?.id) return

  let disposed = false
  let unlisten: null | (() => void) = null

  const bind = async () => {
    const fn = await listen<AccountsChangedPayload>('accounts-changed', () => {
      void reloadDetail()
    })

    if (disposed) {
      fn()
      return
    }

    unlisten = fn
  }

  void bind()

  return () => {
    disposed = true
    unlisten?.()
  }
}, [item?.id])
```

---

### 16.22 `useAppLayoutState.ts` 监听模板

#### import

```ts
import { listen } from '@tauri-apps/api/event'
```

#### 建议前提
先确认当前文件里已经有一个稳定的账号 reload 方法，例如：

```ts
const reloadAccounts = async () => {
  const [managed, unmanaged] = await Promise.all([
    getManagedAccounts(),
    getUnmanagedOnlineAccounts(),
  ])

  setManagedAccounts(managed)
  setUnmanagedAccounts(unmanaged)
  setAccountItems(buildAccountSidebarItems(managed, unmanaged))
}
```

如果已有同类函数，就复用，不要新造第二套。

#### effect 模板

```ts
useEffect(() => {
  let disposed = false
  let unlisten: null | (() => void) = null

  const bind = async () => {
    const fn = await listen<AccountsChangedPayload>('accounts-changed', () => {
      void reloadAccounts()
    })

    if (disposed) {
      fn()
      return
    }

    unlisten = fn
  }

  void bind()

  return () => {
    disposed = true
    unlisten?.()
  }
}, [])
```

---

### 16.23 AI 直接编码时的最小执行顺序

如果让 AI 真正按这份文档直接开工，建议严格按这个顺序：

1. 新增 `app_events.rs`
2. 改 `WorkspaceContext` + `set_current_workspace()`
3. 改 `UnifiedTimerManager` + `EventLoop`
4. 改 `create/update/delete/pause/resume/execute_task`
5. 改 `LocalBridgeSyncExecutor`
6. 改前端任务订阅
7. 改前端账号订阅
8. 最后整体测试

#### 原因
这是当前依赖链最短、返工最少的顺序：
- 先有发布层
- 再有 app handle 传递链
- 再接业务发布点
- 最后接前端消费

---

### 16.24 AI 编码完成后的验收清单

#### 后端
- [ ] 存在 `src-tauri/src/app_events.rs`
- [ ] 没有散落的任务类裸 `app.emit(...)`
- [ ] `WorkspaceContext` 已持有 `app_handle`
- [ ] `UnifiedTimerManager::new()` 已接收 `Option<AppHandle>`
- [ ] `EventLoop` 已能访问 `app_handle`
- [ ] `LocalBridgeSyncExecutor` 已能访问 `app_handle`

#### 手动任务路径
- [ ] `create_task` 会发布 `task-created`
- [ ] `update_task` 会发布 `task-updated`
- [ ] `delete_task` 会发布 `task-deleted`
- [ ] `pause_task` 会发布 `task-paused`
- [ ] `resume_task` 会发布 `task-resumed`
- [ ] `execute_task` 会发布 `task-executed`

#### 定时器路径
- [ ] scheduled task 自动执行后会发布 `task-executed`
- [ ] 非 task timer 不会误发任务消息

#### 账号同步路径
- [ ] 一轮同步后只发布一次 `accounts-changed`
- [ ] `process_user_info()` 不发布通知

#### 前端
- [ ] 任务详情已监听任务消息
- [ ] 任务列表已监听任务消息
- [ ] 账号列表已监听 `accounts-changed`
- [ ] 账号详情已监听 `accounts-changed`
- [ ] 所有监听都有 cleanup

#### 非阻塞约束
- [ ] 消息架构只负责消息收发，不负责串行等待订阅方完成业务处理
- [ ] 任一订阅方的处理逻辑不会阻塞其他订阅方继续接收同一条消息
- [ ] 前端监听回调采用 `void load...()` / debounce 等异步调度模式，而不是在回调里执行长时间串行逻辑
- [ ] 如果未来增加后端内部订阅者，也遵守“收消息”和“处理业务”解耦

---

## 十七、接口级规范

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
