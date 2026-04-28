# 工作区隔离与多窗口支持重构方案

## 文档信息
- **版本**: v1.0
- **创建时间**: 2026-04-24
- **合并来源**:
  - `docs/workspace-process-isolation-refactor.md`
  - `docs/workspace-timer-isolation-refactor.md`
- **目的**: 统一整理当前工作区隔离问题、定时器隔离方案、多窗口支持限制，以及后续重构方向
- **后续待办**:
  - 新窗口通过 `set-initial-workspace` 打开指定工作目录时，前端仍会先短暂显示首页，再进入工作区。这个问题与多窗口初始化链路以及定时任务的多窗口支持边界有关，暂不在本次修复范围内，后续单独讨论。

---

## 一、背景与结论

当前系统已经明确暴露出两个本质上相连的问题：

1. **工作区资源没有做到窗口级隔离**
2. **定时器系统没有做到工作区级隔离**

这两个问题本质上都来自同一个架构限制：

```text
一个进程 → 一个 TaskState → 一个 WorkspaceContext
```

由于 `WorkspaceContext` 同时持有数据库连接、任务执行器和定时器管理器，因此：
- 切换工作区会整体替换当前上下文
- 新窗口初始化工作区会覆盖旧窗口的上下文
- 定时器会跟着被替换或清理
- 多窗口无法同时拥有各自独立的工作区状态

**结论**：
- 这两个文档可以合并，因为讨论的是同一套架构问题在两个层面的表现。
- 合并后，应以“**WorkspaceContext 隔离重构**”为统一主题：把数据库、执行器、定时器都视为工作区上下文的一部分来设计。

---

## 二、当前架构

### 2.1 当前核心结构

`TaskState` 当前只维护一个全局工作区上下文：

```rust
pub struct TaskState {
    pub workspace_context: Arc<tokio::sync::Mutex<Option<WorkspaceContext>>>,
}
```

`WorkspaceContext` 包含：

```rust
pub struct WorkspaceContext {
    pub db: Arc<Mutex<TaskDatabase>>,           // 数据库连接
    pub executor: Arc<TaskExecutor>,            // 任务执行器
    pub timer_manager: UnifiedTimerManager,     // 定时器管理器
    pub workspace_path: String,                 // 工作目录路径
}
```

### 2.2 当前架构特征

- 整个应用进程只有一个 `TaskState`
- `TaskState` 里只有一个 `Option<WorkspaceContext>`
- 所有窗口共享同一个后端状态
- 定时器管理器与工作区生命周期强耦合

这意味着当前架构只天然支持：

- ✅ 单窗口单工作区
- ✅ 单窗口切换工作区
- ❌ 多窗口独立工作区
- ❌ 多窗口独立定时器系统

---

## 三、问题分析

### 3.1 定时器隔离问题

历史上 `UnifiedTimerManager` 以全局单例思路存在时，会出现以下问题：

1. 所有工作区共享同一个定时器实例
2. 切换工作区时，旧工作区的定时器会被清除
3. 定时器和数据库可能不再匹配
4. 多窗口下不同工作区的定时器互相干扰

如果定时器不是工作区上下文的一部分，就无法保证“哪个数据库对应哪个定时器系统”。

### 3.2 多窗口问题

当前 `Open in New Window...` 的实现仍然运行在同一个应用进程中。
新窗口初始化 workspace 时，本质上仍然调用 `set_current_workspace(path)`，而这会直接替换全局唯一的 `WorkspaceContext`。

因此会出现：

- 新窗口打开新目录后，旧窗口的 workspace 被覆盖
- 旧窗口关联的 timers 失效
- 旧窗口关联的数据库连接失效或语义错乱
- 两个窗口不能真正独立运行

### 3.3 根因归纳

根因不是“定时器单独有问题”，也不是“多窗口单独有问题”，而是：

> 当前系统没有建立“窗口 / 工作区 / 定时器 / 数据库”的明确归属关系。

当前关系是：

```text
应用进程
  └─ TaskState
      └─ Option<WorkspaceContext>
```

理想关系至少应是：

### 单窗口安全模型

```text
应用进程
  └─ TaskState
      └─ 当前 WorkspaceContext
          ├─ db
          ├─ executor
          └─ timer_manager
```

### 多窗口目标模型

```text
应用进程
  └─ TaskState
      └─ HashMap<WindowLabel, WorkspaceContext>
          ├─ window-a -> ctx-a
          ├─ window-b -> ctx-b
          └─ ...
```

---

## 四、设计目标

### 4.1 近期目标：先实现工作区级资源隔离

近期最现实的目标是先保证：

1. **一个工作区 = 一个 `WorkspaceContext`**
2. **一个 `WorkspaceContext` = 一套独立的数据库 / 执行器 / 定时器**
3. **切换工作区时，旧 context 完整释放，新 context 完整创建**
4. **定时任务只从对应工作区数据库加载并执行**

这能彻底解决单窗口切换工作区时的状态一致性问题。

### 4.2 长期目标：支持多窗口独立工作区

长期目标是在同一进程内支持：

1. 每个窗口持有独立的 `WorkspaceContext`
2. 每个窗口的 timers、db、AI 会话互不影响
3. 窗口关闭时自动清理对应资源
4. Dock 上仍只有一个应用图标，行为类似 VS Code

---

## 五、统一重构方案

### 5.1 核心思路

把 `WorkspaceContext` 作为工作区所有运行时资源的唯一容器。

```rust
pub struct WorkspaceContext {
    pub db: TaskDatabase,
    pub executor: Arc<TaskExecutor>,
    pub timer_manager: UnifiedTimerManager,
    pub workspace_path: String,
}
```

由它统一负责：
- 创建工作区数据库
- 创建任务执行器
- 创建并启动定时器系统
- 从工作区数据库加载定时任务
- 在释放时停止并清理所有关联资源

### 5.2 WorkspaceContext 初始化

建议提供统一构造入口：

```rust
impl WorkspaceContext {
    pub fn new(workspace_path: String) -> Result<Self, String> {
        let db_path = std::path::Path::new(&workspace_path)
            .join(".tweetpilot/tweetpilot.db");

        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let db = TaskDatabase::new(db_path).map_err(|e| e.to_string())?;
        let executor = Arc::new(TaskExecutor::new());
        let timer_manager = UnifiedTimerManager::new();

        Ok(Self {
            db,
            executor,
            timer_manager,
            workspace_path,
        })
    }
}
```

### 5.3 WorkspaceContext 启动定时器

建议由 `WorkspaceContext::start_timers()` 统一处理：

1. 启动 timer manager 事件循环
2. 注册系统级 executor（如 `localbridge_sync`）
3. 注册系统级 timer
4. 注册任务执行 executor（如 `python_script`）
5. 从当前工作区数据库加载所有启用的 scheduled task
6. 为每个任务构建 timer 并注册

伪代码：

```rust
pub async fn start_timers(&self) -> Result<(), String> {
    self.timer_manager.start().await;

    self.timer_manager.register_executor(
        "localbridge_sync".to_string(),
        Arc::new(LocalBridgeSyncExecutor::new(/* db reference */)),
    ).await;

    self.timer_manager.register_executor(
        "python_script".to_string(),
        Arc::new(PythonScriptExecutor::new(
            self.workspace_path.clone(),
            /* db reference */,
        )),
    ).await;

    let tasks = self.db.get_all_tasks().map_err(|e| e.to_string())?;
    for task in tasks {
        if !task.enabled || task.task_type != "scheduled" {
            continue;
        }

        if let Some(timer) = Self::build_task_timer(&task)? {
            self.timer_manager.register_timer(timer).await?;
        }
    }

    Ok(())
}
```

### 5.4 TaskState 简化为上下文容器

#### 近期版本：单 context 模式

```rust
pub struct TaskState {
    pub workspace_context: Arc<Mutex<Option<WorkspaceContext>>>,
}
```

并提供统一访问方法：

```rust
impl TaskState {
    pub fn new() -> Self {
        Self {
            workspace_context: Arc::new(Mutex::new(None)),
        }
    }

    pub fn get_context(&self) -> Result<std::sync::MutexGuard<'_, Option<WorkspaceContext>>, String> {
        self.workspace_context.lock().map_err(|e| e.to_string())
    }
}
```

#### 长期版本：多窗口 HashMap 模式

```rust
pub struct TaskState {
    pub workspaces: Arc<tokio::sync::Mutex<HashMap<String, WorkspaceContext>>>,
}
```

其中 key 为窗口 label。

### 5.5 重构 `set_current_workspace`

在单窗口模式下，推荐流程：

1. 校验路径
2. 若工作区未初始化，则先执行初始化
3. 取出并释放旧 `WorkspaceContext`
4. 创建新 `WorkspaceContext`
5. 启动新 context 的 timers
6. 保存新 context
7. 持久化当前工作区配置

伪代码：

```rust
#[tauri::command]
pub async fn set_current_workspace(
    path: String,
    task_state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("工作目录不能为空".to_string());
    }

    let workspace_path = Path::new(&path);
    let marker_file = workspace_path.join(".tweetpilot.json");

    if !marker_file.exists() {
        initialize_workspace(path.clone()).await?;
    }

    {
        let mut workspace_ctx = task_state.get_context()?;
        if let Some(old_ctx) = workspace_ctx.take() {
            drop(old_ctx);
        }
    }

    let new_ctx = crate::task_commands::WorkspaceContext::new(path.clone())?;
    new_ctx.start_timers().await?;

    {
        let mut workspace_ctx = task_state.get_context()?;
        *workspace_ctx = Some(new_ctx);
    }

    persist_current_workspace(path)
}
```

### 5.6 更新所有依赖上下文的 Tauri 命令

所有依赖数据库、执行器或定时器的命令都应从 `WorkspaceContext` 读取，而不是直接从全局状态读取分散资源。

示例：

```rust
#[tauri::command]
pub async fn execute_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<ExecutionResult, String> {
    let workspace_ctx = state.get_context()?;
    let ctx = workspace_ctx.as_ref().ok_or("No workspace selected")?;

    let task = ctx.db.get_task(&task_id).map_err(|e| e.to_string())?;

    if task.status == "running" {
        return Err("Task is already running".to_string());
    }

    ctx.db.update_task_status(&task_id, "running").map_err(|e| e.to_string())?;

    let result = ctx.executor.execute_task(&task, &ctx.workspace_path).await;

    match result {
        Ok(exec_result) => {
            ctx.db.save_execution(&exec_result).map_err(|e| e.to_string())?;
            ctx.db.update_task_status(&task_id, "idle").map_err(|e| e.to_string())?;
            Ok(exec_result)
        }
        Err(e) => {
            ctx.db.update_task_status(&task_id, "failed").map_err(|e2| e2.to_string())?;
            Err(e)
        }
    }
}
```

---

## 六、多窗口支持的重构方向

### 6.1 目标结构

若未来要支持“一个应用多个窗口，每个窗口独立工作区”，则应改为：

```text
一个进程
  → 一个 TaskState
    → HashMap<WindowLabel, WorkspaceContext>
```

### 6.2 必要改动

1. `TaskState` 从单个 `Option<WorkspaceContext>` 改为 `HashMap<String, WorkspaceContext>`
2. 所有 Tauri command 需要知道当前窗口 label
3. 所有 `get_context()` 调用改为 `get_context(window_label)`
4. `open_folder_in_new_window()` 需要为新窗口创建独立 context，而不是覆盖全局 context
5. 窗口关闭时，自动移除并清理对应的 `WorkspaceContext`

### 6.3 预估工作量

粗略估计：

- 修改 `TaskState` 结构：1-2 小时
- 修改所有 Tauri command（约 30+ 个）：4-6 小时
- 实现窗口生命周期管理：2-3 小时
- 测试和调试：3-4 小时
- **总计**：10-15 小时

### 6.4 风险

- 涉及核心状态管理
- 命令面广，漏改概率高
- 窗口关闭与异步资源清理需要严谨处理
- timer manager 生命周期处理不当可能导致悬挂任务或泄漏

---

## 七、菜单行为与产品建议

### 7.1 `Open...`

当前单窗口切换 workspace 的主流程是成立的：

- 旧 workspace 被正确清理
- 新 workspace 被正确初始化
- 前端 reload 后能恢复到新工作区

这是当前最稳妥、最符合现状架构的使用方式。

### 7.2 `Open in New Window...`

当前实现有根本限制：

- 新窗口仍在同进程中
- 新窗口初始化 workspace 会覆盖旧窗口的全局 context
- 因而不能真正提供“新窗口独立打开另一个工作区”的能力

### 7.3 产品层建议

#### 短期建议

优先选择以下之一：

**选项 1：禁用 `Open in New Window...` 菜单**
- 最清晰
- 最少误导
- 最符合当前真实能力

**选项 2：保留但明确标注限制**
- 技术上可行
- 但用户体验容易困惑
- 不推荐作为长期方案

#### 长期建议

如果用户对多窗口独立 workspace 有强需求，再推进 `HashMap<WindowLabel, WorkspaceContext>` 架构升级。

---

## 八、`Open...` 菜单的体验优化建议

即使不做多窗口重构，当前 `Open...` 的前端体验仍可继续优化。

### 8.1 当前问题

当前流程是：
1. 后端先完成 workspace 切换和初始化
2. 前端收到事件后 reload
3. reload 后直接进入主界面

问题在于：
- 用户没有看到明显加载反馈
- 与手动选择工作目录时的加载体验不一致

### 8.2 建议优化

在 reload 后恢复 `pending-workspace-path` 时：

- 不要立即将 `workspaceReady = true`
- 先显示“正在打开工作目录...”的加载状态
- 再进行一次轻量校验或短暂延迟
- 然后再进入主界面

示意：

```typescript
useEffect(() => {
    const pendingPath = sessionStorage.getItem('pending-workspace-path')

    if (pendingPath) {
        sessionStorage.removeItem('pending-workspace-path')
        setCurrentWorkspace(pendingPath)
        setIsInitializingWorkspace(true)

        verifyWorkspaceReady(pendingPath).then(() => {
            setWorkspaceReady(true)
            setIsInitializingWorkspace(false)
        })

        setIsCheckingWorkspace(false)
        return
    }

    setIsCheckingWorkspace(false)
}, [])
```

### 8.3 验证方式

可选方案：

1. 调用一个专门的后端验证命令
2. 复用现有需要 context 的命令进行探测
3. 使用一个很短的最小加载延迟（如 300-500ms）

这里的重点不是“真正等待初始化”，因为后端在 reload 前通常已经初始化完成；重点是给用户明确的视觉反馈。

---

## 九、需要更新的命令范围

在单窗口隔离重构阶段，以下命令至少需要统一切换到 `WorkspaceContext` 访问模式：

1. `execute_task`
2. `get_tasks`
3. `get_task_detail`
4. `create_task`
5. `update_task`
6. `delete_task`
7. `pause_task`
8. `resume_task`
9. `get_execution_history`
10. `get_timer_system_status`

如果后续进入多窗口模式，则这些命令还需要进一步接入窗口 label。

---

## 十、实施步骤

### Phase 1：统一 WorkspaceContext 定义
- 明确 `WorkspaceContext` 持有 db / executor / timer_manager / workspace_path
- 调整构造逻辑，确保数据库路径与工作区绑定

### Phase 2：把定时器彻底纳入 WorkspaceContext 生命周期
- 在 `start_timers()` 中统一注册 executor 与 timer
- 从对应 workspace 的数据库加载 scheduled tasks
- 确保旧 context 释放时不再残留旧定时器

### Phase 3：重构 `TaskState`
- 近期：保留单 context 模式，确保状态一致
- 长期：升级为 `HashMap<WindowLabel, WorkspaceContext>`

### Phase 4：重构 `set_current_workspace`
- 切换时完整释放旧 context
- 初始化并启动新 context
- 保证持久化配置与实际上下文一致

### Phase 5：更新所有 Tauri command
- 所有命令统一从 `WorkspaceContext` 读取资源
- 统一处理 `No workspace selected` 错误

### Phase 6：优化菜单与前端体验
- 优化 `Open...` 的加载反馈
- 短期禁用 `Open in New Window...` 或明确限制

### Phase 7：测试
- 单工作区切换测试
- 定时器隔离测试
- 多次切换资源释放测试
- 若进入多窗口阶段，再增加窗口级隔离测试

---

## 十一、测试计划

### 11.1 单工作区切换测试

1. 选择工作区 A
2. 创建并启动定时任务
3. 验证定时器正常运行
4. 切换到工作区 B
5. 验证 A 的定时器已停止
6. 验证 B 的定时器正常运行
7. 验证 A/B 数据库互不混用

### 11.2 多次切换稳定性测试

1. 连续切换多个工作区
2. 检查 timers 是否重复注册
3. 检查数据库连接是否残留
4. 观察是否存在内存增长异常

### 11.3 多窗口测试（未来）

1. 打开两个窗口
2. 每个窗口绑定不同工作区
3. 验证各自 timers 独立运行
4. 关闭一个窗口
5. 验证只清理对应窗口的 context

---

## 十二、风险与注意事项

### 12.1 风险分级

**低风险**：
- 创建 / 收敛 `WorkspaceContext`
- 调整 `TaskState` 单 context 访问方式

**中风险**：
- 重构 `set_current_workspace`
- 批量修改 Tauri commands

**高风险**：
- `UnifiedTimerManager` 生命周期管理
- 多窗口 HashMap 化重构
- 异步清理与资源释放

### 12.2 注意事项

1. **LocalBridgeSyncExecutor 的数据库引用方式需要调整**
   - 如果当前依赖旧的全局 db 引用，需要改为接入 `WorkspaceContext` 的 db

2. **PythonScriptExecutor 的数据库引用方式也需要同步调整**
   - 避免继续依赖旧的全局状态

3. **异步 Drop 问题要谨慎处理**
   - Rust 的 `Drop` 是同步的
   - 若 timer 停止依赖异步逻辑，需要设计显式 shutdown 流程

4. **所有命令都要处理无 workspace 的情况**
   - 应统一返回可读错误，例如 `No workspace selected`

---

## 十三、推荐结论

### 当前建议

1. **先完成单工作区的 `WorkspaceContext` 彻底隔离**
   - 把数据库、执行器、定时器统一收敛进 `WorkspaceContext`
   - 确保切换工作区时完整替换、完整清理

2. **短期内禁用 `Open in New Window...`**
   - 因为当前架构下该功能具有误导性

3. **优化 `Open...` 的加载体验**
   - 让单窗口切换工作区的体验更完整

### 未来建议

如果后续明确要支持 VS Code 风格的多窗口独立工作区，再实施：

```text
TaskState: HashMap<WindowLabel, WorkspaceContext>
```

这是正确方向，但应作为独立的大型重构任务推进，而不是在现有单 context 模型上继续打补丁。

---

## 十四、相关文件

### 核心后端文件
- `src-tauri/src/task_commands.rs`
- `src-tauri/src/commands/workspace.rs`
- `src-tauri/src/unified_timer/mod.rs`
- `src-tauri/src/main.rs`

### 核心前端文件
- `src/App.tsx`
- `src/pages/WorkspaceSelector.tsx`

---

## 十五、最终总结

原来的两个文档一个偏“定时器隔离方案”，一个偏“多工作目录 / 多窗口问题分析”，但两者讨论的是同一件事：

> **如何把运行时资源正确绑定到工作区，并进一步为多窗口独立运行打基础。**

因此合并是合理且推荐的。

合并后的统一认识应为：

- **短期**：先解决工作区级资源隔离，重点是 `WorkspaceContext` 生命周期和 timer/db 一致性
- **中期**：优化单窗口切换体验
- **长期**：如果要支持多窗口独立 workspace，再把 `TaskState` 升级为 `HashMap<WindowLabel, WorkspaceContext>`
