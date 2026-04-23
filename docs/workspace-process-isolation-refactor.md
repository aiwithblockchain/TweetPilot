# 多工作目录支持问题分析

## 文档信息
- **创建时间**: 2026-04-23
- **状态**: 问题分析和讨论记录
- **目的**: 记录当前架构的限制和未来改进方向

---

## 一、当前架构

### 1.1 核心数据结构

**TaskState** (`src-tauri/src/task_commands.rs`):
```rust
pub struct TaskState {
    pub workspace_context: Arc<tokio::sync::Mutex<Option<WorkspaceContext>>>,
}
```

**关键特征**：
- 全局单例，整个应用进程只有一个 `TaskState`
- 只能持有一个 `Option<WorkspaceContext>`
- 所有窗口共享这个唯一的 workspace context

### 1.2 WorkspaceContext 包含的资源

```rust
pub struct WorkspaceContext {
    pub db: Arc<Mutex<TaskDatabase>>,           // 数据库连接
    pub executor: Arc<TaskExecutor>,            // 任务执行器
    pub timer_manager: UnifiedTimerManager,     // 定时器管理器
    pub workspace_path: String,                 // 工作目录路径
}
```

每个 WorkspaceContext 包含：
- 独立的数据库连接（`.tweetpilot/tweetpilot.db`）
- 独立的定时器系统（LocalBridge 同步、Python 脚本执行等）
- 独立的任务执行器

---

## 二、当前菜单功能

### 2.1 Open... 菜单

**行为**：
1. 用户选择新的工作目录
2. 后端调用 `set_current_workspace(path)` 切换 workspace
3. 停止旧的 timers，创建新的 WorkspaceContext，启动新的 timers
4. 发出 `workspace-changed` 事件
5. 前端收到事件后：
   - 将路径存入 `sessionStorage.setItem('pending-workspace-path', path)`
   - 执行 `window.location.reload()`
6. Reload 后：
   - 从 sessionStorage 恢复路径
   - 删除 sessionStorage
   - 进入新工作目录的主界面

**特点**：
- ✅ 单窗口切换工作目录，完全正常
- ✅ 旧 workspace 的资源被正确清理
- ✅ 新 workspace 的资源被正确初始化

### 2.2 Open in New Window... 菜单

**当前实现** (`src-tauri/src/commands/workspace.rs`):
```rust
pub async fn open_folder_in_new_window(app: AppHandle) -> Result<(), String> {
    // 1. 用户选择目录
    let path = app.dialog().file().blocking_pick_folder();
    
    // 2. 创建新窗口（同进程）
    let window = WebviewWindowBuilder::new(&app, ...).build()?;
    
    // 3. 等待窗口就绪
    tokio::time::sleep(Duration::from_millis(200)).await;
    
    // 4. 发送事件让新窗口初始化 workspace
    window.emit("set-initial-workspace", path_str)?;
}
```

**问题**：
- ❌ 新窗口通过 `set-initial-workspace` 事件调用 `set_current_workspace(path)`
- ❌ 这会**替换**全局唯一的 `WorkspaceContext`
- ❌ 旧窗口的 workspace context 被覆盖，timers 失效，数据库连接失效
- ❌ 两个窗口无法同时拥有各自独立的 workspace

---

## 三、核心问题

### 3.1 架构限制

**根本原因**：
```
一个进程 → 一个 TaskState → 一个 Option<WorkspaceContext>
```

这意味着：
- 同一个进程中，无论开多少个窗口，后端只能持有一个 workspace context
- 新窗口初始化 workspace 时，会覆盖旧窗口的 workspace
- 无法实现"多个窗口，每个窗口独立的工作目录"

### 3.2 用户期望

用户希望像 VS Code 那样：
- Dock 上只有一个图标（同一个应用进程）
- 可以打开多个窗口，每个窗口有独立的工作目录
- 每个窗口的 timers、数据库、AI 会话互不影响
- 右键 Dock 图标可以看到所有打开的工作目录

### 3.3 当前架构无法满足

要实现上述效果，需要：
```
一个进程 → 一个 TaskState → HashMap<WindowLabel, WorkspaceContext>
```

但这需要大规模重构：
1. 修改 `TaskState` 结构
2. 修改所有调用 `get_context()` 的地方，传入窗口 label
3. 修改所有 Tauri command，从 window 获取 label
4. 确保窗口关闭时清理对应的 WorkspaceContext

---

## 四、讨论过的方案

### 4.1 方案 A：多进程隔离（已放弃）

**思路**：
- `Open in New Window...` 启动新的 OS 进程
- 通过 CLI 参数传递工作目录：`--workspace-path <path>`
- 每个进程有独立的 TaskState 和 WorkspaceContext

**优点**：
- 完全隔离，进程崩溃不影响其他进程
- 不需要修改现有架构

**缺点**：
- ❌ Dock 上会显示多个图标（用户不接受）
- ❌ 不符合 IDE 的使用习惯
- ❌ 无法右键 Dock 图标查看所有工作目录

**结论**：不符合用户需求，已放弃。

### 4.2 方案 B：同进程多 Context（未实现）

**思路**：
- 修改 `TaskState` 为 `HashMap<String, WorkspaceContext>`
- 每个窗口通过 label 获取自己的 workspace context
- 窗口关闭时清理对应的 context

**优点**：
- ✅ Dock 上只有一个图标
- ✅ 符合 IDE 使用习惯
- ✅ 可以实现多窗口独立 workspace

**缺点**：
- ❌ 需要大规模重构
- ❌ 所有 Tauri command 都需要修改
- ❌ 需要处理窗口生命周期管理
- ❌ 工作量大，风险高

**结论**：技术可行，但工作量大，暂未实施。

---

## 五、当前状态和建议

### 5.1 当前功能状态

**正常工作**：
- ✅ `Open...` 菜单：单窗口切换工作目录，完全正常
- ✅ 工作目录选择器：手动选择工作目录，完全正常
- ✅ 单个工作目录的所有功能：timers、数据库、任务执行等

**有问题**：
- ❌ `Open in New Window...` 菜单：新窗口会覆盖旧窗口的 workspace

### 5.2 短期建议

**选项 1：禁用 `Open in New Window...` 菜单**
- 在菜单中移除或禁用该选项
- 只保留 `Open...` 菜单用于切换工作目录
- 用户体验：单窗口切换工作目录

**选项 2：保持现状，文档说明**
- 保留菜单，但在文档中说明限制
- 告知用户：新窗口会影响旧窗口的 workspace
- 用户体验：可能造成困惑

### 5.3 长期改进方向

如果未来需要支持多窗口独立 workspace，需要：

1. **架构重构**：
   - 修改 `TaskState` 为 `HashMap<String, WorkspaceContext>`
   - 所有 Tauri command 增加窗口 label 参数
   - 实现窗口生命周期管理

2. **预估工作量**：
   - 修改 `TaskState` 结构：1-2 小时
   - 修改所有 Tauri command（约 30+ 个）：4-6 小时
   - 实现窗口管理逻辑：2-3 小时
   - 测试和调试：3-4 小时
   - **总计**：10-15 小时

3. **风险评估**：
   - 中等风险：涉及核心架构修改
   - 需要全面测试所有功能
   - 可能引入新的 bug

---

## 六、Open... 菜单的改进建议

### 6.1 当前问题

用户点击 `Open...` 菜单后：
1. 后端切换 workspace（已完成初始化）
2. 前端 reload
3. Reload 后从 sessionStorage 恢复路径
4. **立即进入主界面**（没有加载提示）

**用户体验问题**：
- 没有视觉反馈，用户不知道系统在做什么
- 与"手动选择工作目录"的体验不一致（手动选择有加载状态）

### 6.2 改进方案

**目标**：
- Reload 后显示加载界面
- 等待/验证后端初始化完成
- 提供视觉反馈
- 与手动选择工作目录的体验保持一致

**当前流程详解**：

1. **用户点击 `Open...` 菜单**
   - 触发 `open_folder_dialog()` 函数
   - 用户在系统对话框中选择目录

2. **后端处理** ([workspace.rs:679-703](src-tauri/src/commands/workspace.rs#L679-L703))
   ```rust
   pub async fn open_folder_dialog(app: AppHandle) -> Result<(), String> {
       let path = app.dialog().file().blocking_pick_folder();
       
       if let Some(folder_path) = path {
           let path_str = folder_path.to_string();
           let task_state = app.state::<TaskState>();
           
           // 切换 workspace（停止旧 timers，创建新 WorkspaceContext，启动新 timers）
           set_current_workspace(path_str.clone(), task_state).await?;
           
           // 发出事件通知前端
           app.emit("workspace-changed", path_str)?;
       }
   }
   ```

3. **前端监听事件** ([App.tsx:241-247](src/App.tsx#L241-L247))
   ```typescript
   const unlistenWorkspaceChanged = await listen<string>('workspace-changed', (event) => {
       console.log('[App] Workspace changed via menu:', event.payload)
       // 存入 sessionStorage 以便 reload 后恢复
       sessionStorage.setItem('pending-workspace-path', event.payload)
       setCurrentWorkspace(event.payload)
       setWorkspaceReady(true)
       // 执行 reload
       setTimeout(() => window.location.reload(), 100)
   })
   ```

4. **Reload 后恢复** ([App.tsx:221-230](src/App.tsx#L221-L230))
   ```typescript
   useEffect(() => {
       const pendingPath = sessionStorage.getItem('pending-workspace-path')
       
       if (pendingPath) {
           console.log('[App] Restoring pending workspace after reload:', pendingPath)
           sessionStorage.removeItem('pending-workspace-path')
           // 问题：这里立即设置为 ready，没有任何加载提示
           setCurrentWorkspace(pendingPath)
           setWorkspaceReady(true)
           setIsCheckingWorkspace(false)
           return
       }
       
       // 正常启动流程
       console.log('[App] Starting app, will show workspace selector')
       setIsCheckingWorkspace(false)
   }, [])
   ```

**问题分析**：

当前在 reload 后恢复 workspace 时：
- ✅ 后端已经完成了 workspace 初始化（在 reload 前就做了）
- ✅ WorkspaceContext 已创建，timers 已启动
- ❌ 前端直接进入主界面，没有任何过渡
- ❌ 用户看不到"正在打开工作目录"的提示
- ❌ 与手动选择工作目录的体验不一致（手动选择有 `isInitializingWorkspace` 状态）

**改进实现思路**：

1. **修改 sessionStorage 恢复逻辑** ([App.tsx:221-230](src/App.tsx#L221-L230))
   ```typescript
   useEffect(() => {
       const pendingPath = sessionStorage.getItem('pending-workspace-path')
       
       if (pendingPath) {
           console.log('[App] Restoring pending workspace after reload:', pendingPath)
           sessionStorage.remove('pending-workspace-path')
           
           // 不要立即设置 workspaceReady = true
           // 而是显示加载状态，模拟手动选择的体验
           setCurrentWorkspace(pendingPath)
           setIsInitializingWorkspace(true)  // 显示加载状态
           
           // 验证后端 workspace 是否真的准备好了
           verifyWorkspaceReady(pendingPath).then(() => {
               setWorkspaceReady(true)
               setIsInitializingWorkspace(false)
           })
           
           setIsCheckingWorkspace(false)
           return
       }
       
       // 正常启动流程
       setIsCheckingWorkspace(false)
   }, [])
   ```

2. **添加验证函数**
   ```typescript
   const verifyWorkspaceReady = async (path: string) => {
       // 选项 A：调用后端验证 workspace 状态
       // 可能需要新增 Tauri command: verify_workspace_ready()
       const { invoke } = await import('@tauri-apps/api/core')
       await invoke('verify_workspace_ready', { path })
       
       // 选项 B：复用现有命令验证
       // 尝试调用需要 workspace context 的命令，如果成功说明已就绪
       await invoke('get_timer_system_status')
       
       // 选项 C：简单延迟（不推荐，但最简单）
       await new Promise(resolve => setTimeout(resolve, 500))
   }
   ```

3. **UI 体验改进**
   - 在 `isInitializingWorkspace = true` 时，WorkspaceSelector 会显示加载状态
   - 显示"正在打开工作目录..."提示
   - 与手动选择工作目录的体验完全一致

**需要修改的文件**：
- [src/App.tsx](src/App.tsx) - 修改 sessionStorage 恢复逻辑，添加加载状态
- [src-tauri/src/commands/workspace.rs](src-tauri/src/commands/workspace.rs) - 可能需要新增 `verify_workspace_ready` 命令（可选）

**实现优先级**：
- 🔴 高优先级：添加加载状态，改善用户体验
- 🟡 中优先级：添加后端验证命令（可选，因为后端已经初始化完成）
- 🟢 低优先级：优化加载时长（当前可能只需要很短的延迟）

**注意事项**：
1. 后端在 reload 前已经完成初始化，所以验证应该很快完成
2. 主要目的是提供视觉反馈，而不是真正等待初始化
3. 可以考虑最小延迟（如 300-500ms）来确保用户看到加载提示
4. 要确保 reload 后的体验与手动选择工作目录的体验一致

---

## 七、总结

### 7.1 核心限制

当前架构的核心限制是：
```
一个进程只能持有一个 WorkspaceContext
```

这导致：
- ✅ 单窗口切换工作目录：完全正常
- ❌ 多窗口独立工作目录：无法实现

### 7.2 可行的改进

**短期**（低成本）：
1. 改进 `Open...` 菜单的用户体验（添加加载状态）
2. 禁用或移除 `Open in New Window...` 菜单

**长期**（高成本）：
1. 重构 `TaskState` 为 `HashMap<String, WorkspaceContext>`
2. 修改所有 Tauri command 支持窗口 label
3. 实现完整的多窗口独立 workspace 支持

### 7.3 建议

**当前阶段**：
- 优先改进 `Open...` 菜单的用户体验
- 暂时禁用 `Open in New Window...` 菜单
- 保持单窗口切换工作目录的简单模式

**未来规划**：
- 如果用户强烈需要多窗口功能，再考虑架构重构
- 重构前需要充分评估工作量和风险
- 可以分阶段实施，逐步迁移

---

## 八、相关代码位置

### 8.1 核心文件

- `src-tauri/src/task_commands.rs` - TaskState 和 WorkspaceContext 定义
- `src-tauri/src/commands/workspace.rs` - workspace 相关命令
- `src/App.tsx` - 前端启动和 workspace 初始化逻辑
- `src/pages/WorkspaceSelector.tsx` - 工作目录选择器

### 8.2 关键函数

- `set_current_workspace()` - 切换 workspace（替换全局 context）
- `open_folder_dialog()` - Open... 菜单处理
- `open_folder_in_new_window()` - Open in New Window... 菜单处理
- `WorkspaceContext::new()` - 创建 workspace context
- `WorkspaceContext::start_timers()` - 启动定时器

---

## 九、参考资料

### 9.1 类似产品的实现

**VS Code**：
- 使用 Electron 多窗口
- 每个窗口有独立的 workspace
- 通过 IPC 通信协调多个窗口
- Dock 上只显示一个图标

**JetBrains IDEs**：
- 每个项目窗口是独立的进程
- Dock 上显示多个图标（但可以合并）
- 每个窗口完全独立

### 9.2 技术选型考虑

**Tauri 的限制**：
- Tauri 的多窗口是同进程的
- 所有窗口共享同一个 Rust 后端状态
- 要实现独立 workspace，必须在应用层管理多个 context

**可能的技术方案**：
1. 修改 TaskState 为 HashMap（本文档讨论的方案）
2. 使用 Tauri 的多实例模式（需要研究可行性）
3. 使用进程间通信（IPC）协调多个进程（复杂度高）
