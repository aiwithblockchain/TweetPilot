# 任务模块改造方案：支持修改脚本执行路径、执行目录与参数

> 文档目的：基于当前代码现状，提出一套最小可落地的改造方案，用于为任务模块增加“可修改脚本执行路径、执行目录和参数”的能力。
> 
> 说明：本文档仅描述方案，不包含代码实现。

---

## 1. 背景

当前任务模块已经支持创建任务、立即执行、定时执行、查看执行历史等能力，但在脚本执行配置方面仍存在明显短板：

- 任务保存了脚本路径，但脚本文件被移动后，任务会继续使用旧路径执行
- 当前没有完整的任务编辑能力来修复脚本路径
- 当前没有独立的“执行目录（working directory）”配置
- 当前“立即执行”和“定时执行”在参数传递行为上不一致

典型问题表现为：

```bash
/Library/Frameworks/Python.framework/Versions/3.13/Resources/Python.app/Contents/MacOS/Python: can't open file '/Users/hyperorchid/Downloads/tweet-wocute/test_hello.py': [Errno 2] No such file or directory
```

这类问题的根因不是 Python 本身，而是任务仍然持有失效的 `script_path`，且系统缺少一个完整的“编辑任务执行配置”的能力闭环。

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

当前任务模型中未包含：

- `working_directory`
- 原始 argv 数组
- 可视化编辑状态相关字段

### 2.2 执行路径现状

系统中存在两套执行链路：

#### A. 手动立即执行
文件：`src-tauri/src/task_executor.rs`

当前行为：

- 执行 `python3 <script_path>`
- 支持 timeout
- 解析 `parameters`，但没有真正传入脚本
- 没有显式设置 `current_dir`

#### B. 定时执行
文件：`src-tauri/src/unified_timer/executors/python_script.rs`

当前行为：

- 执行 `python3 <script_path> --account <account_id> --key value`
- 会把 `parameters` 作为 CLI 参数传给脚本
- 没有显式设置 `current_dir`

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
- 配置参数
- 详情查看
- 执行 / 暂停 / 恢复 / 删除

当前缺失能力：

- 编辑已有任务
- 修改脚本路径
- 修改执行目录
- 修改参数并保存

---

## 3. 当前问题总结

### 3.1 脚本路径不可修复

当脚本被移动、重命名或迁移目录后，任务仍引用旧 `script_path`，导致执行失败。

### 3.2 缺少执行目录配置

很多脚本依赖相对路径，例如：

- `open("./config.json")`
- `Path("data/input.txt")`

如果没有稳定的工作目录，脚本即使路径正确，也可能因为资源文件找不到而失败。

### 3.3 立即执行与定时执行行为不一致

当前同一个任务：

- 立即执行：参数不生效
- 定时执行：参数会生效

这会导致用户无法预测任务的真实行为。

### 3.4 已有 update 接口，但没有完整编辑闭环

后端已有 `update_task`，前端 service 层也已支持 `updateTask`，但 UI 没有编辑入口，导致已有能力无法形成用户可用的产品能力。

---

## 4. 改造目标

本次改造目标限定为以下三项：

1. 支持修改任务的脚本路径 `script_path`
2. 支持新增并修改任务的执行目录 `working_directory`
3. 支持修改任务的执行参数 `parameters`

同时要求：

- 手动执行与定时执行行为保持一致
- 任务更新后，立即执行和下次调度都使用新配置
- 尽量基于当前结构最小改动，不引入过度设计

---

## 5. 非目标

本次不建议顺带引入以下能力：

- 自定义 Python 解释器路径
- Shell 命令拼接模式
- 环境变量编辑器
- 自动检测脚本移动并自动修复路径
- 原始 argv 全量编辑器

原因：这些能力会显著扩大改造范围，不符合当前“修复脚本路径/执行目录/参数可编辑”的主需求。

---

## 6. 设计方案

### 6.1 数据模型扩展

#### 新增字段

建议为任务模型新增：

- 后端：`working_directory: Option<String>`
- 前端：`workingDirectory?: string`

用途：

- 表示脚本运行时的工作目录
- 解决脚本内部相对路径依赖问题

#### 参数模型保持现状

当前已有：

- `parameters: Record<string, string>`

本次建议继续沿用，不新增原始 argv 数组。原因：

- 当前 UI 已有参数编辑器
- 当前后端已有 parameters 存储
- 能满足“可修改参数”的当前需求
- 改动范围最小

---

### 6.2 路径解析规则

#### `script_path`

保持当前规则：

- 绝对路径：直接使用
- 相对路径：相对于 workspace root 解析

#### `working_directory`

建议规则：

- 若为空：默认使用脚本所在目录
- 若为绝对路径：直接使用
- 若为相对路径：相对于 workspace root 解析

#### 选择“脚本所在目录”作为默认 cwd 的原因

- 最符合脚本作者直觉
- 与脚本本地调试时的行为更接近
- 便于脚本访问相对路径资源文件
- 与仓库中已有 `python_runner.rs` 的处理思路一致

---

### 6.3 参数传递规则统一

本次改造要求：

- 手动执行与定时执行统一为同一套参数构造逻辑
- `parameters` 继续按以下形式传递：

```bash
--key value
```

这样做的原因：

- 当前定时执行已经采用该形式
- 不需要重做参数 UI
- 便于最小成本实现一致性

---

## 7. 详细改造点

### 7.1 数据库与后端模型

涉及文件：

- `src-tauri/src/task_database.rs`
- `src-tauri/migrations/`（新增 migration）

#### 改造内容

1. 为 `tasks` 表新增字段：
   - `working_directory TEXT NULL`

2. 在 Rust 结构体中新增字段：
   - `Task.working_directory`
   - `TaskConfigInput.working_directory`

3. 更新以下逻辑：
   - `create_task`
   - `update_task`
   - `get_task`
   - `get_all_tasks`

#### Migration 建议

新增 migration，例如：

- `src-tauri/migrations/002_add_working_directory_to_tasks.sql`

不建议直接修改 `001_create_tasks_tables.sql`，以避免已有数据库实例升级时出现不一致。

---

### 7.2 手动执行链路改造

涉及文件：

- `src-tauri/src/task_executor.rs`

#### 当前问题

- 没有设置工作目录
- 没有把 `parameters` 真正传给脚本

#### 改造目标

执行流程统一为：

1. 解析 `script_path`
2. 解析 `working_directory`
3. 计算最终 `cwd`
4. `Command.current_dir(cwd)`
5. 将 `parameters` 按 `--key value` 注入命令行
6. 保留现有 timeout / stdout / stderr / exit code 逻辑

#### 结果

手动执行将与定时执行共享同一套外部行为语义。

---

### 7.3 定时执行链路改造

涉及文件：

- `src-tauri/src/unified_timer/executors/python_script.rs`

#### 当前问题

- 没有设置工作目录
- 与手动执行的行为不一致

#### 改造目标

执行流程统一为：

1. 从调度配置中读取 `script_path`
2. 从调度配置中读取 `working_directory`
3. 计算最终 `cwd`
4. `Command.current_dir(cwd)`
5. 参数传递方式与手动执行完全一致

---

### 7.4 Timer 配置透传

涉及文件：

- `src-tauri/src/task_commands.rs`

重点函数：

- `WorkspaceContext::build_task_timer(...)`

#### 当前问题

当前传入 timer executor 的配置仅包含：

- `script_path`
- `account_id`
- `parameters`
- `timeout`

#### 改造要求

必须新增透传：

- `working_directory`

否则会出现：

- 数据库里有该字段
- 手动执行生效
- 定时执行不生效

这种不一致必须避免。

---

### 7.5 前端类型与 service 层改造

涉及文件：

- `src/services/task/types.ts`
- `src/services/task/tauri.ts`

#### 改造内容

1. 在前端任务类型中新增：
   - `workingDirectory?: string`

2. 在 Tauri 映射中新增：
   - `working_directory <-> workingDirectory`

3. 保证 create / update / detail / list 的字段映射一致

---

### 7.6 任务创建页扩展

涉及文件：

- `src/components/TaskCreatePane.tsx`
- `src/components/ScriptSelector.tsx`
- 如需补充目录选择，可新增目录选择组件

#### 新增 UI 字段

建议在现有创建表单中新增：

1. 脚本路径
   - 继续沿用现有选择器

2. 执行目录
   - 新增输入框
   - 支持手动输入
   - 建议支持目录选择器

3. 参数
   - 继续沿用现有 `ParameterEditor`

#### 建议文案

- 脚本路径：要执行的 Python 脚本文件
- 执行目录：脚本运行时的工作目录，留空则默认使用脚本所在目录
- 参数：会以 `--key value` 的形式传递给脚本

---

### 7.7 任务详情页增加编辑能力

涉及文件：

- `src/components/TaskDetailContentPane.tsx`
- `src/components/TaskActionBar.tsx`

#### 改造建议

在任务详情页中增加“编辑”入口。

点击后进入编辑模式，允许修改：

- `scriptPath`
- `workingDirectory`
- `parameters`
- 其他现有可编辑配置（如 task name / description / timeout / schedule）

#### 推荐实现方式

优先建议：**复用现有 `TaskCreatePane`，为其增加编辑模式。**

原因：

- 当前结构中已有完整创建表单
- 可减少重复 UI 逻辑
- 参数编辑器可直接复用
- 改动范围比新拆 `TaskForm` 更小

可采用模式：

- `mode: 'create' | 'edit'`
- 编辑模式下预填当前任务值
- 提交时调用 `taskService.updateTask(...)`

---

## 8. 需要同步处理的现有一致性问题

### 8.1 手动执行未传参数

这是本次必须修复的现有问题，否则“编辑参数”能力只会对定时执行生效。

### 8.2 account 字段映射疑似不一致

当前前端存在以下风险：

- 表单侧使用 `accountId`
- service 映射侧使用 `accountScreenName`

建议在本次改造中一并核对并统一，避免任务编辑保存后把账号配置写错或丢失。

### 8.3 UI 文案与真实行为不一致

当前部分 UI 文案描述脚本可通过环境变量获取账号/推文信息，但实际执行链路并未完整兑现该约定。

建议本次至少校正文案，确保：

- 参数传递方式描述与真实执行一致
- 若暂未提供环境变量，则不要在 UI 中做过度承诺

---

## 9. 校验与错误处理建议

### 9.1 保存前或执行前校验

建议至少增加以下校验：

#### 脚本路径校验

- 路径不能为空
- 路径对应文件必须存在
- 路径必须为文件，而不是目录

#### 执行目录校验

- 若填写，则目标路径必须存在
- 必须为目录，而不是文件

### 9.2 错误提示要求

当配置失效时，应尽量返回明确错误，而不是只透传 Python 原始错误。

建议区分以下错误：

- 脚本文件不存在
- 执行目录不存在
- 执行目录不是目录
- 参数解析失败

这样用户在脚本被移动后，可以更快地定位问题并通过“编辑任务”修复。

---

## 10. 路径与安全边界说明

### 10.1 是否允许绝对路径

建议第一阶段允许绝对路径，因为当前系统本身已经支持绝对路径脚本。

### 10.2 是否限制必须位于 workspace 内

当前代码逻辑并未强约束任务脚本必须位于 workspace 内，因此本次不建议突然加硬限制，以免破坏已有用法。

### 10.3 参数注入安全性

建议继续使用 `std::process::Command.arg(...)` 逐项传参，不要改为 shell 拼接字符串，以避免命令注入风险。

---

## 11. 推荐实施顺序

### 第一步：扩展数据模型

- 新增数据库字段 `working_directory`
- 更新 Rust / TS 类型
- 更新 create / update / detail / list 映射

### 第二步：统一后端执行行为

- 手动执行补齐参数传递
- 手动执行加入 `current_dir`
- 定时执行加入 `current_dir`
- 统一路径解析逻辑

### 第三步：透传 timer 配置

- 在 `build_task_timer(...)` 中加入 `working_directory`
- 确保调度执行也能读取新字段

### 第四步：补齐前端编辑能力

- 任务详情页增加编辑入口
- 复用创建表单支持编辑模式
- 支持修改脚本路径 / 执行目录 / 参数

### 第五步：补充校验与文案修正

- 提高错误可读性
- 修正参数 / 环境变量相关文案
- 核对 account 字段映射一致性

---

## 12. 验收标准

### 12.1 功能验收

- 已有任务可修改脚本路径
- 已有任务可修改执行目录
- 已有任务可修改参数
- 保存后立即执行使用新配置
- 保存后后续定时执行使用新配置

### 12.2 一致性验收

同一个任务：

- 手动执行
- 定时执行

必须在以下方面表现一致：

- 脚本路径解析
- 工作目录
- 参数传递方式
- timeout 行为

### 12.3 错误提示验收

当脚本路径或执行目录失效时，能够明确提示：

- 文件不存在
- 目录不存在
- 路径类型错误

而不是只有底层 Python 报错。

---

## 13. 涉及文件清单

### 后端

- `src-tauri/src/task_database.rs`
- `src-tauri/src/task_commands.rs`
- `src-tauri/src/task_executor.rs`
- `src-tauri/src/unified_timer/executors/python_script.rs`
- `src-tauri/migrations/002_add_working_directory_to_tasks.sql`（建议新增）

### 前端

- `src/services/task/types.ts`
- `src/services/task/tauri.ts`
- `src/components/TaskCreatePane.tsx`
- `src/components/TaskDetailContentPane.tsx`
- `src/components/TaskActionBar.tsx`
- `src/components/ParameterEditor.tsx`
- 如有需要，新增目录选择相关组件

---

## 14. 最终结论

基于当前代码情况，建议本次改造采用“最小可落地方案”：

1. 新增并支持编辑 `working_directory`
2. 支持编辑现有 `script_path`
3. 支持编辑现有 `parameters`
4. 统一手动执行与定时执行的行为
5. 在任务详情页补齐编辑入口

该方案能直接解决当前最核心的问题：

- 脚本移动后不必删除重建任务
- 可以直接修正脚本路径
- 可以修正执行目录
- 可以修正参数
- 修改后的配置对立即执行和定时执行都生效

同时该方案尽量复用现有模型、service 与 UI 结构，避免引入超出当前需求的大规模重构。
