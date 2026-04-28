# 任务脚本路径执行改造实施记录

## 状态

**已完成交付。**

本文件用于记录本轮任务执行链路改造的背景、交付范围、实现结果、验证结论与后续边界，不再作为待实施方案使用。

---

## 背景

本轮改造的直接触发问题，是任务在脚本文件被移动后仍继续使用数据库中的旧路径执行，最终出现类似如下报错：

```bash
/Library/Frameworks/Python.framework/Versions/3.13/Resources/Python.app/Contents/MacOS/Python: can't open file '/Users/hyperorchid/Downloads/tweet-wocute/test_hello.py': [Errno 2] No such file or directory
```

结合现有代码链路复核后，问题被收敛为两个核心缺口：

1. 任务详情页缺少完整编辑闭环，失效的 `script_path` 无法直接修复
2. 手动执行与定时执行虽然都依赖任务配置，但执行边界与前端文案并不一致，容易让用户误以为 `parameters`、账号字段会参与当前脚本执行

因此，本轮交付目标被明确限定为：

- 支持编辑任务的 `script_path`
- 保证任务执行严格依据数据库中的 `script_path`
- `parameters` 继续保留并可编辑，但当前执行链路不消费它们
- 不引入 `working_directory`
- 不通过环境变量或 CLI 参数向脚本注入任务参数

---

## 本轮已完成交付

当前任务模块已完成以下改造：

- 任务详情页新增“编辑任务”入口
- 任务创建表单复用为编辑表单
- 已存在任务可直接修改脚本路径、名称、描述、调度等基础配置
- 保存后会通过既有 `update_task` / `updateTask` 链路更新数据库配置
- 手动立即执行只基于数据库中的 `script_path` 启动脚本
- 定时执行只基于数据库中的 `script_path` 启动脚本
- 手动执行与定时执行都不再消费 `parameters`
- 定时执行不再注入 `account_id`
- 执行前增加脚本存在性与文件类型校验
- 旧任务 `parameters` 为字符串化 JSON 时，前端会先归一化，避免出现伪参数显示
- 编辑任务时切换到其他任务，已增加全局未保存修改确认弹窗
- 选择“放弃并切换”后，新任务会以非编辑态打开
- 相关前端文案已改为“参数当前仅存储，执行链路暂不消费”

---

## 关键实现结论

### 1. 执行路径已统一收敛到数据库 `script_path`

本轮最重要的交付结果，是把任务执行行为收敛为统一规则：

- 手动立即执行：从数据库读取任务后，只使用该任务的 `script_path`
- 定时执行：从定时器配置读取任务的 `script_path`，且配置源自数据库任务记录

这意味着：

- 修改任务脚本路径后，无需删除重建任务
- 后续立即执行会直接使用新路径
- 定时任务在更新并重建 timer 后，也会使用新路径

### 2. `parameters` 当前只保留存储价值，不参与执行

本轮没有删除任务模型中的 `parameters`，也没有删除前端参数编辑器。

但当前运行时行为已明确调整为：

- 参数可继续查看和编辑
- 参数可继续保存到数据库
- 手动执行不解析、不透传参数
- 定时执行不拼接 `--key value`
- 当前版本不通过环境变量注入参数

因此，`parameters` 在当前版本中的定位已经被明确为：**保留数据，不参与执行**。

### 3. 任务编辑能力已形成闭环

此前后端已有 `update_task`，前端 service 已有 `updateTask`，但用户侧缺少可用入口。

本轮通过复用 `TaskCreatePane` 的方式完成了最小改造：

- 新增 `create / edit` 模式切换
- 编辑态支持现有任务预填
- 保存时走更新接口
- 保存成功后刷新详情
- 取消编辑可回到详情态

这样避免了重复维护两套大表单。

### 4. 已补齐未保存修改的切换保护

任务编辑态新增了脏表单检测，并把拦截逻辑提升到 `App.tsx` 层处理。

结果是：

- 在任务编辑中切换左侧其他任务时，会弹出全局确认框
- 弹窗打开期间不会继续误切换任务
- 选择继续编辑时保留当前表单
- 选择放弃并切换时，目标任务会以正常详情态打开，不会错误继承上一个任务的编辑状态

### 5. 旧任务参数展示问题已修复

对于历史数据中 `parameters` 被存成 JSON 字符串的任务，前端已在映射层做归一化处理。

修复后：

- 不会再把字符串错误拆成 `--0 {`、`--1 }` 这类伪参数
- 旧任务进入编辑页时可以正常显示参数对象

---

## 涉及的关键文件

### 后端

- `src-tauri/src/task_executor.rs`
  - 移除手动执行中对 `parameters` 的解析
  - 执行前校验脚本是否存在、是否为文件
  - 执行命令收敛为 `python3 <script_path>`

- `src-tauri/src/unified_timer/executors/python_script.rs`
  - 移除定时执行对 `account_id`、`parameters` 的读取
  - 移除 `--account` 与 `--key value` 注入
  - 保留 timeout、stdout/stderr、落库能力
  - 增加脚本存在性与文件类型校验

- `src-tauri/src/task_commands.rs`
  - 精简 timer 的 executor config，仅保留 `script_path` 与 `timeout`
  - 更新任务后继续通过清理并重建 timer 的方式生效新配置

### 前端服务与类型

- `src/services/task/types.ts`
- `src/services/task/tauri.ts`
  - 修正 `accountId` / `account_id` 映射一致性
  - 对旧任务 `parameters` 做归一化处理
  - 确保任务详情、创建、更新链路的字段映射一致

### 前端 UI

- `src/components/TaskCreatePane.tsx`
  - 扩展为创建 / 编辑复用表单
  - 增加脏表单检测与编辑模式提交逻辑

- `src/components/TaskDetailContentPane.tsx`
  - 增加编辑态切换
  - 保存后刷新详情
  - 在任务切换时重置本地编辑状态，避免新任务误进编辑态

- `src/components/TaskActionBar.tsx`
  - 增加“编辑任务”入口并调整按钮可见性

- `src/components/TaskDetailPane.tsx`
- `src/components/CenterContentRouter.tsx`
- `src/App.tsx`
  - 打通任务编辑状态上报
  - 在应用壳层实现全局未保存修改拦截弹窗

- `src/components/ParameterEditor.tsx`
  - 更新参数说明文案，明确“当前执行链路暂不消费”

---

## 验证结论

本轮改造已完成以下关键验证：

### 后端行为

- 手动执行只按数据库 `script_path` 启动脚本
- 定时执行只按数据库 `script_path` 启动脚本
- 两条链路都不再消费 `parameters`
- 脚本路径失效时，返回明确错误而非仅有底层 Python 原始报错

### 前端行为

- 已有任务可进入编辑模式并修改脚本路径
- 保存后详情页会刷新为最新配置
- 参数仍可查看和编辑，但文案已降级为“仅存储，不参与当前执行”
- 编辑中切换任务会弹出全局确认框
- 放弃修改后切换到的新任务不会错误进入编辑态
- 历史任务的参数显示不再出现伪参数

### 构建验证

已完成以下构建级校验：

- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`

---

## 当前边界

本轮交付完成后，任务模块的执行边界已经比之前更清晰，但仍保留以下边界：

- `parameters` 仍未定义正式运行时协议
- `working_directory` 仍未纳入任务模型
- 当前仍默认使用现有 Python 执行器，不支持任务级解释器切换
- 不包含脚本移动后的自动发现或自动修复能力

这些内容在当前版本中属于明确的**未纳入范围**，而不是遗漏实现。

---

## 后续可选增强项

如果后续继续迭代，建议按优先级考虑：

1. 为 `parameters` 单独设计正式消费协议
   - 例如 CLI、环境变量、stdin、结构化 JSON 输入中的一种
2. 为任务脚本增加更强的路径健康检查与修复提示
3. 视需要再讨论 `working_directory` 是否有真实业务价值
4. 在任务详情页补充更明确的配置变更记录或最近一次更新时间

---

## 最终结论

本轮“任务脚本路径执行改造”已经完成，原先以“改造方案 / plan”命名的文档已不再适合作为计划文档继续保留。

其核心价值已经从“待实施方案”转变为：

- 本轮问题的真实根因说明
- 已完成交付范围说明
- 执行边界的正式澄清
- 关键实现决策与验证结果归档

因此，本文档作为本次改造的正式实施记录保留。
