# Python 脚本执行系统重构方案

## 一、问题分析

### 当前系统的问题

1. **硬编码的任务类型**：只支持 3 种预定义的 Twitter 操作（发帖、回复、点赞）
2. **UI 过度设计**：显示大量不必要的账号统计信息
3. **缺少脚本选择**：没有文件选择器来选择 Python 脚本
4. **无真正执行能力**：只能调用 LocalBridge API，不能执行 Python 脚本

### 目标

将任务系统改造为**通用的 Python 脚本执行和监控平台**：
- 支持选择任意 Python 脚本文件
- 实时监控脚本执行状态（开始、进行中、完成）
- 捕获脚本输出（stdout/stderr）
- 记录执行结果和错误信息
- 简化 UI，聚焦核心功能

---

## 二、技术架构设计

### 2.1 后端架构（Rust/Tauri）

#### 核心模块

```
src-tauri/src/
├── commands/
│   ├── task.rs              # 任务管理命令（重构）
│   └── script_executor.rs   # 新增：Python 脚本执行器
├── services/
│   ├── python_runner.rs     # 新增：Python 进程管理
│   └── output_stream.rs     # 新增：输出流捕获
```

#### 关键技术点

1. **进程执行**：使用 `tokio::process::Command` 异步执行 Python 脚本
2. **输出捕获**：实时捕获 stdout/stderr 流
3. **状态管理**：维护脚本执行状态（pending → running → completed/failed）
4. **超时控制**：支持脚本执行超时自动终止

### 2.2 前端架构（React/TypeScript）

#### 核心组件

```
src/
├── components/
│   ├── TaskCreatePane.tsx        # 重构：简化 UI
│   ├── ScriptSelector.tsx        # 新增：脚本文件选择器
│   ├── ScriptExecutionMonitor.tsx # 新增：执行监控面板
│   └── TaskDetailContentPane.tsx # 重构：显示脚本输出
├── services/
│   └── task/
│       ├── types.ts              # 重构：类型定义
│       └── tauri.ts              # 重构：API 调用
```

---

## 三、详细实现方案

### 3.1 后端实现

#### Step 1: 创建 Python 执行器服务

**文件**: `src-tauri/src/services/python_runner.rs`

```rust
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader};
use std::process::Stdio;

pub struct PythonRunner {
    python_path: String,
}

pub struct ExecutionOutput {
    pub stdout: Vec<String>,
    pub stderr: Vec<String>,
    pub exit_code: Option<i32>,
}

impl PythonRunner {
    pub fn new(python_path: Option<String>) -> Self {
        Self {
            python_path: python_path.unwrap_or_else(|| "python3".to_string()),
        }
    }

    pub async fn execute(
        &self,
        script_path: &str,
        args: Vec<String>,
        env_vars: Option<HashMap<String, String>>,
    ) -> Result<ExecutionOutput, String> {
        let mut cmd = Command::new(&self.python_path);
        cmd.arg(script_path)
           .args(&args)
           .stdout(Stdio::piped())
           .stderr(Stdio::piped());

        if let Some(env) = env_vars {
            for (key, value) in env {
                cmd.env(key, value);
            }
        }

        let mut child = cmd.spawn()
            .map_err(|e| format!("启动 Python 进程失败: {}", e))?;

        let stdout = child.stdout.take()
            .ok_or("无法捕获 stdout")?;
        let stderr = child.stderr.take()
            .ok_or("无法捕获 stderr")?;

        let mut stdout_lines = Vec::new();
        let mut stderr_lines = Vec::new();

        // 异步读取 stdout
        let stdout_reader = BufReader::new(stdout);
        let mut stdout_stream = stdout_reader.lines();
        
        // 异步读取 stderr
        let stderr_reader = BufReader::new(stderr);
        let mut stderr_stream = stderr_reader.lines();

        // 并发读取两个流
        tokio::spawn(async move {
            while let Ok(Some(line)) = stdout_stream.next_line().await {
                stdout_lines.push(line);
            }
        });

        tokio::spawn(async move {
            while let Ok(Some(line)) = stderr_stream.next_line().await {
                stderr_lines.push(line);
            }
        });

        let status = child.wait().await
            .map_err(|e| format!("等待进程结束失败: {}", e))?;

        Ok(ExecutionOutput {
            stdout: stdout_lines,
            stderr: stderr_lines,
            exit_code: status.code(),
        })
    }
}
```

#### Step 2: 重构任务执行逻辑

**文件**: `src-tauri/src/commands/task.rs`

**关键修改**：

1. **移除硬编码的 TaskAction 枚举**（第 165-169 行）
2. **移除 parse_task_action 函数**（第 198-205 行）
3. **重构 execute_task 函数**（第 497-585 行）

```rust
// 新的执行逻辑
#[tauri::command]
pub async fn execute_task(task_id: String) -> Result<ExecutionResult, String> {
    let task = {
        let tasks = TASKS.lock().unwrap();
        get_task_or_error(&tasks, &task_id)?
    };

    let start = chrono::Utc::now();
    
    // 执行 Python 脚本
    let execution_result = execute_python_script(&task).await;
    
    let end = chrono::Utc::now();
    let duration_ms = (end - start).num_milliseconds().max(0) as f32;

    let result = match execution_result {
        Ok(output) => ExecutionResult {
            start_time: start.to_rfc3339(),
            end_time: end.to_rfc3339(),
            status: "success".to_string(),
            output: output.stdout.join("\n"),
            error: if output.stderr.is_empty() { 
                None 
            } else { 
                Some(output.stderr.join("\n")) 
            },
            duration: duration_ms / 1000.0,
        },
        Err(error) => ExecutionResult {
            start_time: start.to_rfc3339(),
            end_time: end.to_rfc3339(),
            status: "failure".to_string(),
            output: "脚本执行失败".to_string(),
            error: Some(error),
            duration: duration_ms / 1000.0,
        },
    };

    // ... 保存执行记录的逻辑保持不变 ...
    
    Ok(result)
}

async fn execute_python_script(task: &Task) -> Result<ExecutionOutput, String> {
    let runner = PythonRunner::new(None);
    
    // 解析参数
    let args: Vec<String> = task.parameters
        .as_ref()
        .map(|params| {
            params.iter()
                .map(|(k, v)| format!("--{}={}", k, v))
                .collect()
        })
        .unwrap_or_default();

    // 准备环境变量（传递账号信息）
    let mut env_vars = HashMap::new();
    if let Some(screen_name) = &task.account_screen_name {
        env_vars.insert("TWITTER_ACCOUNT".to_string(), screen_name.clone());
    }
    if let Some(tweet_id) = &task.tweet_id {
        env_vars.insert("TWEET_ID".to_string(), tweet_id.clone());
    }

    runner.execute(&task.script_path, args, Some(env_vars)).await
}
```

#### Step 3: 添加实时输出流支持（可选，高级功能）

**文件**: `src-tauri/src/commands/task.rs`

```rust
use tauri::Manager;

#[tauri::command]
pub async fn execute_task_with_streaming(
    task_id: String,
    app_handle: tauri::AppHandle,
) -> Result<ExecutionResult, String> {
    // 发送开始事件
    app_handle.emit_all("task-execution-started", task_id.clone()).ok();

    // 执行过程中发送输出事件
    // app_handle.emit_all("task-execution-output", output_line).ok();

    // 发送完成事件
    app_handle.emit_all("task-execution-completed", result.clone()).ok();

    Ok(result)
}
```

### 3.2 前端实现

#### Step 1: 重构类型定义

**文件**: `src/services/task/types.ts`

```typescript
// 移除硬编码的 TaskAction
export type TaskAction = string  // 改为任意字符串（脚本路径）

// 添加脚本执行相关类型
export interface ScriptMetadata {
  path: string
  name: string
  description?: string
  parameters?: ScriptParameter[]
}

export interface ScriptParameter {
  name: string
  type: 'string' | 'number' | 'boolean'
  required: boolean
  default?: string
  description?: string
}

export interface ExecutionOutput {
  stdout: string[]
  stderr: string[]
  exitCode: number | null
}
```

#### Step 2: 创建脚本选择器组件

**文件**: `src/components/ScriptSelector.tsx`

```typescript
import { open } from '@tauri-apps/plugin-dialog'
import { useState } from 'react'

interface ScriptSelectorProps {
  value: string
  onChange: (path: string) => void
}

export function ScriptSelector({ value, onChange }: ScriptSelectorProps) {
  const [selecting, setSelecting] = useState(false)

  const handleSelect = async () => {
    setSelecting(true)
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Python Scripts',
          extensions: ['py']
        }]
      })
      
      if (selected && typeof selected === 'string') {
        onChange(selected)
      }
    } catch (err) {
      console.error('Failed to select script:', err)
    } finally {
      setSelecting(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          readOnly
          placeholder="点击选择 Python 脚本文件"
          className="flex-1 h-10 rounded border border-[#2A2A2A] bg-[#171718] px-3 text-sm text-[#CCCCCC]"
        />
        <button
          type="button"
          onClick={handleSelect}
          disabled={selecting}
          className="h-10 px-4 rounded bg-[#6D5BF6] text-white text-sm hover:bg-[#5B4AD4] disabled:opacity-50"
        >
          {selecting ? '选择中...' : '选择脚本'}
        </button>
      </div>
      {value && (
        <div className="text-xs text-[#858585]">
          已选择: {value.split('/').pop()}
        </div>
      )}
    </div>
  )
}
```

#### Step 3: 简化任务创建界面

**文件**: `src/components/TaskCreatePane.tsx`

**关键修改**：

1. **移除 ACTION_OPTIONS**（第 12-28 行）- 不再需要预定义的任务类型
2. **添加 ScriptSelector** - 替换任务类型下拉框
3. **移除账号统计信息** - 只保留必要的账号选择
4. **添加脚本参数配置** - 动态参数输入

```typescript
// 简化后的核心字段
const [scriptPath, setScriptPath] = useState('')
const [parameters, setParameters] = useState<Record<string, string>>({})

// UI 简化为：
<Field label="Python 脚本">
  <ScriptSelector value={scriptPath} onChange={setScriptPath} />
</Field>

<Field label="脚本参数（可选）">
  <ParameterEditor 
    value={parameters} 
    onChange={setParameters} 
  />
</Field>
```

#### Step 4: 创建执行监控组件

**文件**: `src/components/ScriptExecutionMonitor.tsx`

```typescript
import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'

interface ExecutionMonitorProps {
  taskId: string
}

export function ScriptExecutionMonitor({ taskId }: ExecutionMonitorProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle')
  const [output, setOutput] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unlisten = listen('task-execution-output', (event) => {
      setOutput(prev => [...prev, event.payload as string])
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [taskId])

  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#171718] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-[#CCCCCC]">执行输出</div>
        <StatusBadge status={status} />
      </div>
      
      <div className="rounded border border-[#2A2A2A] bg-black/40 p-3 font-mono text-xs text-[#CCCCCC] max-h-96 overflow-y-auto">
        {output.length === 0 ? (
          <div className="text-[#858585]">等待脚本输出...</div>
        ) : (
          output.map((line, i) => (
            <div key={i} className="leading-6">{line}</div>
          ))
        )}
      </div>

      {error && (
        <div className="mt-3 rounded border border-[#5A1D1D] bg-[#3A1F1F] p-3 text-sm text-[#F48771]">
          {error}
        </div>
      )}
    </div>
  )
}
```

---

## 四、实施步骤

### Phase 1: 后端基础（2-3 小时）

1. ✅ 创建 `python_runner.rs` 服务
2. ✅ 重构 `task.rs` 移除硬编码逻辑
3. ✅ 实现 `execute_python_script` 函数
4. ✅ 添加单元测试

### Phase 2: 前端基础（2-3 小时）

1. ✅ 重构类型定义 `types.ts`
2. ✅ 创建 `ScriptSelector` 组件
3. ✅ 简化 `TaskCreatePane` UI
4. ✅ 更新 Tauri API 调用

### Phase 3: 监控功能（1-2 小时）

1. ✅ 创建 `ScriptExecutionMonitor` 组件
2. ✅ 实现实时输出流（可选）
3. ✅ 更新 `TaskDetailContentPane` 显示脚本输出

### Phase 4: 测试与优化（1-2 小时）

1. ✅ 端到端测试
2. ✅ 错误处理优化
3. ✅ UI/UX 调整
4. ✅ 文档更新

---

## 五、关键技术决策

### 5.1 为什么使用 tokio::process::Command？

- **异步执行**：不阻塞主线程
- **流式输出**：实时捕获 stdout/stderr
- **超时控制**：支持 timeout 机制
- **跨平台**：Windows/macOS/Linux 兼容

### 5.2 如何传递 Twitter 账号信息给脚本？

**方案 A（推荐）**：环境变量

```bash
TWITTER_ACCOUNT=@username python script.py
```

**方案 B**：命令行参数

```bash
python script.py --account=@username
```

**方案 C**：配置文件

```bash
python script.py --config=/path/to/config.json
```

推荐方案 A，因为：
- 不污染命令行参数
- 脚本可以自由定义自己的参数
- 安全性更好（不会出现在进程列表中）

### 5.3 如何处理长时间运行的脚本？

1. **超时机制**：默认 5 分钟超时，可配置
2. **后台执行**：使用 tokio 异步任务
3. **状态持久化**：执行状态保存到 JSON
4. **进程管理**：支持手动终止脚本

---

## 六、风险与挑战

### 6.1 安全风险

**问题**：用户可能选择恶意脚本

**解决方案**：
- 脚本路径白名单机制
- 沙箱执行环境（可选）
- 用户确认对话框

### 6.2 性能问题

**问题**：大量输出可能导致内存溢出

**解决方案**：
- 输出行数限制（最多 10000 行）
- 流式写入文件而非内存
- 定期清理历史记录

### 6.3 跨平台兼容性

**问题**：Windows/macOS/Linux Python 路径不同

**解决方案**：
- 自动检测 Python 路径
- 用户可配置 Python 解释器路径
- 提供默认值：`python3` (Unix) / `python` (Windows)

---

## 七、后续扩展

### 7.1 脚本市场

- 内置常用脚本模板
- 社区脚本分享
- 脚本评分和评论

### 7.2 调度增强

- Cron 表达式支持
- 条件触发（如：粉丝数达到 1000 时执行）
- 依赖任务（任务 A 完成后执行任务 B）

### 7.3 监控增强

- 实时日志流
- 性能指标（CPU/内存使用）
- 执行历史图表

---

## 八、补充功能：工作目录切换与多窗口支持

### 8.1 工作目录切换功能

**需求背景**：用户需要能够切换不同的工作目录，以便在不同的项目或脚本集合之间切换。

**实现位置**：TitleBar 组件

**技术方案**：

1. **目录选择器**
   - 使用 `@tauri-apps/plugin-dialog` 的 `open()` API
   - 配置 `directory: true` 选择文件夹
   - 保存选中的目录路径到应用状态

2. **状态管理**
   - 在全局状态中维护当前工作目录
   - 切换目录时刷新任务列表和脚本列表
   - 持久化最近使用的目录列表

3. **UI 设计**
   - 在 TitleBar 添加目录切换按钮
   - 显示当前工作目录路径
   - 支持快速切换最近使用的目录

**代码示例**：

```typescript
// src/components/TitleBar.tsx
import { open } from '@tauri-apps/plugin-dialog'

const handleSelectWorkspace = async () => {
  const selected = await open({
    directory: true,
    multiple: false,
    title: '选择工作目录'
  })
  
  if (selected && typeof selected === 'string') {
    // 更新全局工作目录状态
    setWorkspaceDir(selected)
    // 刷新任务列表
    await refreshTasks()
  }
}
```

### 8.2 新窗口打开功能

**需求背景**：用户希望能够在新窗口中打开不同的工作目录，实现多工作区并行管理。

**技术挑战**：Tauri 需要 spawn 全新的进程来管理新窗口，每个窗口独立维护自己的状态。

**实现方案**：

#### 方案 A：使用 Tauri 多窗口 API（推荐）

```rust
// src-tauri/src/commands/window.rs
use tauri::{Manager, WindowBuilder};

#[tauri::command]
pub async fn open_workspace_in_new_window(
    app_handle: tauri::AppHandle,
    workspace_path: String,
) -> Result<(), String> {
    let window_label = format!("workspace_{}", uuid::Uuid::new_v4());
    
    WindowBuilder::new(
        &app_handle,
        window_label,
        tauri::WindowUrl::App("index.html".into())
    )
    .title(format!("TweetPilot - {}", workspace_path))
    .inner_size(1200.0, 800.0)
    .build()
    .map_err(|e| format!("创建窗口失败: {}", e))?;
    
    // 通过窗口事件传递工作目录参数
    // 前端监听 tauri://created 事件获取参数
    
    Ok(())
}
```

#### 方案 B：使用进程 spawn（备选）

```rust
// src-tauri/src/commands/window.rs
use std::process::Command;

#[tauri::command]
pub async fn spawn_new_instance(workspace_path: String) -> Result<(), String> {
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("获取当前可执行文件路径失败: {}", e))?;
    
    Command::new(current_exe)
        .arg("--workspace")
        .arg(workspace_path)
        .spawn()
        .map_err(|e| format!("启动新进程失败: {}", e))?;
    
    Ok(())
}
```

**前端实现**：

```typescript
// src/services/window.ts
import { invoke } from '@tauri-apps/api/core'

export async function openWorkspaceInNewWindow(workspacePath: string) {
  await invoke('open_workspace_in_new_window', { workspacePath })
}

// src/components/WorkspaceSelector.tsx
const handleOpenInNewWindow = async () => {
  const selected = await open({
    directory: true,
    multiple: false,
    title: '在新窗口中打开工作目录'
  })
  
  if (selected && typeof selected === 'string') {
    await openWorkspaceInNewWindow(selected)
  }
}
```

**UI 集成**：

1. 在 TitleBar 添加"新窗口"按钮
2. 右键菜单支持"在新窗口中打开"
3. 每个窗口独立显示当前工作目录

**技术要点**：

- 每个窗口维护独立的状态（Redux store 或 Context）
- 窗口间不共享任务列表和执行状态
- 支持窗口标题显示当前工作目录
- 窗口关闭时清理相关资源

**预计工时**：2-3 小时

---

## 九、总结

本方案将 TweetPilot 从一个硬编码的 Twitter 操作工具改造为**通用的 Python 脚本执行平台**，具备：

✅ **灵活性**：支持任意 Python 脚本
✅ **可观测性**：实时监控执行状态和输出
✅ **易用性**：简化 UI，聚焦核心功能
✅ **可扩展性**：为未来功能预留接口
✅ **多工作区支持**：工作目录切换和多窗口管理

**核心功能预计总工时**：6-10 小时
**补充功能预计总工时**：2-3 小时
**总计**：8-13 小时
