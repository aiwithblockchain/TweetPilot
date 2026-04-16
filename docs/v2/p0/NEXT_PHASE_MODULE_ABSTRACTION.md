# 下一阶段：模块抽象、接口对齐与 Mock 实现

## 文档定位

本文档用于指导 **UI 完成之后** 的下一阶段开发工作。

它不是新的需求文档，也不是新的工程文档，而是对以下文档的落地执行说明：

- `docs/v2/p0/P0-01-需求说明.md`
- `docs/v2/p0/P0-02-场景描述.md`
- `docs/v2/p0/P0-03-接口设计规范.md`
- `docs/v2/p0/P0-04-阶段A开发计划.md`
- `docs/v2/p0/ENGINEERING-01-工程搭建.md`

换句话说，这份文档回答的是一件事：

**在 UI 已经基本成型之后，下一步怎样把系统整理成可持续开发的模块、接口和 Mock 架构。**

---

## 一、工作目标

下一阶段的核心目标有 3 个：

1. **把 UI 和具体实现解耦**
   - UI 不再直接依赖某个临时实现
   - UI 只依赖稳定的前端服务接口

2. **把模块边界和接口契约定下来**
   - 先明确模块职责
   - 再定义接口
   - 然后让 Mock 实现和真实实现都遵守同一份契约

3. **用内存中的假数据跑通完整流程**
   - 应用启动时加载假数据
   - 用户所有操作都只修改内存里的假数据
   - 不碰真实文件系统、真实 LocalBridge、真实 Python 执行

这个阶段不是“做真功能”，而是把工程结构整理干净，方便后续多人和多个 AI 并行开发。

---

## 二、与其它文档的关系

### 1. 需求来源
- 需求范围以 `P0-01-需求说明.md` 为准
- 用户流程以 `P0-02-场景描述.md` 为准

### 2. 接口来源
- 模块和接口契约以 `P0-03-接口设计规范.md` 为准
- 本文档只描述如何执行，不新增需求

### 3. 工程来源
- 技术栈、目录结构、前后端通信方式以 `ENGINEERING-01-工程搭建.md` 为准

### 4. 开发顺序来源
- 阶段拆分和优先级以 `P0-04-阶段A开发计划.md` 为准

---

## 三、本阶段的架构原则

### 1. 分层原则

本阶段统一采用如下分层：

```text
UI 组件
  ↓
前端 Service Interface
  ↓
Mock 实现 / Tauri 实现
  ↓
Tauri Commands
  ↓
Rust 业务逻辑
```

说明：

- **UI 组件** 只依赖前端 service interface
- **Mock 实现** 用于当前阶段，支撑 UI 演示和交互验证
- **Tauri 实现** 是后续真实开发阶段的适配层
- **Tauri Commands** 是前端和 Rust 后端的通信边界

这意味着：

- 当前阶段先做 `Mock 实现`
- 后续真实逻辑上线时，不改 UI，优先替换 service 的底层实现

### 2. Mock 优先原则

在这个阶段，所有模块必须先提供 Mock 版本：

- 应用启动时加载假数据
- 所有读操作从内存读取
- 所有写操作只修改内存中的数据
- 刷新页面后可以重新初始化为默认假数据

### 3. 接口先于实现

开发顺序固定为：

```text
场景确认 → 模块拆分 → 接口定义 → Mock 实现 → UI 接入 → 真实实现替换
```

不要反过来。

如果先写具体逻辑，再回头抽象接口，最后通常会得到一堆只能解释过去、不能指导未来的“接口”。这种东西很常见，也很浪费时间。

---

## 四、本阶段要抽象的核心模块

依据 P0 文档，阶段 A 需要抽象 5 个核心模块：

1. Workspace Management
2. Account Management
3. Task Management
4. Data Blocks
5. Settings Management

注意：

- **Data Blocks 是完整模块，不是单纯的卡片布局模块**
- 卡片布局只是 Data Blocks 的一部分

---

## 五、建议目录结构

基于 `ENGINEERING-01-工程搭建.md`，前端建议新增如下目录：

```text
src/
├── services/
│   ├── workspace/
│   │   ├── types.ts
│   │   ├── mock.ts
│   │   ├── tauri.ts
│   │   └── index.ts
│   ├── account/
│   │   ├── types.ts
│   │   ├── mock.ts
│   │   ├── tauri.ts
│   │   └── index.ts
│   ├── task/
│   │   ├── types.ts
│   │   ├── mock.ts
│   │   ├── tauri.ts
│   │   └── index.ts
│   ├── data-blocks/
│   │   ├── types.ts
│   │   ├── mock.ts
│   │   ├── tauri.ts
│   │   └── index.ts
│   ├── settings/
│   │   ├── types.ts
│   │   ├── mock.ts
│   │   ├── tauri.ts
│   │   └── index.ts
│   ├── mock-data/
│   │   ├── workspaces.ts
│   │   ├── accounts.ts
│   │   ├── tasks.ts
│   │   ├── data-blocks.ts
│   │   └── settings.ts
│   └── index.ts
└── lib/
    └── tauri-api.ts
```

说明：

- `types.ts` 定义领域类型和 service interface
- `mock.ts` 实现内存版假数据逻辑
- `tauri.ts` 封装真实 Tauri 调用
- `index.ts` 暴露统一入口
- `mock-data/` 负责默认假数据初始化

---

## 六、模块职责与接口范围

以下接口范围与 `P0-01`、`P0-02`、`P0-04` 保持一致。

### 1. Workspace Management

**职责**：
- 选择本地工作目录
- 从 GitHub 克隆项目作为工作目录
- 维护最近使用历史
- 读取和设置当前工作目录
- 在新窗口中打开工作目录

**前端接口建议**：

```typescript
export interface IWorkspaceService {
  selectLocalDirectory(): Promise<string | null>
  cloneFromGithub(url: string, localPath: string): Promise<void>
  getRecentWorkspaces(): Promise<WorkspaceHistory[]>
  setCurrentWorkspace(path: string): Promise<void>
  getCurrentWorkspace(): Promise<string | null>
  openWorkspaceInNewWindow(path?: string): Promise<void>
}
```

**本阶段 Mock 约束**：
- `selectLocalDirectory()` 直接返回假路径
- `cloneFromGithub()` 模拟延迟和成功结果，不执行真实 git clone
- `getRecentWorkspaces()` 返回内存中的历史记录
- `openWorkspaceInNewWindow()` 只模拟成功，不创建真实窗口

---

### 2. Account Management

**职责**：
- 查询可映射账号
- 建立和删除账号映射
- 验证账号状态
- 重新连接掉线账号
- 读取和保存账号设置
- 彻底删除账号相关本地数据

**前端接口建议**：

```typescript
export interface IAccountService {
  getAvailableAccounts(): Promise<AvailableAccount[]>
  getMappedAccounts(): Promise<TwitterAccount[]>
  mapAccount(screenName: string): Promise<TwitterAccount | null>
  deleteAccountMapping(screenName: string): Promise<void>
  verifyAccountStatus(screenName: string): Promise<AccountStatus>
  refreshAllAccountsStatus(): Promise<void>
  reconnectAccount(screenName: string): Promise<void>
  getAccountSettings(screenName: string): Promise<AccountSettings>
  saveAccountPersonality(screenName: string, personality: string): Promise<void>
  unlinkAccount(screenName: string): Promise<void>
  deleteAccountCompletely(screenName: string): Promise<void>
}
```

**本阶段 Mock 约束**：
- 不连接真实 LocalBridge
- `getAvailableAccounts()` 从假数据返回可映射账号
- `verifyAccountStatus()`、`refreshAllAccountsStatus()` 模拟在线/离线变化
- `reconnectAccount()` 只修改内存状态
- `deleteAccountCompletely()` 只删除内存中的账号和相关假数据

---

### 3. Task Management

**职责**：
- 创建、更新、删除任务
- 暂停和恢复任务
- 立即执行任务
- 查看任务详情、执行历史和统计

**前端接口建议**：

```typescript
export interface ITaskService {
  getTasks(): Promise<Task[]>
  getTaskDetail(taskId: string): Promise<TaskDetail>
  createTask(config: TaskConfig): Promise<Task>
  updateTask(taskId: string, config: TaskConfig): Promise<void>
  deleteTask(taskId: string): Promise<void>
  pauseTask(taskId: string): Promise<void>
  resumeTask(taskId: string): Promise<void>
  executeTask(taskId: string): Promise<ExecutionResult>
  getExecutionHistory(taskId: string, limit?: number): Promise<ExecutionRecord[]>
  getTaskStats(taskId: string): Promise<TaskStats>
}
```

**本阶段 Mock 约束**：
- 不执行真实 Python
- `executeTask()` 返回模拟输出、执行耗时、成功或失败结果
- `pauseTask()` 和 `resumeTask()` 只更新内存状态
- 历史记录和统计都来自内存中的假执行记录

---

### 4. Data Blocks

**职责**：
- 管理数据积木布局
- 添加和删除卡片
- 获取卡片数据
- 刷新卡片数据
- 维护数据缓存

**前端接口建议**：

```typescript
export interface IDataBlocksService {
  getLayout(): Promise<CardLayout[]>
  saveLayout(layout: CardLayout[]): Promise<void>
  addCard(cardType: CardType, config?: CardConfig): Promise<string>
  deleteCard(cardId: string): Promise<void>
  getCardData(cardId: string): Promise<CardData>
  refreshCardData(cardId: string): Promise<CardData>
}
```

**本阶段 Mock 约束**：
- 卡片类型至少覆盖 P0 阶段 A 的 6 种预定义类型
- `getCardData()` 从假数据中组装展示结果
- `refreshCardData()` 不访问真实 Twitter API，只刷新内存中的时间戳和假结果
- 布局和缓存都保存在内存中

---

### 5. Settings Management

**职责**：
- 管理系统级设置
- 管理语言、主题等偏好
- 管理和读取 LocalBridge 相关配置（如果当前 UI 仍需要）

**前端接口建议**：

```typescript
export interface ISettingsService {
  getSettings(): Promise<SystemSettings>
  updateSettings(settings: Partial<SystemSettings>): Promise<void>
  getLocalBridgeConfig(): Promise<LocalBridgeConfig>
  updateLocalBridgeConfig(config: LocalBridgeConfig): Promise<void>
}
```

**本阶段 Mock 约束**：
- 所有设置保存在内存中
- 修改设置后立即影响 UI
- 不写入真实磁盘文件

---

## 七、Mock 数据要求

### 1. 数据来源
假数据可以来自两种方式：

1. 写在代码中
2. 从 `src/services/mock-data/` 中加载

两种方式都可以，但必须满足一个原则：

**应用启动时能一次性初始化整个界面所需状态。**

### 2. 数据覆盖要求

假数据必须覆盖这些场景：

- 空状态
- 正常状态
- 长文本
- 多账号
- 离线账号
- 执行成功任务
- 执行失败任务
- 多种数据卡片类型
- 最近使用工作目录

### 3. 状态修改要求

用户操作产生的数据变化，只改内存中的数据：

- 映射账号，只改内存列表
- 删除任务，只从内存删除
- 更新设置，只改当前运行态
- 拖拽卡片，只改当前布局数组

### 4. 异步行为要求

所有接口都返回 Promise，并模拟真实异步感受：

- 读取类操作：50ms - 150ms
- 写入类操作：100ms - 250ms
- 执行类操作：300ms - 1500ms

### 5. 错误模拟要求

每个模块至少支持少量可控错误：

- 账号不存在
- 任务不存在
- 配置非法
- LocalBridge 未连接（Mock 场景）
- 执行失败

这样 UI 才能顺手把错误态一起做完，不用等真实后端接入后再返工。

---

## 八、本阶段禁止事项

在 Mock 阶段，以下事情不要提前做：

1. 不接真实 Twitter API
2. 不接真实 LocalBridge
3. 不执行真实 Python 脚本
4. 不做真实文件持久化
5. 不因为未来可能会复杂，就过早抽象一堆用不到的框架

简单说：

**现在的目标是把接口和流程跑通，不是提前把生产系统做一半。**

---

## 九、推荐实施顺序

### 第一步：补齐并冻结接口定义
按模块完成：
- `types.ts`
- 领域数据类型
- service interface

### 第二步：补齐默认假数据
按模块完成：
- workspace 假数据
- account 假数据
- task 假数据
- data blocks 假数据
- settings 假数据

### 第三步：完成 Mock 实现
按模块完成：
- `mock.ts`
- 内存状态初始化
- CRUD 和执行流程
- 错误模拟

### 第四步：让 UI 全部改为走 service interface
把组件里直接调用 `invoke()` 的地方，统一替换为：

```typescript
import { accountService } from '@/services'
```

而不是在组件里直接写：

```typescript
invoke('get_mapped_accounts')
```

### 第五步：验证所有核心场景
按照 `P0-02-场景描述.md` 的场景逐条验证：
- 工作目录场景
- 账号映射和状态场景
- 任务创建和执行场景
- 数据积木场景
- 设置修改场景

### 第六步：准备 Tauri 实现替换点
在每个模块下预留 `tauri.ts`，但暂时不急着写全真实逻辑。

先把替换位留好，后面才能顺滑切换。

---

## 十、阶段完成标准

当以下条件全部满足时，认为本阶段完成：

- 所有核心模块都有清晰的 service interface
- 所有核心模块都有 Mock 实现
- 所有 UI 都通过 service interface 访问数据
- 所有主要用户流程都能用假数据完整跑通
- 假数据覆盖正常态、空态、错误态
- 后续真实实现只需要替换底层实现，不需要重写 UI

---

## 十一、下一阶段衔接方式

本阶段结束后，进入“真实实现替换”阶段：

1. 先实现对应 Tauri Commands
2. 再实现 `tauri.ts`
3. 然后逐模块把运行环境从 `mock` 切换到 `tauri`
4. 最后做集成测试和端到端验证

推荐切换顺序：

1. Workspace
2. Settings
3. Account
4. Task
5. Data Blocks

原因很简单：

- Workspace 和 Settings 依赖最少，先落地最稳
- Account 接上以后，Task 才能更真实
- Data Blocks 最后接真实数据，返工成本最低

---

## 十二、给后续 AI 的明确要求

后续 AI 在执行本阶段工作时，必须遵守以下规则：

1. 不能跳过接口定义，直接把 UI 接到某个临时实现上
2. 不能把 Data Blocks 简化成只有卡片布局
3. 不能在组件里继续散落 `invoke()` 调用
4. 不能把 Mock 写成一次性死代码，必须支持内存状态变化
5. 不能新增 P0 之外的功能范围

目标很明确：

**把 UI 变成一个稳定的壳，把接口变成可靠的边界，把 Mock 变成真实实现的替身。**

这一步做扎实，后面开发会快很多。
