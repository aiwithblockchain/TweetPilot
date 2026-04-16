# P0-06-Tauri占位接口清理与命令落地执行计划

## 文档信息

- 版本：v1.0
- 创建日期：2026-04-16
- 适用阶段：TweetPilot V2 / P0 阶段 A 收口后
- 执行对象：后续 AI 开发代理（按本文档逐阶段落地）

---

## 1. 文档目标

本文档用于指导后续 AI 完成“mock-first 架构已就绪”之后的下一步：

1. 清理前端 `tauri.ts` 中的占位抛错接口
2. 补齐 Rust `#[tauri::command]` 命令面
3. 替换 `src-tauri/src/commands/*` 中关键 TODO 为可运行逻辑
4. 完成 tauri 模式下的模块回归与验收

> 本文档不扩大 P0 需求范围。功能边界仍以 [P0-01-需求说明.md](./P0-01-需求说明.md)、[P0-02-场景描述.md](./P0-02-场景描述.md)、[P0-03-接口设计规范.md](./P0-03-接口设计规范.md)、[P0-05-模块抽象开发测试验收执行计划.md](./P0-05-模块抽象开发测试验收执行计划.md) 为准。

---

## 2. 当前基线与问题清单

### 2.1 当前已完成基线

- UI 已完成从页面/组件层直接 `invoke()` 迁移到 `src/services/*`。
- `invoke()` 已收敛到：
  - `src/lib/tauri-api.ts`
  - `src/services/*/tauri.ts`
- 五大模块已有 `mock.ts` 可运行实现。

### 2.2 当前明确占位点（需优先清理）

前端 tauri service 仍有显式抛错：

1. `workspaceService.cloneFromGithub`
   - 文件：[src/services/workspace/tauri.ts](../../src/services/workspace/tauri.ts)
2. `accountService.reconnectAccount`
   - 文件：[src/services/account/tauri.ts](../../src/services/account/tauri.ts)

此外，Settings tauri service 调用了未在 `main.rs` 注册的命令风险点：

- `get_local_bridge_config`
- `update_local_bridge_config`

相关文件：

- [src/services/settings/tauri.ts](../../src/services/settings/tauri.ts)
- [src-tauri/src/main.rs](../../src-tauri/src/main.rs)

### 2.3 Rust 命令层 TODO 密集区

需重点清理（按模块）：

- Workspace：`get_recent_workspaces` / `set_current_workspace` / `get_current_workspace`
  - [src-tauri/src/commands/workspace.rs](../../src-tauri/src/commands/workspace.rs)
- Preferences：持久化读写
  - [src-tauri/src/commands/preferences.rs](../../src-tauri/src/commands/preferences.rs)
- Account：`refresh_all_accounts_status`、personality 持久化、彻底删除联动
  - [src-tauri/src/commands/account.rs](../../src-tauri/src/commands/account.rs)
- Task：`update_task` / `pause_task` / `resume_task` / `execute_task` / `get_execution_history`
  - [src-tauri/src/commands/task.rs](../../src-tauri/src/commands/task.rs)
- Data Blocks：布局、增删、数据读取、刷新
  - [src-tauri/src/commands/data_blocks.rs](../../src-tauri/src/commands/data_blocks.rs)

---

## 3. 执行原则（必须遵守）

1. **命令先闭环**：前端调用的 tauri 命令必须先在 Rust 注册并可执行。
2. **接口不漂移**：优先保持现有 `types.ts` 与 UI 数据结构稳定，字段映射在 `tauri.ts` 处理。
3. **小步替换 TODO**：按模块替换 TODO，避免一次性大改。
4. **优先可验证**：每一阶段都要可通过 `npm run build` + 至少 1 条 UI 黄金路径验证。
5. **不扩 scope**：不引入 P0 之外能力（例如真实 Twitter API）。

---

## 4. 分阶段执行计划（P1 ~ P4）

### 阶段 P1：命令面补齐（先让 tauri 跑通）

**目标**：消除“命令不存在 / 前端占位抛错”。

**任务清单**：

- [ ] 新增 workspace 命令 `clone_from_github` 并注册到 `main.rs`
- [ ] 新增 account 命令 `reconnect_account` 并注册到 `main.rs`
- [ ] 新增 settings 命令：
  - [ ] `get_local_bridge_config`
  - [ ] `update_local_bridge_config`
  并注册到 `main.rs`
- [ ] 前端 `workspace/tauri.ts` 删除 clone 占位抛错，改真实调用
- [ ] 前端 `account/tauri.ts` 删除 reconnect 占位抛错，改真实调用

**验收标准**：

- [ ] 前端 `src/services/*/tauri.ts` 不再存在 `not available yet` 占位抛错
- [ ] 新增命令在 `tauri::generate_handler!` 中可见
- [ ] tauri 模式下调用上述接口不报“command not found”

---

### 阶段 P2：基础持久化落地（Workspace + Preferences + Account personality）

**目标**：替换关键 TODO，让配置可保存/可回读。

**任务清单**：

- [ ] Workspace 持久化：
  - [ ] `current_workspace` 读写
  - [ ] `recent_workspaces` 更新与读取
- [ ] Preferences 持久化：
  - [ ] `save_preferences`
  - [ ] `get_preferences`
  - [ ] LocalBridge 配置读写
- [ ] Account personality 持久化：
  - [ ] `get_account_settings` 读取 personality
  - [ ] `save_account_personality` 写入 personality

**建议存储位置（可统一）**：

- `~/.tweetpilot/config.json`
- `~/.tweetpilot/recent-workspaces.json`
- `~/.tweetpilot/preferences.json`
- `~/.tweetpilot/accounts.json`（或合并进统一存储）

**验收标准**：

- [ ] 设置保存后重启应用可读回
- [ ] 工作区最近记录可读回
- [ ] personality 保存后重新打开可回显

---

### 阶段 P3：行为 TODO 清理（Task + Data Blocks + Account状态）

**目标**：替换核心业务流程中的 TODO，实现可预测状态流。

**任务清单**：

- [ ] Task：
  - [ ] `update_task`
  - [ ] `pause_task`
  - [ ] `resume_task`
  - [ ] `execute_task`（从纯随机调整为可控策略）
  - [ ] `get_execution_history`
- [ ] Data Blocks：
  - [ ] `save_layout`
  - [ ] `add_card`
  - [ ] `delete_card`
  - [ ] `get_card_data`
  - [ ] `refresh_card_data`
- [ ] Account：
  - [ ] `refresh_all_accounts_status`
  - [ ] `delete_account_completely` 与本地关联数据清理策略

**验收标准**：

- [ ] 任务状态变更与历史数据一致
- [ ] 数据积木布局可保存并重载
- [ ] 账号状态刷新可见变化

---

### 阶段 P4：收口与 tauri 模式回归

**目标**：完成“替换位到真实命令”的最终收口。

**任务清单**：

- [ ] 全量检查 `src/services/*/tauri.ts` 无占位抛错
- [ ] 对照 `main.rs` 检查前端调用命令均已注册
- [ ] 执行构建：`npm run build`
- [ ] 执行 tauri 模式关键场景回归（见第 6 节）
- [ ] 更新文档与代码一致性说明

**最终验收标准**：

- [ ] tauri 模式可覆盖 P0 阶段 A 核心路径
- [ ] 关键命令无 “TODO-only shell”
- [ ] 无命令缺失错误 / 无占位抛错

---

## 5. 关键文件清单（执行时优先关注）

前端：

- [src/services/workspace/tauri.ts](../../src/services/workspace/tauri.ts)
- [src/services/account/tauri.ts](../../src/services/account/tauri.ts)
- [src/services/settings/tauri.ts](../../src/services/settings/tauri.ts)
- [src/services/task/tauri.ts](../../src/services/task/tauri.ts)
- [src/services/data-blocks/tauri.ts](../../src/services/data-blocks/tauri.ts)

Rust：

- [src-tauri/src/main.rs](../../src-tauri/src/main.rs)
- [src-tauri/src/commands/workspace.rs](../../src-tauri/src/commands/workspace.rs)
- [src-tauri/src/commands/preferences.rs](../../src-tauri/src/commands/preferences.rs)
- [src-tauri/src/commands/account.rs](../../src-tauri/src/commands/account.rs)
- [src-tauri/src/commands/task.rs](../../src-tauri/src/commands/task.rs)
- [src-tauri/src/commands/data_blocks.rs](../../src-tauri/src/commands/data_blocks.rs)

---

## 6. 回归测试清单（tauri 模式）

### 6.1 通用检查（每阶段必做）

- [ ] `npm run build` 通过
- [ ] 无 `command not found`
- [ ] 无前端占位抛错

### 6.2 模块核心场景

Workspace：
- [ ] 选择目录并进入主界面
- [ ] 最近工作区可读写

Settings：
- [ ] 系统偏好保存并回读
- [ ] LocalBridge 配置保存并回读

Account：
- [ ] 映射、刷新状态、reconnect 行为可执行
- [ ] personality 保存并回显

Task：
- [ ] 创建/更新/删除任务
- [ ] 暂停/恢复/执行与历史一致

Data Blocks：
- [ ] 添加/删除卡片
- [ ] 拖拽布局保存并回读
- [ ] 卡片刷新后时间戳与数据变化可见

---

## 7. 风险与约束

1. **字段命名不一致风险**：Rust snake_case 与前端 camelCase 映射需严格在 `tauri.ts` 统一处理。
2. **持久化并发写风险**：文件写入建议采用“读-改-写 + 原子替换”策略。
3. **随机执行结果可测性风险**：`execute_task` 若继续随机，需提供测试可控开关或确定性策略。
4. **删除联动风险**：`delete_account_completely` 涉及数据积木关联删除时，需先定义删除边界，避免误删。

---

## 8. 每阶段汇报模板（强制）

```markdown
## 阶段
- [P1/P2/P3/P4]

## 本次完成
- [事项1]
- [事项2]

## 修改文件
- [路径1]
- [路径2]

## 测试结果
- 构建：通过/失败
- tauri命令验证：通过/失败（列出命令）
- 场景回归：通过/失败（列出场景）

## 遗留问题
- [问题1]
- [问题2]

## 下一步
- [下一阶段计划]
```

---

## 9. 里程碑定义

- **M5（命令面闭环）**：P1 完成，前端占位抛错清零
- **M6（基础持久化）**：P2 完成，关键配置可回读
- **M7（行为闭环）**：P3 完成，Task/DataBlocks/Account 状态流可预测
- **M8（tauri可用）**：P4 完成，tauri 模式通过核心回归

---

## 10. P0-06 完成总结

### 10.1 已完成

#### P1 命令面补齐

- 已补齐并接通以下 Tauri 命令链路：
  - `clone_from_github`
  - `reconnect_account`
  - `get_local_bridge_config`
  - `update_local_bridge_config`
- 前端 `src/services/*/tauri.ts` 中本轮计划涉及的占位抛错已清理完成。
- `src-tauri/src/main.rs` 已完成相关命令注册，前端服务调用与 Rust 命令面保持一致。

#### P2 基础持久化落地

- Workspace：已实现 `current_workspace` 与 `recent_workspaces` 的读写与更新。
- Preferences：已实现系统偏好与 Local Bridge 配置读写。
- Account：已实现 personality 保存与读取。
- 持久化数据已统一落到 `~/.tweetpilot/` 目录下的 JSON 文件。

#### P3 行为 TODO 清理

- Task：创建、更新、删除、暂停、恢复、执行、历史读取已形成真实状态链路。
- Data Blocks：布局保存、卡片新增删除、卡片数据读取与刷新已接通。
- Account：状态刷新、重新连接、彻底删除的本地行为已落地。
- 前端关键页面已从“假保存/假刷新”切换为重新读取 Tauri 后端状态。

#### P4 收口与回归

- 已完成 `npm run build` 构建通过。
- 已产出并执行 `docs/v2/p0/P0-06-P4-Tauri模式快速回归测试清单.md`。
- 你刚刚确认该测试清单内项目已测试通过，可作为本阶段人工验收结果。
- 启动工作区逻辑已调整为：启动先回到起始页，再由用户主动选择工作目录进入主界面。

### 10.2 已验证

以下能力已通过本轮代码实现加人工回归验证：

- 任务执行后列表状态、执行结果、详情统计、历史记录保持一致。
- 任务参数保存后重新打开仍能回显。
- 定时任务 pause / resume 状态切换正常。
- 数据积木新增、删除、拖拽排序、刷新后展示正常。
- 数据积木布局刷新后不回弹。
- preferences / local bridge config 可保存并回读。
- account personality 可保存并回读。
- current workspace / recent workspaces 可更新。
- Tauri 模式下核心路径不再依赖占位抛错才能运行。

### 10.3 本次收尾清理

本轮收尾已额外完成：

- 删除 `src/App.tsx` 中工作目录切换调试日志。
- 删除 `src-tauri/src/commands/workspace.rs` 中目录选择调试输出。
- 删除 `src-tauri/src/commands/account.rs` 中账号状态验证调试输出。
- 为 workspace service 增加 `clearCurrentWorkspace()` 正式接口，避免仅靠前端局部状态绕过持久化。

### 10.4 当前遗留

以下内容不阻塞 P0-06 完成，但仍属于后续可继续优化项：

- 仍保留 `mock`/`tauri` 双实现结构，这是架构刻意保留，不视为残留垃圾代码。
- `src/services/runtime.ts` 仍支持 `mock | tauri` 切换，这是为了后续开发与隔离测试，不建议在本轮删除。
- 当前以人工回归为主，尚未补齐自动化测试用例。
- `dev-with-log.sh` 中保留了较完整的开发诊断日志能力，后续可按团队需要继续精简。

### 10.5 结论

P0-06「Tauri 占位接口清理与命令落地」可以认定为已完成。

更准确地说：

- 计划范围内的命令补齐、持久化落地、行为闭环、Tauri 回归已完成。
- 测试清单内项目已人工验收通过。
- 当前阶段应从“继续补接口”转入“文档同步 / 自动化补强 / 下一阶段开发”。
