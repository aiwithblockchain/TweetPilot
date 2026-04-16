# TweetPilot P0 工程搭建方案

## 文档信息

- 版本：3.0
- 创建日期：2026-04-15
- 路径：docs/v2/p0/ENGINEERING-01-工程搭建.md
- 变更说明：在 Tauri 架构基础上，补充 Service 层分层与 Mock-first 实施规范

---

## 1. 技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 桌面框架 | **Tauri 2.x** | Rust 后端。包体和内存占用优于 Electron |
| 前端框架 | **React 19 + TypeScript** | 组件化 UI，类型安全 |
| 构建工具 | **Vite** | Tauri 官方推荐，HMR 快 |
| 样式方案 | **Tailwind CSS 4.x** | 原子化 CSS，与 shadcn/ui 配合 |
| 组件库 | **shadcn/ui** (Radix) | 可定制、可组合、按需引入 |
| 图标 | **Lucide React** | 统一图标语言 |
| 图表 | **Recharts** | 数据积木图表组件 |
| 拖拽 | **dnd-kit** | 数据积木卡片拖拽排序 |
| 动效 | **Framer Motion** | 页面过渡、微动效 |
| 路由 | **React Router 7** | 页面导航 |
| 状态管理 | **Zustand** | 轻量，TypeScript 友好 |
| Tauri 后端 | **Rust** | 文件系统、Python 进程管理、LocalBridge 通信 |
| 字体 | **@fontsource/inter** | Inter 字体本地加载 |

---

## 2. 架构分层（当前推荐）

### 2.1 分层结构

```text
UI Components
  ↓
Service Interface (TypeScript)
  ↓
Mock Implementation / Tauri Implementation
  ↓
Tauri Commands
  ↓
Rust Services + Store + External IO
```

### 2.2 分层职责

1. **UI Components**
   - 只负责展示与交互
   - 不直接调用 `invoke()`

2. **Service Interface**
   - 对 UI 暴露稳定接口
   - 隔离后端变化

3. **Mock / Tauri 实现**
   - Mock：内存假数据，支撑前期流程验证
   - Tauri：真实后端调用，落地生产能力

4. **Tauri Commands**
   - 前后端边界层
   - 统一参数和错误返回

5. **Rust Services**
   - 业务逻辑、持久化、进程管理、桥接通信

---

## 3. 项目结构（推荐）

```text
tweetpilot/
├── src-tauri/                        # Rust 后端
│   ├── src/
│   │   ├── main.rs                   # Tauri 入口
│   │   ├── lib.rs                    # 命令注册
│   │   ├── commands/                 # Tauri Commands
│   │   │   ├── mod.rs
│   │   │   ├── workspace.rs
│   │   │   ├── account.rs
│   │   │   ├── task.rs
│   │   │   ├── data_blocks.rs
│   │   │   └── settings.rs
│   │   ├── services/                 # Rust 业务逻辑
│   │   │   ├── mod.rs
│   │   │   ├── task_runner.rs
│   │   │   ├── scheduler.rs
│   │   │   ├── bridge_client.rs
│   │   │   └── store.rs
│   │   └── models/                   # Rust 数据模型
│   │       ├── mod.rs
│   │       ├── workspace.rs
│   │       ├── account.rs
│   │       ├── task.rs
│   │       ├── data_blocks.rs
│   │       └── settings.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
│
├── src/                              # React 前端
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   ├── pages/
│   ├── styles/
│   ├── hooks/
│   ├── stores/
│   ├── types/
│   ├── services/                     # 关键：前端服务层
│   │   ├── workspace/
│   │   │   ├── types.ts
│   │   │   ├── mock.ts
│   │   │   ├── tauri.ts
│   │   │   └── index.ts
│   │   ├── account/
│   │   │   ├── types.ts
│   │   │   ├── mock.ts
│   │   │   ├── tauri.ts
│   │   │   └── index.ts
│   │   ├── task/
│   │   │   ├── types.ts
│   │   │   ├── mock.ts
│   │   │   ├── tauri.ts
│   │   │   └── index.ts
│   │   ├── data-blocks/
│   │   │   ├── types.ts
│   │   │   ├── mock.ts
│   │   │   ├── tauri.ts
│   │   │   └── index.ts
│   │   ├── settings/
│   │   │   ├── types.ts
│   │   │   ├── mock.ts
│   │   │   ├── tauri.ts
│   │   │   └── index.ts
│   │   ├── mock-data/
│   │   └── index.ts
│   └── lib/
│       ├── tauri-api.ts              # 底层 invoke 封装（不直连 UI）
│       ├── format.ts
│       └── utils.ts
│
├── public/
├── package.json
└── docs/
```

---

## 4. 通信规范

## 4.1 前端调用规则

### ✅ 推荐

```typescript
import { taskService } from '@/services'

const tasks = await taskService.getTasks()
```

### ❌ 禁止（在组件中）

```typescript
import { invoke } from '@tauri-apps/api/core'

const tasks = await invoke('get_tasks')
```

解释：
- 组件直接 `invoke` 会把 UI 和后端绑死
- 后续 mock/真实切换会非常痛苦

## 4.2 `src/lib/tauri-api.ts` 的定位

`tauri-api.ts` 是 **Tauri 实现层的底层工具**，不是页面组件的直接依赖。

它应该只被：
- `src/services/*/tauri.ts`
引用。

---

## 5. 模块与命令映射

| 模块 | 前端服务 | Tauri Commands 文件 |
|------|----------|---------------------|
| Workspace | `workspaceService` | `workspace.rs` |
| Account | `accountService` | `account.rs` |
| Task | `taskService` | `task.rs` |
| Data Blocks | `dataBlocksService` | `data_blocks.rs` |
| Settings | `settingsService` | `settings.rs` |

---

## 6. 初始化步骤（从零搭建时）

> 如果项目已存在可跳过，本节仅作为基线参考。

### 6.1 创建 Tauri + React 项目

```bash
npm create vite@latest . -- --template react-ts
npm install @tauri-apps/cli@latest @tauri-apps/api@latest
npx tauri init
```

### 6.2 安装前端依赖

```bash
npm install react-router-dom zustand
npm install lucide-react recharts framer-motion
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install clsx tailwind-merge date-fns
npm install @fontsource/inter
npm install -D tailwindcss @tailwindcss/vite
npx shadcn@latest init
```

### 6.3 Rust 依赖（核心）

```toml
[dependencies]
tauri = { version = "2", features = ["shell-open"] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
cron = "0.12"
```

---

## 7. 开发流程（当前阶段）

### 阶段 1：接口冻结
- 完成 `P0-03` 和 `NEXT_PHASE_MODULE_ABSTRACTION` 对齐

### 阶段 2：Mock-first 服务层
- 完成 `src/services/*/types.ts + mock.ts`
- UI 全部接入 service interface

### 阶段 3：真实实现替换
- 完成 `src/services/*/tauri.ts`
- 对接 Rust commands
- 逐模块切换 mock → tauri

### 阶段 4：联调与测试
- 场景回归
- 错误路径验证
- 文档状态更新

---

## 8. 关键约束

1. 前端不直接操作文件系统
2. 前端不直接执行 Python
3. 前端不直接访问 LocalBridge
4. 所有系统级操作必须通过 Tauri Commands
5. 所有 UI 页面必须通过 service interface 调业务能力

---

## 9. 文档版本

- 版本：3.0
- 创建日期：2026-04-15
- 最后更新：2026-04-16（补充 Service 层与 Mock-first 分层规范）
