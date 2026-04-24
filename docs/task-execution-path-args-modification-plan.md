# 任务模块改造方案：保证脚本按数据库路径正确执行

> 文档目的：基于当前代码现状，提出一套最小可落地的改造方案，用于保证任务执行时严格按照数据库中的 `script_path` 启动脚本。
>
> 说明：本文档仅描述方案，不包含代码实现。

---

## 1. 背景

当前任务模块已经支持创建任务、立即执行、定时执行、查看执行历史等能力，但存在以下核心问题：

- 任务保存了脚本路径，但执行链路需要确认是否**严格按照数据库中的 `script_path` 启动脚本**
- 脚本文件被移动后，任务会继续使用旧路径执行，导致失败
- 当前没有完整的任务编辑能力来修复脚本路径

典型问题表现为：

```bash
/Library/Frameworks/Python.framework/Versions/3.13/Resources/Python.app/Contents/MacOS/Python: can't open file '/Users/hyperorchid/Downloads/tweet-wocute/test_hello.py': [Errno 2] No such file or directory
```

这类问题的根因是任务仍然持有失效的 `script_path`，且系统缺少一个完整的"编辑任务执行配置"的能力闭环。

---

## 2. 当前代码现状

### 2.1 任务数据模型

后端任务核心数据定义位于：

- `src-tauri/src/task_database.rs`
- `src-tauri/migrations/001_create_tasks_tables.sql`

当前任务模型中已包含：

- `script_path`
- `parameters`
- `timeout`
- `account_id`
- `schedule`
- `task_type`

### 2.2 执行路径现状

系统中存在两套执行链路：

#### A. 手动立即执行
文件：`src-tauri/src/task_executor.rs`

当前行为：

- 执行 `python3 <script_path>`
- 支持 timeout
- 解析 `parameters`，但没有真正传入脚本

#### B. 定时执行
文件：`src-tauri/src/unified_timer/executors/python_script.rs`

当前行为：

- 执行 `python3 <script_path> --account <account_id> --key value`
- 会把 `parameters` 作为 CLI 参数传给脚本

### 2.3 UI 现状

前端相关文件：

- `src/components/TaskCreatePane.tsx`
- `src/components/ScriptSelector.tsx`
- `src/components/ParameterEditor.tsx`
- `src/components/TaskDetailContentPane.tsx`
- `src/components/TaskActionBar.tsx`
- `src/services/task/types.ts`
- `src/services/task/tauri.ts`

当前已有能力：

- 创建任务
- 选择脚本路径
- 配置参数（编辑和存储）
- 详情查看
- 执行 / 暂停 / 恢复 / 删除

当前缺失能力：

- 编辑已有任务（特别是脚本路径）

---

## 3. 当前问题总结

### 3.1 脚本路径不可修复

当脚本被移动、重命名或迁移目录后，任务仍引用旧 `script_path`，导致执行失败。

### 3.2 已有 update 接口，但没有完整编辑闭环

后端已有 `update_task`，前端 service 层也已支持 `updateTask`，但 UI 没有编辑入口，导致已有能力无法形成用户可用的产品能力。

---

## 4. 改造目标

本次改造目标限定为以下两项：

1. **支持修改任务的脚本路径 `script_path`**
2. **保证执行时严格按照数据库中的 `script_path` 启动脚本**

同时要求：

- 任务更新后，立即执行和下次调度都使用新配置
- 尽量基于当前结构最小改动，不引入过度设计

---

## 5. 非目标

本次不建议顺带引入以下能力：

- `working_directory` 执行目录配置
- 自定义 Python 解释器路径
- Shell 命令拼接模式
- 环境变量注入参数
- 通过命令行参数传递 `parameters`
- 自动检测脚本移动并自动修复路径
- 原始 argv 全量编辑器
- 参数的高级消费方式（与 AI 结合等）

原因：这些能力会显著扩大改造范围，不符合当前"修复脚本路径可编辑、保证执行链路正确使用数据库路径"的主需求。参数如何使用后续将重新设计，当前执行链路暂不消费 `parameters`。

---

## 6. 设计方案

### 6.1 参数处理策略

当前数据库中已存在 `parameters` 字段，前端也支持编辑。

本次方案中：

- `parameters` **继续存储和编辑**，保持现有能力不变
- 执行链路**暂时完全不消费 `parameters`**
- 参数后续如何传递给脚本（命令行、环境变量、stdin 或其他方式）将**另行设计**，不在本次范围内

原因：

- 参数与 Python 脚本 / AI 的结合方式尚未确定
- 提前实现参数传递可能与新设计冲突
- 最小改动原则：只改必须改的部分

---

### 6.2 路径解析规则

#### `script_path`

保持当前规则：

- 绝对路径：直接使用
- 相对路径：相对于 workspace root 解析

---

## 7. 详细改造点

### 7.1 手动执行链路确认

涉及文件：

- `src-tauri/src/task_executor.rs`

#### 改造目标

确认并保证执行流程：

1. 从数据库读取任务
2. 取出 `script_path`
3. 解析路径（绝对/相对 workspace root）
4. 使用解析后的路径启动脚本
5. 保留现有 timeout / stdout / stderr / exit code 逻辑

#### 关于参数

执行时**不读取、不传递** `parameters`。保持当前行为即可。

---

### 7.2 定时执行链路确认

涉及文件：

- `src-tauri/src/unified_timer/executors/python_script.rs`

#### 改造目标

确认并保证执行流程：

1. 从调度配置中读取 `script_path`
2. 解析路径（绝对/相对 workspace root）
3. 使用解析后的路径启动脚本

#### 关于参数

执行时**不读取、不传递** `parameters`。当前通过 `--key value` 传递参数的行为在本次中**保持不变或统一去除**，但明确不再扩展参数传递能力。

---

### 7.3 Timer 配置确认

涉及文件：

- `src-tauri/src/task_commands.rs`

重点函数：

- `WorkspaceContext::build_task_timer(...)`

#### 改造目标

确认定时器配置中 `script_path` 是否正确从任务对象读取。如当前已实现则无需改动。

#### 关于参数

不在定时器配置中新增任何参数相关字段。

---

### 7.4 前端类型与 service 层确认

涉及文件：

- `src/services/task/types.ts`
- `src/services/task/tauri.ts`

#### 改造内容

1. 确认 `scriptPath` 在 create / update / detail / list 的字段映射一致
2. 确认 `parameters` 继续保留在类型定义中（编辑和存储用，不删除）

---

### 7.5 任务创建页扩展

涉及文件：

- `src/components/TaskCreatePane.tsx`
- `src/components/ScriptSelector.tsx`

#### 新增 UI 能力

在现有创建表单中：

1. 脚本路径
   - 继续沿用现有选择器

2. 参数
   - 继续沿用现有 `ParameterEditor`
   - 仅用于编辑和存储，不影响执行

#### 建议文案

- 脚本路径：要执行的 Python 脚本文件
- 参数：任务参数（当前执行链路暂不消费，后续版本将支持）

---

### 7.6 任务详情页增加编辑能力

涉及文件：

- `src/components/TaskDetailContentPane.tsx`
- `src/components/TaskActionBar.tsx`

#### 改造建议

在任务详情页中增加"编辑"入口。

点击后进入编辑模式，允许修改：

- `scriptPath`
- 其他现有可编辑配置（如 task name / description / timeout / schedule）

#### 推荐实现方式

**复用现有 `TaskCreatePane`，为其增加编辑模式。**

可采用模式：

- `mode: 'create' | 'edit'`
- 编辑模式下预填当前任务值
- 提交时调用 `taskService.updateTask(...)`

---

## 8. 需要同步处理的现有一致性问题

### 8.1 account 字段映射疑似不一致

当前前端存在以下风险：

- 表单侧使用 `accountId`
- service 映射侧使用 `accountScreenName`

建议在本次改造中一并核对并统一，避免任务编辑保存后把账号配置写错或丢失。

### 8.2 UI 文案与真实行为不一致

当前部分 UI 文案描述脚本可通过环境变量获取账号/推文信息，但实际执行链路并未完整兑现该约定。

建议本次校正文案，确保：

- 不对未实现的能力做过度承诺
- 参数相关描述明确标注"当前版本暂不消费"

---

## 9. 校验与错误处理建议

### 9.1 保存前或执行前校验

建议至少增加以下校验：

#### 脚本路径校验

- 路径不能为空
- 路径对应文件必须存在
- 路径必须为文件，而不是目录

### 9.2 错误提示要求

当配置失效时，应尽量返回明确错误，而不是只透传 Python 原始错误。

建议区分以下错误：

- 脚本文件不存在
- 路径类型错误

这样用户在脚本被移动后，可以更快地定位问题并通过"编辑任务"修复。

---

## 10. 路径与安全边界说明

### 10.1 是否允许绝对路径

建议第一阶段允许绝对路径，因为当前系统本身已经支持绝对路径脚本。

### 10.2 是否限制必须位于 workspace 内

当前代码逻辑并未强约束任务脚本必须位于 workspace 内，因此本次不建议突然加硬限制，以免破坏已有用法。

---

## 11. 推荐实施顺序

### 第一步：确认后端执行行为

- 确认手动执行按数据库 `script_path` 启动
- 确认定时执行按数据库 `script_path` 启动
- 明确执行链路不消费 `parameters`

### 第二步：透传 timer 配置确认

- 确认 `build_task_timer(...)` 中 `script_path` 正确读取
- 确保调度执行使用最新配置

### 第三步：补齐前端编辑能力

- 任务详情页增加编辑入口
- 复用创建表单支持编辑模式
- 支持修改脚本路径

### 第四步：补充校验与文案修正

- 提高错误可读性
- 修正 UI 文案，避免过度承诺
- 核对 account 字段映射一致性

---

## 12. 验收标准

### 12.1 功能验收

- 已有任务可修改脚本路径
- 保存后立即执行使用新配置
- 保存后后续定时执行使用新配置

### 12.2 一致性验收

同一个任务：

- 手动执行
- 定时执行

必须在以下方面表现一致：

- 脚本路径解析
- timeout 行为

### 12.3 错误提示验收

当脚本路径失效时，能够明确提示：

- 文件不存在
- 路径类型错误

而不是只有底层 Python 报错。

---

## 13. 涉及文件清单

### 后端

- `src-tauri/src/task_database.rs`
- `src-tauri/src/task_commands.rs`
- `src-tauri/src/task_executor.rs`
- `src-tauri/src/unified_timer/executors/python_script.rs`

### 前端

- `src/services/task/types.ts`
- `src/services/task/tauri.ts`
- `src/components/TaskCreatePane.tsx`
- `src/components/TaskDetailContentPane.tsx`
- `src/components/TaskActionBar.tsx`
- `src/components/ScriptSelector.tsx`

---

## 14. 最终结论

基于当前代码情况，建议本次改造采用"最小可落地方案"：

1. 支持编辑现有 `script_path`
2. 保证执行链路严格按照数据库中的 `script_path` 启动脚本
3. 任务详情页补齐编辑入口
4. `parameters` 继续存储和编辑，但执行链路暂不消费，留待后续重新设计

该方案能直接解决当前最核心的问题：

- 脚本移动后不必删除重建任务
- 可以直接修正脚本路径
- 修改后的配置对立即执行和定时执行都生效

同时该方案尽量复用现有模型、service 与 UI 结构，避免引入超出当前需求的大规模重构。
