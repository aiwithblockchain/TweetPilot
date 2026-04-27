# TweetPilot 全局配置与会话存储重构方案

## 文档信息

- **版本**: v2.0
- **创建时间**: 2026-04-27
- **状态**: 已按当前代码实现与最新产品边界校正
- **目标**: 说明 TweetPilot 当前关于全局配置、运行期 workspace 状态、recent history，以及 AI 会话存储的真实边界，并明确后续仍待推进的工作

---

## 一、当前结论

当前版本的存储与状态边界，应该明确理解为下面四层：

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

暂不继续公开支持
  新窗口独立打开另一个 workspace
```

对应产品结论如下：

1. **应用启动后始终显示首页**
2. **不做跨启动恢复 workspace**
3. **current workspace 不再写入 `config.json`，而是运行期状态**
4. **`recent-workspaces.json` 继续保留，并作为首页历史入口**
5. **`settings.json` 已成为统一全局配置文件**
6. **AI 会话与消息不再是全局 JSONL，也不是全局 conversations DB，而是 workspace-local SQLite**
7. **“新窗口打开另一个工作目录”当前不作为正式支持能力继续暴露**

---

## 二、为什么要重写这份文档

这份文档最初讨论时，代码状态和今天已经不一样了。

旧版本文档里有几处关键判断已经过时：

1. 旧文档仍把全局目录写成：

```text
~/.tweetpilot/
  ai_config.json
  config.json
  preferences.json
  recent-workspaces.json
  local-bridge-config.json
  conversations/
```

2. 旧文档仍把 conversations 描述成：
   - `~/.tweetpilot/conversations/*.jsonl`
   - 或未来要迁到 `~/.tweetpilot/conversations.db`

3. 旧文档仍把很多已经完成的工作写成“待实现”，例如：
   - runtime-only current workspace
   - `settings.json` 合并
   - recent 删除能力
   - 不存在目录仍可删

现在如果继续按旧文档理解系统，会直接误导后续开发。

所以这次不是微调措辞，而是把文档和**当前真实代码**重新对齐。

---

## 三、当前真实存储结构

### 3.1 全局目录

当前全局目录应理解为：

```text
~/.tweetpilot/
  settings.json
  recent-workspaces.json
```

它负责保存“应用级稳定数据”，而不是当前运行中的 workspace 或 AI 会话主体数据。

### 3.2 workspace-local 数据目录

每个 workspace 自己有一份本地数据库：

```text
<workspace>/.tweetpilot/
  tweetpilot.db
```

这份数据库当前承担 AI session / message / tool call 等数据的正式持久化职责。

### 3.3 运行期状态

当前 workspace 本身不属于全局磁盘配置，而属于运行期状态。

也就是说：

- 关闭应用后，不要求恢复上次 workspace
- 重启后从首页重新选择工作目录
- 本次运行中的 current workspace，由前后端运行期状态共同维持

---

## 四、当前已经落地的内容

## 4.1 current workspace 已改为运行期状态

当前代码已经不是“靠 `config.json` 恢复 current workspace”。

后端 `src-tauri/src/commands/workspace.rs` 已经使用运行期状态结构：

```rust
pub struct RuntimeWorkspaceState {
    current_workspaces: Arc<Mutex<HashMap<String, String>>>,
}
```

它按窗口 label 维护 current workspace。

这意味着：

- `set_current_workspace()` 更新运行期 current workspace
- `get_current_workspace()` 从运行期状态返回当前窗口的 workspace
- `clear_current_workspace_command()` 清空运行期状态
- current workspace 不再依赖 `config.json`

### 当前产品语义

这和当前前端启动逻辑是对齐的：

- 应用启动先显示首页
- 不自动恢复上次 workspace
- 用户在当前窗口里重新选择工作目录

这条链路是当前正式支持的主路径。

---

## 4.2 `settings.json` 已经收口

当前后端已经引入统一 settings store。

核心文件：

- `src-tauri/src/services/settings_store.rs`
- `src-tauri/src/commands/preferences.rs`
- `src-tauri/src/services/ai_config.rs`

当前统一结构已经是：

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

这里最重要的不是字段长什么样，而是职责已经收清：

- `preferences.json` 已并入 `settings.json`
- `ai_config.json` 已并入 `settings.json`
- `local-bridge-config.json` 已并入 `settings.json`

并且 `startup` 的旧语义已经被归一化，不再允许继续表达 “last-workspace 恢复启动”。

---

## 4.3 `recent-workspaces.json` 已保留，并补齐管理能力

这个文件不是低价值历史包袱，而是当前首页工作目录选择流程的一部分。

它现在的职责非常明确：

- 首页“最近使用”列表的数据来源
- “查看全部工作目录”弹窗的数据来源
- 单窗口切换 workspace 的历史入口

当前已经落地的能力包括：

1. recent 历史继续保留在 `recent-workspaces.json`
2. 后端已经支持删除单条 recent 记录
3. 前端 `WorkspaceSelector.tsx` 已提供删除入口
4. 不存在的目录不会再被静默过滤掉，而是保留并允许删除

这意味着 recent history 的产品语义已经收口为：

- 它是历史记录
- 它不是当前 workspace
- 删除 recent 记录，不会删除本地目录
- 删除 recent 记录，也不会等于关闭当前 workspace

---

## 4.4 AI 会话已经是 workspace-local SQLite

这是旧文档最过时的部分。

当前代码并不是：

- `~/.tweetpilot/conversations/*.jsonl`
- 也不是未来的 `~/.tweetpilot/conversations.db`

而是：

```text
<workspace>/.tweetpilot/tweetpilot.db
```

核心实现位于：

- `src-tauri/src/services/ai_storage.rs`
- `src-tauri/src/commands/ai.rs`

数据库路径由 `AiStorage::new(working_dir)` 按 workspace 生成：

```rust
let db_path = working_dir.join(".tweetpilot").join("tweetpilot.db");
```

这说明当前真实边界是：

```text
一个 workspace
  = 一份 .tweetpilot/tweetpilot.db
```

而不是所有 workspace 共用一个全局会话数据库。

---

## 4.5 AI 运行期状态已经按窗口隔离

当前后端 AI state 已经是 per-window 结构：

```rust
pub struct AiState {
    pub windows: Arc<Mutex<HashMap<String, WindowAiRuntimeState>>>,
}
```

这表示运行期内的：

- active session
- active request
- cancel token
- active working dir

都在朝“按窗口隔离”方向收口。

需要注意的是，这并不等于多窗口独立 workspace 已完全可用。

它只说明：

- 当前主链路已经不再是单一全局 AI runtime
- 但多窗口整体能力还没有彻底闭合，仍然存在边界问题

这一点后面单独说明。

---

## 五、当前边界应该怎么理解

## 5.1 全局持久化只管稳定设置和历史记录

当前全局目录 `~/.tweetpilot/` 里，应该只放两类东西：

1. **稳定设置**
   - `settings.json`

2. **历史记录**
   - `recent-workspaces.json`

这些都属于“跨启动仍然成立的数据”。

---

## 5.2 current workspace 只属于运行期

current workspace 不应再被理解成“配置文件的一部分”。

它的正确归属是：

- 本次运行内有效
- 当前窗口作用域有效
- 关闭应用后自然消失

所以 current workspace 不应该写进：

- `settings.json`
- `recent-workspaces.json`
- 任何新的恢复态文件

---

## 5.3 AI 会话属于 workspace-local 数据

AI session / message / tool timeline 的正确边界，不是“全局配置”，而是“当前 workspace 的业务数据”。

所以它们放在：

```text
<workspace>/.tweetpilot/tweetpilot.db
```

这是合理的，因为：

- 不同 workspace 的对话本来就应该隔离
- 工作目录变了，AI 能访问的文件上下文也变了
- 把这些数据全塞回全局目录，反而会让边界再次变脏

---

## 六、旧文档里哪些内容现在应视为失效

下面这些表述，今后不应该再作为实现依据：

### 6.1 “删除 `config.json` 还是待做”

这条现在已经不成立。

current workspace 的运行期状态改造已经落地，旧的 `config.json` 路径不应再作为主实现边界。

### 6.2 “conversations 仍然是全局 JSONL”

这条现在已经不成立。

当前真实实现已经是 workspace-local SQLite。

### 6.3 “未来把 conversations 升级为全局 `~/.tweetpilot/conversations.db`”

这条也不成立。

当前实现不是往全局 DB 迁，而是已经按 workspace 分库。

### 6.4 “recent 删除能力尚未实现”

这条也已经过时。

后端删除命令与前端删除入口都已经存在。

### 6.5 “前端会静默过滤不存在目录”

这条也已不再准确。

当前行为已经调整为：

- 保留记录
- 标记目录不存在
- 仍允许用户删除

---

## 七、当前仍未完成的部分

虽然这条主线已经推进了很多，但并不代表所有问题都解决了。

## 7.1 多窗口独立 workspace 仍然没有正式支持

当前最需要明确的一点是：

**不要把“运行期状态已按窗口收口一部分”误解成“多窗口独立 workspace 已经完成”。**

最近实际暴露的问题已经证明：

- 新窗口初始化链路不稳定
- AI 会话可能跨窗口串状态
- Explore / 文件访问可能绑定错误 workspace
- task / timer / db context 的窗口级边界仍不完整

所以当前版本的产品边界应明确为：

- 正式支持：**在当前窗口切换 workspace**
- 暂不继续公开支持：**在新窗口独立打开另一个 workspace**

相关独立分析见：

- `docs/multi-window-workspace-support-analysis.md`

---

## 7.2 `App.tsx` 里仍有启动桥接逻辑

当前前端启动流程虽然已经符合“启动后先首页”的主结论，但仍保留了新窗口初始化和运行内切换相关桥接逻辑，例如：

- `workspace-changed` 事件处理
- `set-initial-workspace` 事件处理
- 初始化中的 loading shell
- reload 触发链路

这些逻辑本身不一定是错的，但说明：

- 当前运行期 workspace 状态虽然已经收口很多
- 仍然还有一部分“启动过渡 / reload 过渡”的工程性桥接

如果后续继续追求更干净的一致性，这部分仍值得再收一轮。

不过这已经不是当前文档主结论的阻塞项。

---

## 7.3 AI/session 数据模型仍需和专门文档持续对齐

当前会话已经落在 workspace-local SQLite 中，但更细的会话模型、表结构、timeline 语义，仍然应该以专门文档为准持续收口。

相关文档：

- `docs/ai-workspace-bound-session-db-redesign.md`

也就是说，这份文档只负责定义总边界：

- 什么属于全局
- 什么属于运行期
- 什么属于 workspace-local

而不替代 AI/session 专项设计文档。

---

## 八、当前推荐的实现边界

后续如果继续沿当前主线推进，应把判断标准固定成下面这个版本。

### 8.1 全局层

继续保留：

```text
~/.tweetpilot/settings.json
~/.tweetpilot/recent-workspaces.json
```

其中：

- `settings.json` = 稳定设置
- `recent-workspaces.json` = 历史工作目录列表

### 8.2 运行期层

继续保持：

- current workspace 属于运行期状态
- AI active session / active request 属于按窗口的运行期状态
- 关闭应用后这些状态自然消失

### 8.3 workspace-local 持久化层

继续保持：

```text
<workspace>/.tweetpilot/tweetpilot.db
```

它负责：

- session metadata
- messages
- tool calls
- timeline items
- 其他与当前 workspace 绑定的 AI 数据

### 8.4 产品支持边界

当前只承诺：

- 单窗口 workspace 选择与切换
- 单窗口下 AI/session/file access 的正确绑定

当前不承诺：

- 新窗口独立 workspace 的完整隔离能力

---

## 九、后续推进顺序建议

如果后续继续推进主线，而不是重新分散到多窗口问题上，建议顺序如下：

### 9.1 先继续验证单窗口主链路

重点验证：

1. 当前窗口选择 workspace
2. AI session 创建、发送消息、切换历史会话
3. 切换到另一个 workspace 后重新绑定 session 与文件访问
4. 再切回原 workspace 后行为仍正确

这条链路稳定，当前版本的主产品价值就成立。

### 9.2 再清理仍然残留的过渡性逻辑

例如：

- 前端启动与 reload 桥接
- workspace 初始化中间态
- 某些仍然偏“兼容性补丁”的路径

目标不是为了炫技重构，而是为了让“单窗口切换 workspace”这条链路更可预测。

### 9.3 多窗口独立立项，不再混入当前收尾

这是关键。

多窗口如果将来要做，应该按独立架构任务推进，而不是在当前主线里继续打补丁。

因为它影响的是：

- 窗口身份
- workspace 归属
- AI runtime 归属
- Explore / 文件访问归属
- task / timer / db context 生命周期

这已经不是一个局部 UI bug。

---

## 十、最终建议结论

基于当前真实代码与最新产品边界，最终结论应统一为：

1. **`settings.json` 已经是唯一全局配置入口**
2. **`recent-workspaces.json` 继续保留，且已具备可管理能力**
3. **current workspace 已经改为运行期状态，不做跨启动恢复**
4. **AI 会话存储当前真实实现是 workspace-local SQLite，而不是全局 JSONL 或全局 conversations DB**
5. **当前版本只继续收口单窗口切换 workspace 主链路**
6. **“新窗口独立打开另一个 workspace”继续作为独立问题处理，不再混入本轮主线**

一句话总结：

**TweetPilot 当前的正确边界，不是“全局配置 + 全局会话库 + 跨启动恢复 workspace”，而是“全局 settings/recent + 运行期 current workspace + workspace-local AI 数据库”。**

---

## 关联文档

- `docs/multi-window-workspace-support-analysis.md`
- `docs/ai-workspace-bound-session-db-redesign.md`
- `docs/workspace-isolation-refactor.md`
