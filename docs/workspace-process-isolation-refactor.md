# 工作目录隔离为独立进程重构方案

## 版本信息
- **版本**: v1.3
- **创建时间**: 2026-04-23
- **目标**: 将当前“单进程共享工作区上下文”重构为“通过新进程打开工作目录”
- **状态**: 可实施方案草案
- **范围说明**: 本文档只讨论“通过新进程打开工作目录”的方案，不讨论单进程多上下文方案

---

## 一、术语定义

为避免实现和讨论时混淆，本文档统一使用以下术语：

- **当前实例**：当前正在运行的 TweetPilot 进程
- **新实例**：由当前实例启动的新 TweetPilot 进程
- **当前工作目录**：某个实例当前绑定的唯一 workspace
- **Open...**：启动新实例打开目标工作目录，并在确认新实例可用后退出旧实例
- **Open in New Window...**：启动新实例打开目标工作目录，同时保留旧实例继续运行
- **可用状态**：新实例已完成 workspace 初始化，已创建 `WorkspaceContext`，已启动 timers，前端可进入主界面

最重要的统一语义是：

> **一个实例在任一时刻只维护一个工作目录上下文。打开新的工作目录，一律通过启动新实例完成。**

这意味着：

- 不再把“切换到另一个工作目录”实现为“当前进程内替换 workspace”
- `Open...` 和 `Open in New Window...` 的差异只在于旧实例是否退出

---

## 二、结论先行

当前 TweetPilot 的后端状态模型是：

- 一个 Tauri 应用进程
- 一个全局 `TaskState`
- 一个全局 `Option<WorkspaceContext>`

这意味着：

> 同一个应用进程内，无论开多少个窗口，后端实际上只能同时持有一个工作目录上下文。

因此，只要继续使用当前的“同进程开新窗口”方案，就无法真正做到 IDE 那种“每个工作目录独立运行、互不覆盖”。

如果目标是：

- 一个工作目录一个独立运行单元
- 定时任务、数据库、LocalBridge 同步互不影响
- AI 会话和任务执行状态互不影响
- 某个工作目录崩掉不影响另一个工作目录

那么本文档的唯一实施方案是：

> **新工作目录不再通过 `WebviewWindowBuilder` 在当前进程内创建窗口，而是启动一个新的应用进程，并将工作目录路径作为启动参数传入。**

---

## 三、当前实现的问题

### 3.1 当前状态模型是进程级单例

关键代码：`src-tauri/src/task_commands.rs`

```rust
pub struct TaskState {
    pub workspace_context: Arc<tokio::sync::Mutex<Option<WorkspaceContext>>>,
}
```

这表示当前进程只有一个工作区上下文槽位。

### 3.2 `set_current_workspace` 会替换唯一上下文

关键代码：`src-tauri/src/commands/workspace.rs`

当前逻辑会：

1. 取出旧 `WorkspaceContext`
2. 停掉旧 timers
3. 创建新的 `WorkspaceContext`
4. 启动新 timers
5. 把新上下文写回全局 `TaskState`

因此它的真实语义是：

> “切换当前进程的唯一工作目录”

而不是：

> “给某个窗口绑定一个独立工作目录”

### 3.3 `open_folder_in_new_window` 只是同进程开新窗口

关键代码：`src-tauri/src/commands/workspace.rs`

```rust
let window = WebviewWindowBuilder::new(&app, ...)
```

这只是在当前 Tauri app 进程里增加一个 WebView 窗口，不会创建新的 OS 进程。

因此新窗口和旧窗口共享：

- 同一个 Rust 进程
- 同一个 `TaskState`
- 同一个 `WorkspaceContext` 槽位
- 同一套后端命令状态
- 同一套 AI 进程级状态

### 3.4 当前前端改动不能解决后端共享问题

当前前端工作区切换流程已经更清楚，但它解决的是：

- 重复初始化
- reload 恢复路径
- 新窗口前端初始化时机
- 选择器页 loading / 禁用状态

它**没有改变**后端“单进程单工作区”的根模型。

所以如果继续保留“同进程开新窗口”，多个窗口之间仍然会互相覆盖后端上下文。

---

## 四、目标架构

### 4.1 目标模型

目标改成：

- 一个实例在任一时刻只服务一个工作目录
- 打开新的工作目录时，总是先启动新实例
- 每个实例各自持有自己的 `TaskState`
- 每个实例只管理自己的 `WorkspaceContext`
- 每个实例只运行自己工作目录下的数据库和定时任务
- 每个实例各自维护自己的 AI 会话、取消令牌和活动请求状态

### 4.2 两个入口的产品语义

| 动作 | 行为 | 旧实例命运 |
|---|---|---|
| `Open...` | 启动新实例打开目标工作目录 | 新实例确认可用后退出旧实例 |
| `Open in New Window...` | 启动新实例打开目标工作目录 | 旧实例保留 |

### 4.3 目标效果

重构后应满足：

1. 工作目录 A 和 B 可以同时运行
2. A 的 timer 不会停掉 B 的 timer
3. A 的数据库上下文不会覆盖 B
4. A 的 AI 会话不会影响 B
5. 关闭 A 进程不会影响 B
6. 任意一个工作目录崩溃，不影响其他工作目录
7. “像 IDE 一样多开项目”成为真实能力，而不是 UI 假象

---

## 五、为什么必须是新进程

### 5.1 当前后端模型天然适合“单实例单工作目录”

现有 `TaskState` 与 `WorkspaceContext` 已经围绕“一个进程只服务一个工作目录”设计。

这意味着：

- 当前后端模型本身没有错
- 真正的问题是“项目打开方式”错了

所以重构重点不应该是重写整个状态模型，而应该是：

> 把“打开工作目录”的实现统一改成“新进程打开项目”

### 5.2 新进程方案带来的直接收益

新进程方案会天然带来：

- `TaskState` 隔离
- `WorkspaceContext` 隔离
- timer 隔离
- 数据库句柄隔离
- AI 会话状态隔离
- 前端运行时状态隔离
- 崩溃域隔离

### 5.3 本文档不讨论其他路线

为了避免范围漂移，本文档不讨论：

- 单进程多工作区上下文
- 按窗口路由 `WorkspaceContext`
- `HashMap<window_id, WorkspaceContext>`
- 其他多租户化后端方案

本文档只服务一个目标：

> **让所有“打开工作目录”的动作都通过新进程完成。**

---

## 六、前置 Gate，先验证再开工

这部分是重构第一道门槛，不通过就不能继续推进实现。

## Gate 0：验证应用是否支持多实例

### 必须验证的事项

1. 项目是否启用了单实例插件
2. 开发环境是否允许同时运行两个实例
3. 打包后 macOS 是否允许多个 `.app` 实例同时存在
4. Windows 下是否存在第二次启动被复用到已有实例的问题
5. 从当前实例拉起新实例时，CLI 参数是否能稳定传递
6. `std::env::current_exe()` 在开发态和发布态是否都返回正确路径

### 本地验证结果（2026-04-23）

本轮已在当前开发机完成第一轮 Gate 0 验证，结论如下。

#### 已确认

1. **未发现单实例插件或显式单实例配置**
   - 检查了 `src-tauri/Cargo.toml`
   - 检查了 `package.json`
   - 检查了 `src-tauri/tauri.conf.json`
   - 搜索结果未发现 `tauri-plugin-single-instance` 或等价配置

2. **debug 二进制可同时启动多个独立实例**
   - 验证对象：`src-tauri/target/debug/tweetpilot`
   - 结果：可同时看到多个 `tweetpilot` 进程存活

3. **debug 二进制支持 `--workspace <path>` 参数传递**
   - 验证对象：`src-tauri/target/debug/tweetpilot --workspace <path>`
   - 结果：进程参数中可见完整 `--workspace` 参数

4. **debug 二进制可正确承载中文与空格路径**
   - 验证路径示例：`/tmp/TweetPilot Test 中文 Space`
   - 结果：进程参数中可见完整路径

5. **release 二进制支持 `--workspace <path>` 参数传递**
   - 验证对象：`src-tauri/target/release/tweetpilot --workspace <path>`
   - 结果：进程成功启动，参数在进程列表中可见

6. **macOS `.app` 形态可多开**
   - 验证对象：`src-tauri/target/release/bundle/macos/TweetPilot.app`
   - 结果：通过 `open -n -a ...` 可启动多个可见实例

#### 已知关注点

1. **DMG 打包失败，但不阻断本方案验证**
   - `tauri build` 已成功生成 release binary 与 `.app`
   - 失败发生在 DMG bundling 阶段
   - 这不影响“新进程打开工作目录”方案本身，但会影响发布流程，需另行处理

2. **`.app` 形态下参数传递已高度可疑成立，但还缺少应用内部读取参数的最终证据**
   - 已验证：`open -n -a TweetPilot.app --args --workspace <path>` 可拉起新实例
   - 未验证：应用内部是否已读取到该参数并用于初始化 workspace
   - 当前判断：大概率可行，但实现阶段仍需补一条自检日志或启动态验证

3. **`Open...` 所需的新实例 ready 回执机制尚未验证**
   - 已验证：新实例可被拉起
   - 未验证：旧实例如何确认“新实例已可用”后再退出
   - 当前判断：这是实现阶段的主要剩余风险

### Gate 0 阶段结论

当前可给出的判断是：

> **在本地 debug / release / macOS app bundle 形态下，“通过新进程打开工作目录”这条主路线已具备继续实现的条件。**

更具体地说：

- `Open in New Window...` 改造成“新进程打开工作目录”，已经没有看到结构性阻断
- `Open...` 改造成“新进程接管后退出旧进程”，仍需补 handoff / ready 机制

### 验收标准

以下命题必须全部成立：

- 可以手动启动两个 TweetPilot 进程
- 两个进程可以同时存在于系统进程列表中
- 第二个实例不会自动复用到第一个实例
- 第二个实例能正确收到 `--workspace <path>`

### 如果 Gate 0 失败

若平台或打包形态不支持稳定多实例，则本方案暂停，先补齐运行时能力，再继续本重构。

---

## 七、状态隔离收益清单

采用新进程方案后，以下状态会天然隔离：

### 7.1 后端工作区状态
- `TaskState`
- `WorkspaceContext`
- `TaskDatabase`
- `UnifiedTimerManager`
- `LocalBridgeSyncExecutor`
- `PythonScriptExecutor`

### 7.2 AI 状态
当前 `main.rs` 里存在的：

- `ai::AiState.session`
- `ai::AiState.cancel_token`
- `ai::AiState.active_request_id`

这些在新进程模型下会按进程天然隔离，不再跨实例共享。

### 7.3 前端运行时状态
- React component state
- 当前窗口 sessionStorage
- 当前窗口 tab / side panel / local UI 状态
- 选择器页的初始化状态

### 7.4 工作目录资源
- `.tweetpilot/tweetpilot.db`
- `.tweetpilot/logs`
- workspace 本地文件操作上下文

---

## 八、详细重构设计

### 8.1 保留当前单进程内“单工作目录”模型

这一点不需要改。

每个应用进程内部仍然继续使用：

```rust
Option<WorkspaceContext>
```

因为一旦改成“通过新进程打开工作目录”，每个进程内部只有一个工作目录是合理的。

### 8.2 新增启动参数支持

在 Rust 启动入口增加参数解析，例如：

- `--workspace <path>`
- 可选：`--handoff-from <pid>`

职责：

- 启动时读取 CLI 参数
- 若检测到 `--workspace`，则直接初始化该工作目录
- 前端启动后无需再显示 selector，直接进入主界面

### 8.3 统一采用“Rust 先初始化，前端只消费结果”

这是本次重构的唯一启动时序，不走前端补初始化路线。

#### 明确要求

- 新实例读取到 `--workspace <path>` 后
- **由 Rust 在进程启动早期完成 workspace 初始化**
- 前端启动后只通过 `get_current_workspace` 消费已初始化结果
- 前端不再负责替新实例补做一次 `set_current_workspace`
- 不再依赖 `set-initial-workspace` 事件为新实例补初始化

### 8.4 无参数启动的明确语义

无 `--workspace` 参数启动时：

- 默认进入 workspace selector
- **不自动恢复历史工作目录**

这样可以保持当前产品行为稳定，也避免和多实例模型混淆。

### 8.5 `persist_current_workspace` 的语义必须收紧

当前已有“持久化当前 workspace”的逻辑，但在多实例模型下必须明确：

> 该持久化值只表示“最近一次由用户主动打开的工作目录”，用于无参数启动时展示最近记录或默认建议，不表示系统中全局唯一的活动 workspace。

明确约束：

- 新实例带 `--workspace` 启动时，可以更新 recent workspaces 记录
- 但不能把该值解释为“其他实例都应切换到这个 workspace”
- 前端无参数启动时也不能据此自动跳过 selector

### 8.6 `Open...` 的实现语义

`Open...` 不是“当前实例切换目录”，而是：

1. 当前实例弹目录选择器
2. 当前实例启动新实例，并传 `--workspace <path>`
3. 当前实例等待新实例进入“可用状态”
4. 只有在新实例可用后，当前实例才退出

#### 失败语义

若任一步失败：

- 当前实例必须保留
- 当前实例的当前工作目录不变
- 当前实例显示明确错误
- 不应进入“已丢旧实例、但新实例也没成功”的状态

### 8.7 `Open in New Window...` 的实现语义

`Open in New Window...` 的流程是：

1. 当前实例弹目录选择器
2. 当前实例启动新实例，并传 `--workspace <path>`
3. 当前实例不等待退出条件
4. 当前实例继续保留

#### 失败语义

若启动失败：

- 当前实例继续运行
- 当前实例当前工作目录不变
- 当前实例显示明确错误

### 8.8 新实例启动成功与否的定义

`spawn()` 成功不等于“工作目录已成功打开”。

本文档统一定义：

> **只有当新实例完成 workspace 初始化并具备进入主界面的条件时，才算进入“可用状态”。**

对于 `Open...`，旧实例退出的前提是：

- 新实例已进入可用状态

### 8.9 当前实例与新实例的职责边界

目录选择和进程启动都由**当前实例的 Rust 侧**完成。

明确约束：

- 不由前端直接负责启动新进程
- 不让新实例再次弹目录选择器
- 不通过前端桥接把路径再转一轮给 Rust

---

## 九、新进程启动时序

### 9.1 `Open in New Window...` 时序

1. 用户点击 `Open in New Window...`
2. 当前实例 Rust 侧弹目录选择器
3. 用户选中 workspace path
4. 当前实例 Rust 侧通过 `std::process::Command` 启动新实例
5. 新实例启动，读取 `--workspace <path>`
6. 新实例 Rust 侧创建 `WorkspaceContext`
7. 新实例 Rust 侧启动 timers
8. 新实例 Rust 侧更新 recent workspaces 记录
9. 新实例前端加载
10. 前端通过 `get_current_workspace` 得知已有 workspace
11. 前端直接渲染主界面
12. 旧实例继续保留

### 9.2 `Open...` 时序

1. 用户点击 `Open...`
2. 当前实例 Rust 侧弹目录选择器
3. 用户选中 workspace path
4. 当前实例 Rust 侧通过 `std::process::Command` 启动新实例
5. 新实例读取 `--workspace <path>`
6. 新实例完成 workspace 初始化并进入可用状态
7. 当前实例确认新实例可用
8. 当前实例退出

### 9.3 时序原则

- 初始化责任在 Rust
- 渲染责任在前端
- 不使用“窗口 ready 后再发事件补初始化”的旧路径
- `Open...` 必须先确认新实例可用，再退出旧实例

---

## 十、实施步骤

### 阶段 1：通过 Gate 0

目标：确认 TweetPilot 在目标平台上允许多实例独立运行。

修改前不写业务代码，先做验证。

验收标准：

- 两个独立实例可同时存在
- CLI 参数传递稳定

### 阶段 2：增加 CLI 参数解析

目标：应用启动时支持 `--workspace <path>`。

修改点：

- `src-tauri/src/main.rs`

验收标准：

- 手动运行应用并传入 `--workspace` 时，可读到正确路径

### 阶段 3：Rust 启动阶段自动初始化 workspace

目标：新实例启动后不用走 selector，就能直接绑定工作目录。

修改点：

- `main.rs`
- 新增初始化 helper（如需要）

验收标准：

- 带 `--workspace` 启动时，后端能创建 `WorkspaceContext` 并启动 timers
- 前端直接进入主界面
- 前端只通过 `get_current_workspace` 消费结果

### 阶段 4：重写 `Open in New Window...`

目标：从“同进程新窗口”改为“新进程打开项目”。

修改点：

- `src-tauri/src/commands/workspace.rs`

验收标准：

- 选择目录后拉起一个新的应用进程
- 两个实例分别绑定不同工作目录
- 旧实例继续保留

### 阶段 5：实现 `Open...` 的 handoff 机制

目标：让 `Open...` 也走新进程路径，并在新实例可用后退出旧实例。

修改点：

- `src-tauri/src/commands/workspace.rs`
- 可能新增跨进程 ready 确认机制

验收标准：

- `Open...` 不再调用“当前实例内切 workspace”路径
- 新实例可用后旧实例退出
- 新实例失败时旧实例保留

### 阶段 6：前端接入新启动语义

目标：前端支持“启动即已有 workspace”的新模式。

修改点：

- `src/App.tsx`
- `src/pages/WorkspaceSelector.tsx`

验收标准：

- 有初始 workspace 时不闪 selector
- 无初始 workspace 时仍进入 selector
- 无参数启动不自动恢复历史 workspace

### 阶段 7：移除旧事件路径和旧切换路径

目标：清理不再需要的桥接逻辑。

删除 / 下线内容：

- `set-initial-workspace` 事件路径
- 依赖该事件的前端初始化分支
- 同进程新窗口 workspace 注入逻辑
- 以 `set_current_workspace` 为主路径的“当前实例切目录”产品语义

验收标准：

- 系统中不存在双初始化逻辑
- 系统中不存在“当前实例内切目录”作为主路径

### 阶段 8：验证隔离性与失败路径

必须验证：

1. 进程 A 打开 workspace A
2. 进程 B 打开 workspace B
3. A/B 各自的 timer 都在跑
4. A/B 各自数据库文件只写自己目录下的 `.tweetpilot/tweetpilot.db`
5. A/B 的 AI 会话互不影响
6. `Open in New Window...` 失败时旧实例不受影响
7. `Open...` 失败时旧实例不退出
8. `Open...` 成功时旧实例在新实例可用后退出

---

## 十一、迁移与兼容策略

### 11.1 过渡阶段策略

采用分阶段迁移，不做一步到位切换。

#### Phase 1：并存阶段

保留：

- 旧前端 selector 逻辑
- 旧 `set-initial-workspace` 路径暂时存在，但不再作为主路径
- 旧 `set_current_workspace` 路径仅作兼容

新增：

- `--workspace <path>` 启动支持
- 新进程打开 workspace 的能力

#### Phase 2：切主路径

- `Open in New Window...` 正式切到新进程实现
- `Open...` 开始走新进程 handoff 路径
- 新实例初始化以 Rust 启动阶段为唯一主路径
- 旧路径仅作临时兼容，不再继续扩展功能

#### Phase 3：删除旧路径

删除：

- `set-initial-workspace` 事件
- 同进程新窗口 workspace 注入逻辑
- 依赖 `WebviewWindowBuilder` 的“项目新窗口”语义
- 把“当前实例内切换 workspace”作为产品主路径的实现

### 11.2 旧路径冻结规则

从 Phase 2 开始：

> **禁止向 `set-initial-workspace` 路径和“当前实例内切目录”路径新增任何功能或行为，只允许做兼容性维护或删除。**

### 11.3 文档与测试同步要求

每个阶段都要同步：

- 更新架构文档
- 更新测试说明
- 在 PR / commit 中明确当前所处阶段

---

## 十二、非目标

本次重构不解决以下问题：

- 单实例内并存多个工作目录
- 实例间通信
- 多实例统一管理面板
- 跨实例同步当前 tabs / side panel / UI 状态
- 完整设计“切换工作目录后 UI 如何重置”的所有细节
- recent workspaces 的跨实例去重和高级同步策略

这些不在本文档范围内。

---

## 十三、涉及文件

### 核心后端
- `src-tauri/src/main.rs`
- `src-tauri/src/commands/workspace.rs`
- `src-tauri/src/task_commands.rs`

### 前端
- `src/App.tsx`
- `src/pages/WorkspaceSelector.tsx`

### 测试
- `src/pages/WorkspaceSelector.test.tsx`
- 新增 Rust 侧启动参数 / 进程启动逻辑测试（如可行）
- 新增多实例隔离验证脚本或人工验证 checklist
- 新增 AI 状态隔离验证 checklist

---

## 十四、风险与注意事项

### 14.1 单实例配置风险

如果当前应用被配置成单实例，那么“拉起新进程”可能会失败，或被系统重定向到已有实例。

这是本方案最高优先级风险。

### 14.2 启动参数转义风险

workspace path 可能包含：

- 空格
- 中文
- 特殊字符

需要保证参数传递和解析可靠。

### 14.3 `current_exe()` 入口风险

`std::env::current_exe()` 可以作为候选实现方式，但不能默认假设它在 dev / 打包产物 / 所有平台上都天然正确。

必须通过 Gate 0 验证：

- 开发态是否正确
- 打包产物是否正确
- 目标平台最终分发形态是否正确

### 14.4 启动时机风险

如果 Rust 初始化 workspace 太晚，前端可能先渲染 selector 再闪进主界面，造成启动闪烁。

建议尽量在 Rust 侧先完成初始 workspace 状态准备。

### 14.5 旧事件路径残留风险

如果 `set-initial-workspace` 和新进程方案同时保留过久，容易形成双路径行为，造成后续调试困难。

建议在新方案稳定后尽快下线旧路径。

### 14.6 `Open...` 的失败路径风险

如果 `Open...` 在没有确认新实例可用前就退出旧实例，会导致用户丢失当前实例。

因此：

> **`Open...` 的退出动作必须晚于新实例进入可用状态。**

---

## 十五、验收标准总表

本重构完成后，必须同时满足：

1. `Open in New Window...` 会启动新进程，而不是新 WebView
2. `Open...` 会启动新进程，并在新实例可用后退出旧实例
3. 新进程可通过 `--workspace <path>` 正确绑定工作目录
4. 新进程启动后，Rust 侧先完成 workspace 初始化
5. 前端只通过 `get_current_workspace` 消费已初始化结果
6. 前端不会通过旧事件再补一次初始化
7. 两个工作目录的 timers 可同时运行且互不影响
8. 两个工作目录的 `.tweetpilot/tweetpilot.db` 只写各自目录
9. 两个工作目录的 AI 会话互不影响
10. 无参数启动默认进入 selector，不自动恢复历史 workspace
11. 旧路径删除后，系统中不存在双初始化逻辑
12. 旧路径删除后，系统中不存在“当前实例内切目录”作为产品主路径

---

## 十七、建议的提交拆分

为降低回滚成本和排查难度，建议按以下 4 个 commit 推进，不要把 `Open...` 的 handoff 逻辑混进本阶段。

### Commit 1
**建议消息**：`feat: support launching app with workspace argument`

#### 目标
打通：

- `--workspace <path>`
- Rust 启动阶段自动初始化 workspace

#### 主要改动文件
- `src-tauri/src/main.rs`
- 如有必要，小范围整理：`src-tauri/src/commands/workspace.rs`

#### 文件级改动意图

##### `src-tauri/src/main.rs`
- 增加 CLI 参数解析
- 识别 `--workspace <path>`
- 在 app 启动阶段，如果拿到 path：
  - 创建 / 初始化该 workspace 的上下文
  - 启动 timers
  - 让当前实例处于“已有 workspace”状态
- **不改菜单定义**
- **不改 `Open...` / `Open in New Window...` 的产品行为**

##### `src-tauri/src/commands/workspace.rs`
- 仅在必要时抽出可复用初始化 helper
- **不改 `open_folder_in_new_window`**
- **不删除 `set-initial-workspace`**

##### `src-tauri/src/task_commands.rs`
- 原则上不改
- 如需极小可见性调整，仅为复用 `WorkspaceContext::new()` / `start_timers()`
- **不改 `TaskState` 结构**

##### `src/App.tsx`
- 这个 commit 里尽量不改

#### 这个 commit 不做的事
- 不改前端启动判定逻辑
- 不改菜单行为
- 不做 handoff

---

### Commit 2
**建议消息**：`feat: open main app directly when workspace is preloaded`

#### 目标
让前端支持：

- 当前实例已有 workspace 时，直接进入主界面
- 无 workspace 时，仍进入 selector

#### 主要改动文件
- `src/App.tsx`
- 可能涉及：`src/pages/WorkspaceSelector.tsx`
- 可能涉及：`src/pages/WorkspaceSelector.test.tsx`

#### 文件级改动意图

##### `src/App.tsx`
- 启动时先检查当前实例是否已有 workspace
- 推荐通过 `get_current_workspace`
- 如果已有：直接进入 `AppShell`
- 如果没有：进入 `WorkspaceSelector`
- **不改菜单命令**
- **不做新进程启动逻辑**
- **不强化 `set-initial-workspace`**

##### `src/pages/WorkspaceSelector.tsx`
- 只做必要清理
- 让 selector 更纯粹地只承担“无 workspace 时入口页”的职责
- **不让 selector 继续承担新实例启动初始化职责**

##### `src/pages/WorkspaceSelector.test.tsx`
- 补或调整测试：
  - 无 workspace 时 selector 出现
  - 有 workspace 时不应走 selector 主流程
- **不把新进程行为测进来**

##### `src-tauri/src/main.rs`
- 如前端判定需要，可做轻微配合
- **不新增菜单产品行为**

#### 这个 commit 不做的事
- 不改 `Open in New Window...`
- 不改 `Open...`
- 不删除旧事件路径

---

### Commit 3
**建议消息**：`feat: open workspace in a new process from new window action`

#### 目标
把 `Open in New Window...` 真正改成：

- 当前实例选目录
- 当前实例拉起新进程
- 新进程带 `--workspace <path>` 启动
- 当前实例继续保留

#### 主要改动文件
- `src-tauri/src/commands/workspace.rs`
- 必要时小改：`src-tauri/src/main.rs`

#### 文件级改动意图

##### `src-tauri/src/commands/workspace.rs`
- 重写 `open_folder_in_new_window(app)`
- 从：
  - `WebviewWindowBuilder::new(...)`
  - `window.emit("set-initial-workspace", path)`
- 改成：
  - 目录选择器拿 path
  - 启动新的 OS 进程
  - 传 `--workspace <path>`
- 当前实例：
  - **不能调用自己的 `set_current_workspace(path)`**
  - **不能 reload**
  - **不能改自己的 `currentWorkspace`**
- **不实现 `Open...` handoff**

##### `src-tauri/src/main.rs`
- 如启动入口解析还需配合，可做轻微调整
- **不扩展到 `Open...`**

##### `src/App.tsx`
- 原则上不需要大改
- 若新主路径引出前端兼容问题，只做最小修正
- **不重新引入事件注入依赖**

#### 这个 commit 不做的事
- 不实现旧实例退出
- 不做跨进程 ready 确认
- 不做 `Open...`

---

### Commit 4
**建议消息**：`chore: freeze legacy workspace window init path`

#### 目标
把旧路径降级成兼容逻辑，防止后面继续分叉。

#### 主要改动文件
- `src-tauri/src/commands/workspace.rs`
- `src/App.tsx`
- `src/pages/WorkspaceSelector.tsx`
- `src/pages/WorkspaceSelector.test.tsx`
- `docs/workspace-process-isolation-refactor.md`

#### 文件级改动意图

##### `src-tauri/src/commands/workspace.rs`
- 给旧 `set-initial-workspace` 相关路径降级
- 如有注释，明确标注：
  - 旧兼容路径
  - 不再作为主流程
- **先不要激进删除所有旧代码，除非已确认完全不用**

##### `src/App.tsx`
- 明确当前主流程已是：启动时读取已有 workspace
- 旧注入路径如果还保留，只能作为兼容
- **不再给旧事件路径补行为**

##### `src/pages/WorkspaceSelector.tsx`
- 只保留 selector 作为“无 workspace 时入口”的职责
- 移除对旧主路径的暗依赖（如仍有）

##### `src/pages/WorkspaceSelector.test.tsx`
- 补最小回归测试
- 保证 selector 逻辑仍正常

##### `docs/workspace-process-isolation-refactor.md`
- 写明：
  - `Open in New Window...` 已切到新进程
  - `Open...` 仍待 handoff
  - 旧路径已冻结

#### 这个 commit 不做的事
- 不实现 `Open...`
- 不删除所有旧代码，除非主路径已完全稳定

---

## 十八、每个提交的验收测试清单

以下清单用于每个 commit 完成后的手动验收，确保每一步都可独立回归。

### Commit 1 验收测试清单
`feat: support launching app with workspace argument`

#### A. 基础启动验证
- [ ] 无参数启动仍然进入 `WorkspaceSelector`
- [ ] debug binary 带 `--workspace <path>` 启动时，后端初始化成功
- [ ] release binary 带 `--workspace <path>` 启动时，后端初始化成功
- [ ] 中文 / 空格路径可用，例如：`/tmp/TweetPilot Test 中文 Space`

#### B. 后端状态验证
- [ ] `get_current_workspace` 返回正确 path
- [ ] 目标目录下出现 `.tweetpilot` / `.tweetpilot/tweetpilot.db` 等初始化副作用
- [ ] `WorkspaceContext` 和 timers 已启动

#### C. 回归验证
- [ ] 无参数启动后，用户仍可通过 selector 手动选择目录并正常进入主界面

#### Commit 1 通过标准
- 无参数启动仍进 selector
- 带 `--workspace` 启动时后端初始化成功
- 中文 / 空格路径成立
- `get_current_workspace` 可返回正确 path

---

### Commit 2 验收测试清单
`feat: open main app directly when workspace is preloaded`

#### A. 主路径验证
- [ ] 带 `--workspace` 启动时不再显示 selector
- [ ] 带 `--workspace` 启动时直接进入 `AppShell`
- [ ] 无参数启动时仍显示 selector

#### B. 重复初始化验证
- [ ] 不出现“Rust 启动初始化一次，前端再初始化一次”的双调用
- [ ] 不出现重复 stop/start timers
- [ ] 前端只消费已有 workspace，不主动补初始化

#### C. 回归验证
- [ ] selector 仍能正常手动选择目录
- [ ] 旧事件路径不会干扰主路径

#### Commit 2 通过标准
- 带 `--workspace` 启动时直接进主界面
- 无参数启动时仍进 selector
- 没有双初始化

---

### Commit 3 验收测试清单
`feat: open workspace in a new process from new window action`

#### A. 主流程验证
- [ ] 当前实例 A 已打开 workspace A
- [ ] 在 A 中点击 `Open in New Window...`
- [ ] 选择 workspace B 后，系统启动一个新的实例
- [ ] 新实例直接进入 workspace B
- [ ] 旧实例 A 仍保留在 workspace A

#### B. 进程级验证
- [ ] 系统中确实存在两个独立实例
- [ ] 当前实例没有偷偷调用 `set_current_workspace(B)`
- [ ] 当前实例没有 reload 成 B

#### C. 隔离验证
- [ ] A/B 的 workspace 不互相覆盖
- [ ] A/B 各自使用自己目录下的 `.tweetpilot/tweetpilot.db`
- [ ] 打开 B 不会让 A 的 timer 停掉
- [ ] A/B 的 AI 会话状态不互相影响（如当前流程可验证）

#### D. 失败路径验证
- [ ] 新进程启动失败时，A 不受影响
- [ ] 新实例初始化失败时，A 不受影响
- [ ] 当前实例显示明确错误，而不是静默失败

#### Commit 3 通过标准
- `Open in New Window...` 真正拉起新实例
- A 保持 A
- B 进入 B
- 两者互不覆盖
- 失败时 A 安全保留

---

### Commit 4 验收测试清单
`chore: freeze legacy workspace window init path`

#### A. 主路径一致性验证
- [ ] `Open in New Window...` 主路径只剩新进程方案
- [ ] 主流程不再依赖 `set-initial-workspace`
- [ ] 主流程不再依赖同进程 WebView 注入

#### B. 回归验证
- [ ] 无参数启动仍进 selector
- [ ] 带 `--workspace` 启动仍直进主界面
- [ ] `Open in New Window...` 仍按新进程工作

#### C. 文档一致性验证
- [ ] 文档与代码一致
- [ ] 文档明确：
  - `Open in New Window...` = 新进程
  - `Open...` 仍待 handoff
  - 旧路径已冻结

#### Commit 4 通过标准
- 旧路径不再是主路径
- 新路径稳定
- 文档、代码、测试叙事一致

---

## 二十、Commit 1 的实现前准备

### 20.1 这个 commit 的唯一目标

Commit 1 只打通这件事：

> **应用实例带 `--workspace <path>` 启动时，Rust 在启动阶段完成 workspace 初始化。**

这个 commit 完成后，至少应做到：

- 直接运行 `tweetpilot --workspace /path/to/project`
- 应用实例启动后，后端已经绑定该 workspace

### 20.2 这个 commit 明确不做的事

- 不改 `Open in New Window...`
- 不改 `Open...`
- 不做 handoff
- 不改前端 selector 主流程
- 不重构旧事件路径

---

### 20.3 这次真正要碰的入口和函数

#### 1. `src-tauri/src/main.rs`
这是这个 commit 的第一主战场。

需要在这里完成：

- 读取 CLI 参数
- 识别 `--workspace <path>`
- 如果存在该参数，在 app 启动阶段初始化 workspace

实现前必须先回答两个问题：

1. 参数在什么阶段读取
2. 真正依赖 `TaskState` / app 上下文的初始化动作在哪个阶段执行

建议原则：

> 参数读取尽量早做，但真正依赖 app state 的初始化动作放在可安全访问 `TaskState` 的启动阶段执行。

#### 2. `src-tauri/src/commands/workspace.rs`
这是这个 commit 的第二主战场，但目标不是改菜单，而是找复用点。

重点关注函数：

- `set_current_workspace(...)`

实现前需要把它的职责拆清楚：

1. 校验 path
2. 检查 `.tweetpilot.json`
3. 必要时初始化 workspace
4. 停旧 timers
5. 创建新 `WorkspaceContext`
6. 启动新 timers
7. 写回 `TaskState`
8. 持久化 current workspace

本 commit 的关键判断是：

> 是否需要抽出一个内部 helper，让“启动阶段初始化”和“命令式切换 workspace”都能复用同一套核心逻辑。

建议原则：

> 不要在 `main.rs` 中硬模拟前端 invoke 命令调用，优先抽内部 helper，再由命令入口和启动入口共同复用。

#### 3. `src-tauri/src/task_commands.rs`
这个文件这次不是主改动点，但必须先读清楚，确保不误伤核心模型。

重点确认：

- `TaskState` 仍然是一进程一份
- `WorkspaceContext::new(workspace_path)` 的职责清楚
- `WorkspaceContext::start_timers()` 的副作用清楚

实现前的结论应该是：

> 当前单进程单 workspace 模型保持不变，本 commit 不引入多上下文，不重构 `TaskState`。

---

### 20.4 建议的实现顺序

#### Step 1：先确定参数读取位置
产出目标：

- 明确 `workspace_path_from_args: Option<String>` 从哪里来
- 明确该值在哪个启动阶段被消费

#### Step 2：确认 `set_current_workspace` 是否可复用
产出目标：

- 判断是否抽内部 helper
- 明确哪些逻辑属于“可复用初始化逻辑”
- 明确哪些逻辑仍然属于命令入口专属行为

#### Step 3：在启动阶段接入 helper
产出目标：

- 若存在 `--workspace <path>`，则初始化 workspace
- 写入 `TaskState`
- 启动 timers
- 持久化当前 workspace

关键约束：

- 启动期只做一次初始化
- 不允许等待前端再补做一次

#### Step 4：先只验证后端状态成立
产出目标：

- 带参数启动后，后端状态正确
- 不要求这一步就把前端体验完全做完美

---

### 20.5 最容易误伤的现有逻辑

#### 1. 不要破坏无参数启动
当前明确要求：

- 无参数启动进入 selector
- 不自动恢复历史 workspace

因此必须坚持：

> 只有明确带 `--workspace` 时才走启动期初始化。

#### 2. 不要让前端再补一次初始化
虽然这个 commit 先不改前端主流程，但必须有意识为下一步铺路：

> 后端一旦支持启动期初始化，后续前端只能消费结果，不能再对同一路径补一次初始化。

#### 3. 不要误伤 selector 手动选择路径
即使抽 helper，也要保持入口语义清楚：

- 启动带参数 → 初始化 helper
- selector 手动选择 → 仍可复用同一 helper，但入口语义不同

#### 4. 不要提前碰 `Open in New Window...`
本 commit 允许阅读相关逻辑，但不改它的行为。

---

### 20.6 Commit 1 的最小完成判定

只要拿到下面 4 个结果，这个 commit 就算完成：

- [ ] 应用启动时能识别 `--workspace <path>`
- [ ] Rust 启动阶段能据此初始化 workspace
- [ ] `get_current_workspace` 能返回该 path
- [ ] 无参数启动行为不变

---

### 20.7 建议优先补的日志

为了让 Commit 1 更容易验收，建议优先补这些日志：

#### 启动参数读取日志
需要明确区分：

- app startup with workspace arg
- app startup without workspace arg

#### 启动期 workspace 初始化日志
需要明确区分：

- startup workspace initialization
- user-triggered workspace switch

#### `WorkspaceContext` 创建日志
要能明确看出：

- workspace path
- 是否属于启动期触发

---

### 20.8 Commit 1 开工前的准备完成标准

以下问题在编码前必须已经想清楚：

- [ ] CLI 参数打算在哪读
- [ ] workspace 初始化逻辑是直接复用还是抽 helper
- [ ] 无参数启动必须保持 selector
- [ ] 本次不碰 `Open in New Window...`
- [ ] 完成标准只看后端初始化成立，不强求前端体验一步到位

---

## 二十一、Commit 2 的实现前准备

### 21.1 这个 commit 的唯一目标

Commit 2 只解决这件事：

> **当前实例如果在启动时已经拥有 workspace，前端应直接进入主界面；如果没有 workspace，前端仍进入 selector。**

这个 commit 完成后，至少应做到：

- 带 `--workspace <path>` 启动的新实例，不再先闪 selector 再进入主界面
- 无参数启动实例，仍然进入 selector

### 21.2 这个 commit 明确不做的事

- 不改 `Open in New Window...`
- 不改 `Open...`
- 不做 handoff
- 不删除旧事件路径
- 不改 Rust 启动参数解析主逻辑

---

### 21.3 这次真正要碰的入口和函数

#### 1. `src/App.tsx`
这是这个 commit 的第一主战场。

需要在这里完成：

- 启动时优先检查当前实例是否已经有 workspace
- 推荐通过 `get_current_workspace` 或等价现有接口
- 若已有 workspace：直接进入 `AppShell`
- 若没有 workspace：进入 `WorkspaceSelector`

实现前必须先想清楚两个问题：

1. 前端在什么时机读取“当前实例已有 workspace”
2. 如何避免把“已有 workspace”再次当作“需要初始化的 workspace”重复处理

建议原则：

> 前端只消费当前实例已经存在的 workspace 结果，不负责为带参数启动的新实例补做初始化。

#### 2. `src/pages/WorkspaceSelector.tsx`
这个文件这次不是主战场，但必须确认职责边界。

需要关注：

- selector 是否仍然承担“无 workspace 时入口页”的单一职责
- 是否还残留“为新实例初始化补位”的逻辑假设

本 commit 的目标不是重写 selector，而是保证：

> 新实例带参数启动时，selector 不再参与主流程。

#### 3. `src/pages/WorkspaceSelector.test.tsx`
这个文件需要跟上启动判定语义的变化。

重点是补或调整以下测试方向：

- 无 workspace 时 selector 出现
- 有 workspace 时，前端主流程不应再停留在 selector

注意：

- 不把跨进程行为强行塞进这个测试文件
- 不在这个 commit 里测试菜单行为

#### 4. `src-tauri/src/main.rs`
这个文件本 commit 原则上不做主改动。

但要先确认一件事：

- Commit 1 中建立的“带 `--workspace` 启动时，Rust 已完成初始化”语义已经成立

否则 Commit 2 的前端主流程会建立在不稳定前提上。

---

### 21.4 建议的实现顺序

#### Step 1：先确定前端读取当前 workspace 的时机
产出目标：

- 明确前端在启动流程哪个阶段读取“当前实例已有 workspace”
- 明确读取结果如何驱动 `workspaceReady` / `isCheckingWorkspace` 等状态

#### Step 2：改 `App.tsx` 的启动判定逻辑
产出目标：

- 有 workspace 时，直接进 `AppShell`
- 无 workspace 时，进入 `WorkspaceSelector`

关键约束：

- 不重复调用初始化逻辑
- 不依赖旧事件路径补初始化

#### Step 3：校验 selector 的职责边界
产出目标：

- 确认 selector 只在“无 workspace”时出现
- 确认新实例带参数启动时不会先进入 selector

#### Step 4：补最小测试
产出目标：

- 至少有测试或人工回归步骤能覆盖“已有 workspace 直进主界面”
- 保持“无 workspace 进 selector”的旧行为不被破坏

---

### 21.5 最容易误伤的现有逻辑

#### 1. 不要把“已有 workspace”误写成“自动恢复历史工作目录”
当前明确要求：

- 无参数启动进入 selector
- 不自动恢复历史 workspace

因此必须坚持：

> 前端只在“当前实例已经被 Rust 初始化为某个 workspace”时直进主界面，而不是根据 persisted current workspace 自动恢复。

#### 2. 不要重复调用 `set_current_workspace`
如果 Commit 1 已经让 Rust 在启动阶段完成初始化，那么 Commit 2 绝不能再让前端对同一路径调用一次初始化命令。

必须坚持：

> 前端只读结果，不补初始化。

#### 3. 不要让旧 `set-initial-workspace` 路径重新成为主流程
本 commit 虽然不删除旧事件路径，但也不能继续强化它。

必须坚持：

> 带参数启动的新实例主流程依赖“Rust 先初始化 + 前端读取当前 workspace”，而不是依赖旧事件注入。

#### 4. 不要误伤 selector 手动选择逻辑
无参数启动时，用户仍然要能通过 selector 正常选目录并进入主界面。

必须坚持：

> Commit 2 改的是“启动判定”，不是“selector 的基本选择能力”。

---

### 21.6 Commit 2 的最小完成判定

只要拿到下面 4 个结果，这个 commit 就算完成：

- [ ] 带 `--workspace` 启动时，前端直接进入主界面
- [ ] 无参数启动时，前端仍进入 selector
- [ ] 前端不会对同一路径重复初始化
- [ ] selector 手动选目录能力不受影响

---

### 21.7 建议优先补的日志

为了让 Commit 2 更容易验收，建议优先补这些日志：

#### 启动判定日志
需要明确区分：

- app startup detected existing workspace
- app startup found no workspace

#### 前端主流程日志
需要明确区分：

- entering AppShell from preloaded workspace
- entering WorkspaceSelector because no workspace is loaded

#### 重复初始化防护日志
如仍存在历史路径，建议加日志明确看到：

- skipped frontend initialization because workspace already exists

---

### 21.8 Commit 2 开工前的准备完成标准

以下问题在编码前必须已经想清楚：

- [ ] 前端打算在什么时机读取当前 workspace
- [ ] 有 workspace 与无 workspace 的判定边界是什么
- [ ] 无参数启动不能自动恢复历史 workspace
- [ ] 本次不改菜单行为
- [ ] 本次不重新引入或强化旧事件路径
- [ ] 完成标准只看“前端直进主界面”和“不重复初始化”

---

## 二十二、Commit 3 的实现前准备

### 22.1 这个 commit 的唯一目标

Commit 3 只解决这件事：

> **把 `Open in New Window...` 从“同进程创建新 WebView 窗口”改成“当前实例启动一个新的应用进程，并让新实例通过 `--workspace <path>` 进入目标工作目录”。**

这个 commit 完成后，至少应做到：

- 当前实例 A 已在 workspace A 中运行
- 在 A 中执行 `Open in New Window...`
- 选择 workspace B 后，系统启动一个新的实例
- 新实例直接进入 workspace B
- 旧实例 A 继续保留在 workspace A

### 22.2 这个 commit 明确不做的事

- 不实现 `Open...` 的 handoff
- 不让旧实例退出
- 不做新实例 ready 回执机制
- 不全面删除旧事件路径
- 不重构 `TaskState` / `WorkspaceContext` 模型

---

### 22.3 这次真正要碰的入口和函数

#### 1. `src-tauri/src/commands/workspace.rs`
这是这个 commit 的第一主战场。

重点目标：

- 重写 `open_folder_in_new_window(app)`

当前逻辑是：

- 选目录
- `WebviewWindowBuilder::new(...)`
- `window.emit("set-initial-workspace", path)`

本 commit 目标逻辑是：

- 当前实例弹目录选择器
- 选择目标 workspace path
- 当前实例通过进程启动入口拉起新实例
- 传 `--workspace <path>` 给新实例
- 当前实例不切换自己的 workspace
- 当前实例继续保留

实现前需要先把这几个职责边界想清楚：

1. 目录选择由谁负责
2. 新进程启动由谁负责
3. 当前实例绝不能在成功或失败时污染自己的 workspace 状态

必须坚持：

> `Open in New Window...` 的目录选择和进程启动都由当前实例的 Rust 侧完成，不交给前端负责启动进程。

#### 2. `src-tauri/src/main.rs`
这个文件不是主改动点，但必须确认一个前提：

- Commit 1 已让带 `--workspace` 的新实例能自动初始化 workspace

否则 Commit 3 的新进程路径无法闭环。

如果需要轻微调整，仅限于：

- 保证新实例通过参数启动时能稳定进入初始化链路

#### 3. `src/App.tsx`
这个文件本 commit 原则上不应大改。

只有在主路径切换后发现前端存在轻微兼容问题时，才做最小修正。

必须坚持：

- 不重新引入事件注入依赖
- 不为新进程路径补前端初始化
- 不让当前实例因为菜单动作去更新自己的 `currentWorkspace`

---

### 22.4 建议的实现顺序

#### Step 1：先锁定新进程启动入口
产出目标：

- 明确当前实例打算通过什么入口启动新实例
- 确认该入口在 dev / release 形态下都成立
- 参数可安全传递，不手动拼接脆弱 shell 字符串

#### Step 2：重写 `open_folder_in_new_window`
产出目标：

- 同进程 `WebviewWindowBuilder::new(...)` 路径被替换
- 新主路径变成“目录选择 + 启动新进程 + 传参数”

关键约束：

- 当前实例不能调用自己的 `set_current_workspace(path)`
- 当前实例不能 reload
- 当前实例不能改自己的 `currentWorkspace`

#### Step 3：验证新实例是否进入目标 workspace
产出目标：

- 新实例启动后直接进入目标 workspace
- 不要求旧实例等待 ready
- 不要求旧实例做跨进程握手

#### Step 4：只验证 `Open in New Window...` 新主路径
产出目标：

- 先确认“新增实例并保留旧实例”闭环成立
- 不把 `Open...` handoff 混进来

---

### 22.5 最容易误伤的现有逻辑

#### 1. 当前实例不能偷偷切到新目录
这是本 commit 最大风险。

必须坚持：

> 在 `Open in New Window...` 流程里，当前实例绝不能调用 `set_current_workspace(B)`，也不能把自己的 UI 状态切到 B。

如果发生这个问题，就说明虽然新实例起来了，但系统仍然残留“当前实例内切目录”的旧主路径。

#### 2. 不要继续依赖 `set-initial-workspace`
本 commit 不能再让新主路径依赖：

- `set-initial-workspace`
- `window.emit(...)`
- 同进程新窗口初始化注入

必须坚持：

> `Open in New Window...` 的新主路径只依赖“新进程 + `--workspace` + Rust 启动期初始化”。

#### 3. 不要把失败路径做成静默失败
如果新进程启动失败，当前实例必须：

- 继续保留
- 当前工作目录不变
- 明确提示错误

不能只打日志，然后让用户误以为动作成功。

#### 4. 不要在这个 commit 顺手碰 `Open...`
`Open...` 的 handoff 需要新实例 ready 后旧实例退出，这比当前 commit 更复杂。

必须坚持：

> Commit 3 只切 `Open in New Window...`，不碰 `Open...`。

---

### 22.6 Commit 3 的最小完成判定

只要拿到下面 5 个结果，这个 commit 就算完成：

- [ ] `Open in New Window...` 不再创建同进程 WebView
- [ ] 当前实例执行该动作后，会启动一个新实例
- [ ] 新实例会通过 `--workspace <path>` 进入目标工作目录
- [ ] 当前实例继续保留在原工作目录
- [ ] 失败时当前实例不受影响

---

### 22.7 建议优先补的日志

为了让 Commit 3 更容易验收，建议优先补这些日志：

#### 新窗口动作入口日志
需要明确看到：

- current instance received open-in-new-window action
- selected workspace path for new instance

#### 新进程启动日志
需要明确看到：

- spawning new app instance with workspace path
- spawn succeeded / spawn failed

#### 当前实例保护日志
建议能明确看到：

- current instance preserved existing workspace
- skipped in-process workspace switch for open-in-new-window

---

### 22.8 Commit 3 开工前的准备完成标准

以下问题在编码前必须已经想清楚：

- [ ] 新实例启动入口已经确认
- [ ] 当前实例不会调用自己的 `set_current_workspace(path)`
- [ ] 旧 `set-initial-workspace` 路径不再作为主路径
- [ ] 失败时当前实例必须保留
- [ ] 本次不实现 `Open...` handoff

---

## 二十三、Commit 4 的实现前准备

### 23.1 这个 commit 的唯一目标

Commit 4 只解决这件事：

> **把旧 workspace 窗口初始化路径降级为兼容逻辑，冻结它，避免系统中长期并存两条主路径。**

这个 commit 完成后，至少应做到：

- `Open in New Window...` 的主路径明确是“新进程打开项目”
- `set-initial-workspace` 不再承担主流程职责
- 文档、代码、测试对主路径的叙述一致

### 23.2 这个 commit 明确不做的事

- 不实现 `Open...`
- 不实现 handoff
- 不强求一次删掉所有旧代码
- 不重构前端整体结构

---

### 23.3 这次真正要碰的入口和函数

#### 1. `src-tauri/src/commands/workspace.rs`
这是这个 commit 的第一主战场。

需要在这里完成：

- 给旧 `set-initial-workspace` 相关路径降级
- 明确旧路径是兼容逻辑，不再作为主流程
- 如有注释，显式写明冻结状态

实现前必须先判断：

- 旧路径当前还有没有必要保留作短期兼容
- 哪些分支可以立即移除
- 哪些分支暂时保留但必须冻结

#### 2. `src/App.tsx`
这个文件需要完成的不是大改，而是主路径叙事收束。

需要确认：

- 当前主流程已经是“启动时读取已有 workspace”
- 旧事件路径即便还在，也不能再承担主流程职责

必须坚持：

> 不再给旧事件路径新增任何新行为。

#### 3. `src/pages/WorkspaceSelector.tsx`
这个文件需要确认职责边界是否已经纯化：

- selector 只在“无 workspace”时作为入口页出现
- 不再承担旧主路径的兼容性补位职责

#### 4. `src/pages/WorkspaceSelector.test.tsx`
需要补最小回归测试，保证：

- selector 主逻辑不坏
- 新主路径稳定后，没有回退到旧主路径

#### 5. `docs/workspace-process-isolation-refactor.md`
需要把当前真实状态写清楚：

- `Open in New Window...` 已切到新进程
- `Open...` 仍待 handoff
- 旧 `set-initial-workspace` 已冻结

---

### 23.4 建议的实现顺序

#### Step 1：先标记旧路径状态
产出目标：

- 明确哪些旧路径已经不是主流程
- 在代码和文档中写清楚冻结状态

#### Step 2：收束前端主流程叙事
产出目标：

- 当前前端主流程只认“已有 workspace 直进主界面”
- 旧事件路径不再参与主决策

#### Step 3：补最小回归测试
产出目标：

- selector 基本行为仍在
- 新主路径稳定
- 没有旧路径反向抢主流程

#### Step 4：更新文档
产出目标：

- 文档、代码、测试的叙述一致
- 后续开发者不会误以为还有两条主路径都在被积极维护

---

### 23.5 最容易误伤的现有逻辑

#### 1. 不要过早删光旧代码
虽然目标是冻结旧路径，但这不等于当前就必须一次性删除所有旧代码。

必须坚持：

> 先冻结主路径，再在确认没有依赖后删除旧代码。

#### 2. 不要让旧路径继续长新逻辑
这是本 commit 的核心纪律。

必须坚持：

> 从这一阶段开始，旧 `set-initial-workspace` 路径和“当前实例内切目录”路径只允许兼容或删除，不允许新增功能。

#### 3. 不要让文档和实现脱节
如果代码已经切到新主路径，但文档还写成旧语义，后续一定会反复返工。

必须坚持：

> Commit 4 的一部分价值就是让文档、代码、测试叙事统一。

---

### 23.6 Commit 4 的最小完成判定

只要拿到下面 5 个结果，这个 commit 就算完成：

- [ ] `Open in New Window...` 的主路径只剩新进程方案
- [ ] 旧 `set-initial-workspace` 路径已冻结
- [ ] selector 仍只在无 workspace 时作为入口页出现
- [ ] 文档与代码对主路径描述一致
- [ ] 没有继续往旧路径补新逻辑

---

### 23.7 建议优先补的日志和注释

为了让 Commit 4 的维护价值更高，建议优先补这些说明：

#### 代码注释
需要明确标注：

- legacy compatibility path
- no longer the primary flow
- do not add new behavior here

#### 文档标记
需要明确标注：

- `Open in New Window...` is now process-based
- `Open...` handoff remains future work

---

### 23.8 Commit 4 开工前的准备完成标准

以下问题在编码前必须已经想清楚：

- [ ] 新主路径已经稳定
- [ ] 旧路径当前仍存在的理由已经明确
- [ ] 本次目标是冻结，不是强行一次性删光
- [ ] 本次不实现 `Open...`
- [ ] 文档需要同步更新，不允许实现和文档脱节

---

## 二十五、建议补充的观察日志清单

本章节的目的不是增加业务功能，而是让每个 commit 在实现和验收时更容易观察路径是否正确、是否误走旧逻辑、是否发生重复初始化。

原则：

- 日志只服务当前重构，不要把长期噪音打满
- 日志内容要能明确看出“是谁触发的”“在哪个实例里”“当前 workspace 是谁”
- 与旧路径相关的日志要能一眼看出“这是 legacy path”

---

### 25.1 Commit 1 建议补充的日志

对应 commit：`feat: support launching app with workspace argument`

#### 启动参数读取日志
建议补：

- `app startup with workspace arg: <path>`
- `app startup without workspace arg`

目的：

- 明确当前实例是否进入了带参数启动分支
- 避免后面调试时分不清“无参数启动”和“带参数启动”

#### 启动期 workspace 初始化日志
建议补：

- `startup workspace initialization begin: <path>`
- `startup workspace initialization success: <path>`
- `startup workspace initialization failed: <path>, error: <reason>`

目的：

- 明确这是“启动期初始化”，而不是用户手动切换目录
- 方便后续和 `set_current_workspace` 触发的日志区分开

#### `WorkspaceContext` 创建与 timer 启动日志
建议确认已有日志足够表达：

- `workspace context created for startup path: <path>`
- `startup timers started for workspace: <path>`

目的：

- 让 Commit 1 的验收可以直接通过日志判断是否闭环成立

---

### 25.2 Commit 2 建议补充的日志

对应 commit：`feat: open main app directly when workspace is preloaded`

#### 前端启动判定日志
建议补：

- `frontend startup detected existing workspace: <path>`
- `frontend startup found no workspace, entering selector`

目的：

- 明确前端为何进入 `AppShell` 或 `WorkspaceSelector`
- 避免把“已有 workspace 直进主界面”和“自动恢复历史 workspace”混淆

#### 前端主流程日志
建议补：

- `entering AppShell from preloaded workspace`
- `entering WorkspaceSelector because no workspace is loaded`

目的：

- 帮助确认 Commit 2 的核心改动是否真的生效

#### 重复初始化防护日志
如果前端还存在旧初始化分支，建议补：

- `skipped frontend workspace initialization because workspace is already loaded`

目的：

- 明确看到前端没有再重复初始化同一路径

---

### 25.3 Commit 3 建议补充的日志

对应 commit：`feat: open workspace in a new process from new window action`

#### 菜单动作入口日志
建议补：

- `open-in-new-window requested from current instance`
- `selected workspace for new instance: <path>`

目的：

- 明确当前实例已进入 `Open in New Window...` 路径
- 确认目录选择结果正确

#### 新进程启动日志
建议补：

- `spawning new app instance with workspace: <path>`
- `spawn new app instance succeeded`
- `spawn new app instance failed: <reason>`

目的：

- 直接验证“当前实例是否真的在拉起新进程”
- 出错时可以立刻定位是“启动失败”而不是“初始化失败”

#### 当前实例保护日志
建议补：

- `current instance preserved existing workspace during open-in-new-window`
- `skipped in-process workspace switch for open-in-new-window`

目的：

- 明确当前实例没有偷偷切到新目录
- 防止旧主路径残留

#### 新实例启动链路日志
建议确认新实例里能看到：

- `new instance launched with workspace arg: <path>`
- `new instance entered workspace: <path>`

目的：

- 帮助确认新实例确实是通过参数驱动进入目标 workspace

---

### 25.4 Commit 4 建议补充的日志与注释

对应 commit：`chore: freeze legacy workspace window init path`

#### 旧路径冻结日志
如果旧路径仍暂时保留，建议补：

- `legacy set-initial-workspace path invoked`
- `legacy path is compatibility-only and no longer primary`

目的：

- 一旦旧路径仍被触发，可以快速看出来
- 帮助判断是否还有未清理依赖

#### 代码注释建议
建议在旧路径附近增加固定语义注释，例如：

- `legacy compatibility path`
- `no longer the primary flow`
- `do not add new behavior here`

目的：

- 防止后续开发者继续往旧路径上叠功能

#### 文档状态标记
建议在文档中持续保留类似描述：

- `Open in New Window...` is now process-based
- `Open...` handoff remains future work
- legacy event-driven path is frozen

目的：

- 保持文档、代码、测试叙事一致

---

### 25.5 日志使用纪律

为了避免日志变成噪音，建议执行时遵守以下纪律：

1. **日志必须带语义前缀**
   - 例如：`[startup]`、`[workspace-open-new-window]`、`[legacy-path]`

2. **日志必须能区分触发来源**
   - 启动参数触发
   - 用户命令触发
   - 旧兼容路径触发

3. **日志必须带关键上下文**
   - workspace path
   - 当前实例是否为新实例
   - 动作成功 / 失败

4. **阶段完成后可适度收缩日志**
   - 实现早期可多打
   - 路径稳定后保留关键路径日志，去掉冗余噪音

---

## 二十七、Commit 1 的建议修改点清单

对应 commit：`feat: support launching app with workspace argument`

本章节不写具体代码，而是给出更接近实际开工顺序的修改点清单，帮助实现时少走弯路。

### 27.1 建议先看的位置

#### `src-tauri/src/main.rs`
优先阅读：

- `main()` 入口
- `tauri::Builder::default()` 构建链
- `.setup(...)` 阶段
- `.manage(task_state)` 注册点

要先想清楚：

- CLI 参数打算在哪读
- 参数读取结果如何传到 workspace 初始化逻辑
- 初始化动作是在 `setup` 里完成，还是在更早阶段准备数据、再在 `setup` 落地

#### `src-tauri/src/commands/workspace.rs`
优先阅读：

- `set_current_workspace(...)`
- `initialize_workspace(...)`
- `persist_current_workspace(...)` 的调用链

要先拆清：

- 哪些逻辑是“命令入口专属行为”
- 哪些逻辑其实是“通用 workspace 初始化能力”

#### `src-tauri/src/task_commands.rs`
优先阅读：

- `TaskState`
- `WorkspaceContext::new(...)`
- `WorkspaceContext::start_timers()`

要先确认：

- 本次不改状态模型
- 只复用当前单实例单 workspace 的结构

---

### 27.2 建议先抽出的逻辑边界

在真正编码前，建议先在脑中把 `set_current_workspace(...)` 拆成两层：

#### 第一层：通用 workspace 初始化层
建议职责包含：

- 校验 path
- 必要时初始化 workspace 目录结构
- 创建 `WorkspaceContext`
- 启动 timers
- 写入 `TaskState`
- 持久化当前 workspace

这一层应能被：

- 启动期初始化
- 未来命令式切换（若仍保留）

共同复用。

#### 第二层：命令入口层
建议职责只保留：

- 接收前端参数
- 调用通用初始化层
- 做命令特有日志或错误转换

建议原则：

> 启动期初始化不要去硬模拟前端 invoke 命令调用，而是复用更底层的内部初始化逻辑。

---

### 27.3 建议的最小编码顺序

#### Step 1：先加参数读取骨架
在 `main.rs` 中先建立：

- 是否存在 `--workspace`
- 拿到的 path 值是什么

不要一上来就同时修改初始化逻辑。

#### Step 2：抽出可复用的 workspace 初始化 helper
在 `workspace.rs` 中先明确：

- 哪段逻辑应该被启动期复用
- 哪段逻辑仍留在命令入口里

完成标准：

- 启动期和命令期都能调用同一套核心逻辑

#### Step 3：把 startup path 接到 helper 上
让带 `--workspace` 的启动路径真正调用初始化 helper。

完成标准：

- 带参数启动时，workspace 已初始化
- `TaskState` 已持有 `WorkspaceContext`

#### Step 4：只验证后端闭环，不急着优化前端体验
这一阶段先看：

- `get_current_workspace` 是否正确
- workspace 资源是否创建
- timers 是否启动

前端直进主界面的体验留给 Commit 2 解决。

---

### 27.4 这次绝对不要顺手改的东西

#### 不要改 `Open in New Window...`
这属于 Commit 3。

#### 不要改 `Open...`
这属于 handoff 方案，不在当前阶段。

#### 不要改无参数启动语义
必须继续保持：

- 无参数启动进入 selector
- 不自动恢复历史 workspace

#### 不要让前端变成第二初始化源
Commit 1 的目标是先让 Rust 具备能力，不要顺手把前端也改成启动期补初始化。

---

### 27.5 建议先跑的验证顺序

Commit 1 编码完成后，建议按下面顺序验：

1. 无参数启动，确认仍进 selector
2. debug binary 带 `--workspace` 启动
3. release binary 带 `--workspace` 启动
4. 中文 / 空格路径启动
5. 检查 `get_current_workspace`
6. 检查 `.tweetpilot/tweetpilot.db`
7. 检查 timers 启动日志

---

## 二十八、Commit 2 的建议修改点清单

对应 commit：`feat: open main app directly when workspace is preloaded`

### 28.1 建议先看的位置

#### `src/App.tsx`
优先阅读：

- `AppContent()`
- `workspaceReady`
- `isCheckingWorkspace`
- 现有的 workspace 初始化 / 事件监听路径

要先搞清楚：

- 当前前端是在什么条件下显示 selector
- 当前前端是在什么条件下进入 `AppShell`
- 哪段逻辑仍然假设“workspace 只能靠前端选择得到”

#### `src/pages/WorkspaceSelector.tsx`
优先阅读：

- 组件挂载时的初始化逻辑
- 是否还存在与旧注入路径耦合的逻辑

#### `src/pages/WorkspaceSelector.test.tsx`
优先阅读：

- 当前测试覆盖了哪些 selector 行为
- 哪些测试会因“已有 workspace 直进主界面”语义变化而需要调整或新增

---

### 28.2 建议先明确的状态语义

前端启动阶段建议只认这两种状态：

#### 状态 A：当前实例已有 workspace
处理方式：

- 直接进入 `AppShell`
- 不再调用初始化命令
- 不再展示 selector

#### 状态 B：当前实例没有 workspace
处理方式：

- 进入 `WorkspaceSelector`
- 保持当前已有的用户选择入口

建议原则：

> 前端只判断“当前实例是否已有 workspace”，而不是根据历史记录猜测是否应该恢复 workspace。

---

### 28.3 建议的最小编码顺序

#### Step 1：先建立“启动时读取当前 workspace”的主判断
在 `App.tsx` 中先把“启动判定”立起来。

#### Step 2：把“有 workspace”与“无 workspace”的渲染路径分开
让主界面与 selector 的进入条件清楚，不混在一起。

#### Step 3：移除或绕开旧事件路径在主流程中的影响
如果旧 `set-initial-workspace` 路径仍存在，本 commit 不要求删除，但不能再让它成为主流程依赖。

#### Step 4：补最小测试
重点不是大而全，而是覆盖：

- 有 workspace -> 主界面
- 无 workspace -> selector
- 不重复初始化

---

### 28.4 这次绝对不要顺手改的东西

#### 不要让无参数启动自动恢复历史 workspace
这会直接破坏当前已确认的产品语义。

#### 不要重新引入前端补初始化
一旦 Commit 1 已经让 Rust 先初始化，Commit 2 只做消费结果，不做第二初始化源。

#### 不要改菜单命令
Commit 2 只处理前端启动判定，不碰 `Open in New Window...` 实现。

---

### 28.5 建议先跑的验证顺序

1. 带 `--workspace` 启动，确认直接进主界面
2. 无参数启动，确认仍进 selector
3. selector 手动选目录，确认不受影响
4. 观察日志，确认没有重复初始化
5. 观察旧事件路径，确认未重新成为主流程

---

## 二十九、Commit 3 的建议修改点清单

对应 commit：`feat: open workspace in a new process from new window action`

### 29.1 建议先看的位置

#### `src-tauri/src/commands/workspace.rs`
优先阅读：

- `open_folder_in_new_window(app)`
- `open_workspace_in_new_window(...)`
- 与目录选择器相关的逻辑

要先搞清楚：

- 当前“新窗口打开”到底在哪里创建 WebView
- 当前路径是如何把 workspace 注入新窗口的
- 哪些代码属于历史兼容路径，哪些还在主流程里

#### `src-tauri/src/main.rs`
确认：

- Commit 1 / 2 建立的新实例启动语义已经成立
- 带 `--workspace` 启动时能闭环进入 workspace

#### `src/App.tsx`
只确认一个事实：

- 新实例带参数启动后，前端已经能够直接进入主界面

这样 Commit 3 才能只改菜单动作，而不补前端初始化。

---

### 29.2 建议先明确的职责边界

#### 当前实例负责什么
- 弹目录选择器
- 获取目标 workspace path
- 启动新实例
- 处理“启动失败”的提示

#### 新实例负责什么
- 读取 `--workspace <path>`
- 初始化 workspace
- 进入目标 workspace 主界面

#### 当前实例绝对不负责什么
- 不切换自己的 workspace
- 不 reload 自己
- 不发 `set-initial-workspace`
- 不等待 handoff 再退出（那是 `Open...` 的事）

建议原则：

> `Open in New Window...` 的主路径必须是“当前实例 spawn 新实例”，不是“当前实例开一个共享后端的新 WebView”。

---

### 29.3 建议的最小编码顺序

#### Step 1：先替换新窗口动作的实现方式
把 `WebviewWindowBuilder::new(...)` 主路径换掉。

#### Step 2：接上稳定的新进程启动入口
确保：

- 参数独立传递
- 不手动拼接脆弱 shell 字符串
- dev / release 路径语义一致

#### Step 3：补失败处理
至少做到：

- 启动失败时当前实例不受影响
- 向用户提示错误

#### Step 4：做 A/B 双实例验证
这是 Commit 3 最关键的验收。

---

### 29.4 这次绝对不要顺手改的东西

#### 不要实现 `Open...` handoff
Commit 3 不做旧实例退出。

#### 不要保留“当前实例也切目录”的隐性逻辑
这会让新主路径失去意义。

#### 不要继续加强旧 `set-initial-workspace` 路径
Commit 3 的目标就是摆脱它。

---

### 29.5 建议先跑的验证顺序

1. 实例 A 进入 workspace A
2. 在 A 中执行 `Open in New Window...`
3. 选择 workspace B
4. 确认新实例进入 B
5. 确认旧实例仍在 A
6. 检查 A/B 的数据库和 timers 不互相覆盖
7. 检查失败时 A 不受影响

---

## 三十、Commit 4 的建议修改点清单

对应 commit：`chore: freeze legacy workspace window init path`

### 30.1 建议先看的位置

#### `src-tauri/src/commands/workspace.rs`
优先阅读：

- 所有仍然和 `set-initial-workspace`、同进程新窗口注入相关的路径

要先判断：

- 哪些路径现在还在被动兼容使用
- 哪些路径已经完全不是主流程，可以冻结甚至删除

#### `src/App.tsx`
优先确认：

- 主流程已经是“启动时读取已有 workspace”
- 旧事件路径不再影响主决策

#### `src/pages/WorkspaceSelector.tsx`
确认：

- selector 只在无 workspace 时出现
- 不再承担旧路径补位职责

#### 文档与测试
确认：

- 文档叙事是否仍和实现一致
- 测试是否已经默认新主路径成立

---

### 30.2 建议先明确的冻结原则

#### 冻结不等于立刻删光
本 commit 的第一目标是：

- 不让旧路径继续长新逻辑
- 让维护者一眼看出它已经降级

#### 必须明确的冻结规则
从这个阶段起：

- 旧 `set-initial-workspace` 路径只允许兼容或删除
- 不允许新增功能
- 不允许继续承担主流程职责

建议原则：

> Commit 4 的核心价值是“收口主路径”，不是“炫技式大清理”。

---

### 30.3 建议的最小编码顺序

#### Step 1：先在代码中标记 legacy path
通过注释、日志或局部整理，明确哪些路径已经不是主流程。

#### Step 2：移除旧路径对主流程的影响
不是马上删光，而是先确保：

- 主流程已经不再依赖它
- 即使它存在，也不会抢主流程

#### Step 3：补最小回归测试
重点确认：

- selector 仍正常
- 新主路径稳定
- 没有双初始化

#### Step 4：同步更新文档
确保文档和代码不会再次脱节。

---

### 30.4 这次绝对不要顺手改的东西

#### 不要在这个 commit 顺手实现 `Open...`
那是下一个阶段的事。

#### 不要为了“看起来干净”强删仍在兼容使用的代码
先冻结，再删除，顺序不能反。

#### 不要让文档落后于实现
这是本 commit 最容易被忽略、但后果很大的问题。

---

### 30.5 建议先跑的验证顺序

1. 无参数启动，确认仍进 selector
2. 带 `--workspace` 启动，确认仍直进主界面
3. `Open in New Window...`，确认仍走新进程
4. 观察旧事件路径日志，确认它不是主流程
5. 检查文档、代码、测试叙事一致

---

## 三十一、最终建议

最终建议一句话：

> **保留当前“单进程内只维护一个 WorkspaceContext”的后端模型不变，但把所有“打开工作目录”的动作统一重构为“新进程打开项目”。其中 `Open...` 负责新实例接管并退出旧实例，`Open in New Window...` 负责新增独立实例并保留旧实例。**
