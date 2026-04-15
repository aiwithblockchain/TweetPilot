# TweetPilot P0 工程搭建方案

## 文档信息

- 版本：2.0
- 创建日期：2026-04-15
- 路径：docs/v2/p0/ENGINEERING-01-工程搭建.md
- 变更说明：v1.0 基于 Electron，v2.0 迁移至 Tauri (Rust 后端 + React 前端)

---

## 1. 技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 桌面框架 | **Tauri 2.x** | Rust 后端。包体 ~10MB、内存 ~30MB，远优于 Electron |
| 前端框架 | **React 19 + TypeScript** | 组件化 UI，类型安全 |
| 构建工具 | **Vite** | Tauri 官方推荐，HMR 快 |
| 样式方案 | **Tailwind CSS 4.x** | 原子化 CSS，与 shadcn/ui 配合 |
| 组件库 | **shadcn/ui** (Radix) | 可定制、可组合、按需引入 |
| 图标 | **Lucide React** | shadcn/ui 默认图标库 |
| 图表 | **Recharts** | React 生态主流，轻量 |
| 拖拽 | **dnd-kit** | 数据积木卡片拖拽排序 |
| 动效 | **Framer Motion** | 页面过渡、微动效 |
| 路由 | **React Router 7** | 页面导航 |
| 状态管理 | **Zustand** | 轻量，TypeScript 友好 |
| Tauri 后端 | **Rust** | 文件系统、Python 进程管理、LocalBridge 通信 |
| 字体 | **@fontsource/inter** | Inter 字体本地加载 |

---

## 2. 项目结构

```
tweetpilot/
├── src-tauri/                        # Rust 后端
│   ├── src/
│   │   ├── main.rs                   # Tauri 入口
│   │   ├── lib.rs                    # 命令注册
│   │   ├── commands/                 # Tauri Commands（前端调用）
│   │   │   ├── mod.rs
│   │   │   ├── workspace.rs          # 工作目录管理
│   │   │   ├── account.rs            # 账号管理
│   │   │   ├── task.rs               # 任务管理
│   │   │   └── bridge.rs             # LocalBridge 通信
│   │   ├── services/                 # 业务逻辑
│   │   │   ├── mod.rs
│   │   │   ├── task_runner.rs        # Python 脚本执行器
│   │   │   ├── scheduler.rs          # 定时任务调度
│   │   │   └── store.rs              # 本地 JSON 持久化
│   │   └── models/                   # 数据模型
│   │       ├── mod.rs
│   │       ├── task.rs
│   │       └── account.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
│
├── src/                              # React 前端
│   ├── main.tsx                      # React 入口
│   ├── App.tsx                       # 根组件（路由 + 布局）
│   │
│   ├── styles/
│   │   ├── globals.css               # Tailwind 入口 + CSS 变量
│   │   └── themes.css                # dark/light 主题定义
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui 组件（自动生成）
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   └── scroll-area.tsx
│   │   │
│   │   ├── layout/                   # 布局组件
│   │   │   ├── app-header.tsx        # 顶部栏
│   │   │   ├── app-sidebar.tsx       # 侧边栏
│   │   │   └── app-layout.tsx        # 整体布局容器
│   │   │
│   │   ├── shared/                   # 业务共享组件
│   │   │   ├── account-selector.tsx
│   │   │   ├── status-badge.tsx
│   │   │   └── empty-state.tsx
│   │   │
│   │   ├── task/                     # 任务管理组件
│   │   │   ├── task-list.tsx
│   │   │   ├── task-detail.tsx
│   │   │   ├── task-card.tsx
│   │   │   └── create-task-dialog.tsx
│   │   │
│   │   ├── data-blocks/              # 数据积木组件
│   │   │   ├── blocks-grid.tsx       # 卡片网格
│   │   │   ├── block-card.tsx        # 通用卡片容器
│   │   │   ├── add-block-dialog.tsx
│   │   │   └── cards/                # 各类型卡片
│   │   │       ├── account-basic-data.tsx
│   │   │       ├── account-interaction-data.tsx
│   │   │       ├── latest-tweets.tsx
│   │   │       ├── tweet-distribution.tsx
│   │   │       └── task-execution-stats.tsx
│   │   │
│   │   └── settings/                 # 设置组件
│   │       ├── settings-layout.tsx
│   │       ├── general-settings.tsx
│   │       ├── account-settings.tsx
│   │       └── about-settings.tsx
│   │
│   ├── hooks/                        # 自定义 Hooks
│   │   ├── use-theme.ts
│   │   ├── use-tasks.ts
│   │   ├── use-data-blocks.ts
│   │   └── use-accounts.ts
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── task-store.ts
│   │   ├── block-store.ts
│   │   ├── account-store.ts
│   │   └── ui-store.ts
│   │
│   ├── lib/                          # 工具函数
│   │   ├── tauri-api.ts              # Tauri invoke 封装
│   │   ├── format.ts                 # 日期/数字格式化
│   │   └── utils.ts                  # cn() 等通用工具
│   │
│   └── types/                        # TypeScript 类型定义
│       ├── task.ts
│       ├── account.ts
│       └── data-block.ts
│
├── public/
│   └── logo.svg
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── components.json                   # shadcn/ui 配置
└── docs/
```

---

## 3. 初始化步骤

### 3.1 创建 Tauri + React 项目

```bash
# 确保已装 Rust 和 Tauri CLI
# cargo install tauri-cli

# 创建项目（在项目根目录）
npm create vite@latest . -- --template react-ts
npm install @tauri-apps/cli@latest @tauri-apps/api@latest
npx tauri init
```

Tauri init 配置：
- App name: TweetPilot
- Window title: TweetPilot
- Dev server URL: http://localhost:5173
- Frontend dir: ../

### 3.2 安装前端依赖

```bash
# Tailwind CSS v4
npm install -D tailwindcss @tailwindcss/vite

# shadcn/ui（自动处理 Radix 依赖）
npx shadcn@latest init

# 核心依赖
npm install react-router-dom zustand
npm install lucide-react recharts framer-motion
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# 工具
npm install clsx tailwind-merge date-fns
npm install @fontsource/inter
```

### 3.3 shadcn/ui 组件

```bash
npx shadcn@latest add button input card dialog dropdown-menu tabs badge
npx shadcn@latest add tooltip select separator scroll-area toast
npx shadcn@latest add avatar popover sheet
```

### 3.4 Rust 依赖

`src-tauri/Cargo.toml` 核心依赖：

```toml
[dependencies]
tauri = { version = "2", features = ["shell-open"] }
tauri-plugin-dialog = "2"      # 文件选择对话框
tauri-plugin-fs = "2"          # 文件系统
tauri-plugin-shell = "2"       # 执行 Python 进程
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
cron = "0.12"                   # cron 表达式解析
```

---

## 4. Tailwind 主题配置

Design Token 来源：`DESIGN-02-色彩体系.md` 和 `DESIGN-03-排版与间距.md`。

### 4.1 globals.css

```css
@import "tailwindcss";
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/inter/700.css";

@theme {
  /* 品牌色 (DESIGN-02 §2.1) */
  --color-primary-50: #F5F3FF;
  --color-primary-100: #EDE9FE;
  --color-primary-200: #DDD6FE;
  --color-primary-300: #C4B5FD;
  --color-primary-400: #A78BFA;
  --color-primary-500: #8B5CF6;
  --color-primary-600: #7C3AED;
  --color-primary-700: #6D28D9;
  --color-primary-800: #5B21B6;
  --color-primary-900: #4C1D95;

  /* Accent (DESIGN-02 §2.2) */
  --color-accent-400: #60A5FA;
  --color-accent-500: #3B82F6;
  --color-accent-600: #2563EB;

  /* 功能色 (DESIGN-02 §2.4) */
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-info: #3B82F6;

  /* 字体 (DESIGN-03 §1.1) */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "SF Mono", monospace;

  /* 圆角 (DESIGN-03 §3) */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;

  /* 阴影 (DESIGN-03 §4) */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04);

  /* 图表色 (DESIGN-02 §4) */
  --color-chart-1: #8B5CF6;
  --color-chart-2: #3B82F6;
  --color-chart-3: #22C55E;
  --color-chart-4: #F59E0B;
  --color-chart-5: #EF4444;
  --color-chart-6: #06B6D4;
}

/* Dark 主题（默认） */
:root {
  --background: #0F1117;
  --foreground: #E8E9ED;
  --card: #161822;
  --card-foreground: #E8E9ED;
  --popover: #161822;
  --popover-foreground: #E8E9ED;
  --primary: #8B5CF6;
  --primary-foreground: #0F1117;
  --secondary: #1E2030;
  --secondary-foreground: #E8E9ED;
  --muted: #1E2030;
  --muted-foreground: #6B6D80;
  --accent: #1E2030;
  --accent-foreground: #A78BFA;
  --destructive: #EF4444;
  --destructive-foreground: #FFFFFF;
  --border: #282A3A;
  --input: #282A3A;
  --ring: #8B5CF6;
}

/* Light 主题 */
[data-theme="light"] {
  --background: #FFFFFF;
  --foreground: #0F172A;
  --card: #FFFFFF;
  --card-foreground: #0F172A;
  --popover: #FFFFFF;
  --popover-foreground: #0F172A;
  --primary: #6D5BF6;
  --primary-foreground: #FFFFFF;
  --secondary: #F8FAFC;
  --secondary-foreground: #0F172A;
  --muted: #F8FAFC;
  --muted-foreground: #64748B;
  --accent: #F8FAFC;
  --accent-foreground: #6D5BF6;
  --destructive: #EF4444;
  --destructive-foreground: #FFFFFF;
  --border: #E2E8F0;
  --input: #E2E8F0;
  --ring: #6D5BF6;
}

body {
  font-family: var(--font-sans);
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  font-variant-numeric: tabular-nums;
}
```

---

## 5. 前后端通信

### 5.1 Tauri API 封装

```typescript
// src/lib/tauri-api.ts
import { invoke } from '@tauri-apps/api/core'

export const api = {
  // Workspace
  getWorkspace: () => invoke<string>('get_workspace'),
  setWorkspace: (path: string) => invoke('set_workspace', { path }),
  selectDirectory: () => invoke<string | null>('select_directory'),

  // Accounts
  getAccounts: () => invoke<Account[]>('get_accounts'),
  removeAccount: (screenName: string) => invoke('remove_account', { screenName }),
  refreshStatus: (screenName: string) => invoke('refresh_account_status', { screenName }),

  // Tasks
  getTasks: () => invoke<Task[]>('get_tasks'),
  createTask: (config: CreateTaskConfig) => invoke<Task>('create_task', { config }),
  updateTask: (id: string, updates: Partial<Task>) => invoke('update_task', { id, updates }),
  deleteTask: (id: string) => invoke('delete_task', { id }),
  executeTask: (id: string) => invoke<ExecutionResult>('execute_task', { id }),
  pauseTask: (id: string) => invoke('pause_task', { id }),
  resumeTask: (id: string) => invoke('resume_task', { id }),
  getExecutionHistory: (id: string) => invoke<Execution[]>('get_execution_history', { id }),

  // Data Blocks
  getBlockData: (blockType: string, accountId: string) =>
    invoke<BlockData>('get_block_data', { blockType, accountId }),
}
```

### 5.2 Rust Command 示例

```rust
// src-tauri/src/commands/task.rs
use crate::models::task::Task;
use crate::services::task_runner;

#[tauri::command]
pub async fn get_tasks(state: tauri::State<'_, AppState>) -> Result<Vec<Task>, String> {
    state.store.get_tasks().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_task(id: String, state: tauri::State<'_, AppState>) -> Result<ExecutionResult, String> {
    task_runner::execute(&state, &id).await.map_err(|e| e.to_string())
}
```

### 5.3 命令注册

```rust
// src-tauri/src/lib.rs
mod commands;
mod models;
mod services;

use commands::{workspace, account, task, bridge};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            workspace::get_workspace,
            workspace::set_workspace,
            workspace::select_directory,
            account::get_accounts,
            account::remove_account,
            account::refresh_status,
            task::get_tasks,
            task::create_task,
            task::delete_task,
            task::execute_task,
            task::pause_task,
            task::resume_task,
            bridge::check_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**原则**：前端不直接操作文件系统或执行进程。所有 IO 和系统操作走 Tauri Command。

---

## 6. 主题切换

```typescript
// src/hooks/use-theme.ts
import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light' | 'system'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    const resolved = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme

    root.setAttribute('data-theme', resolved)
    localStorage.setItem('theme', theme)
  }, [theme])

  return { theme, setTheme }
}
```

---

## 7. 开发流程

### 7.1 启动

```bash
# 启动 Tauri 开发模式（前端 HMR + Rust 编译）
npx tauri dev
```

### 7.2 页面开发顺序

| 步骤 | 内容 | 设计文档 |
|------|------|---------|
| 1 | 工程骨架 + 路由 + 布局 | DESIGN-05 §1 |
| 2 | 主题系统 + CSS 变量 | DESIGN-02, DESIGN-03 |
| 3 | 设置页（最简单，先跑通 Tauri 通信） | DESIGN-05 §4 |
| 4 | 任务管理页 | DESIGN-05 §2, DESIGN-04 |
| 5 | 数据积木页 | DESIGN-05 §3, DESIGN-02 §4 |

步骤 1-2 是基础，步骤 3-5 可并行。

### 7.3 组件开发规范

1. **UI 组件**：使用 shadcn/ui，不重复造轮子。定制时直接编辑 `src/components/ui/`
2. **业务组件**：放在 `src/components/{domain}/`，一个文件一个组件
3. **样式**：Tailwind 类名 + CSS 变量，不写自定义 CSS
4. **类型**：定义在 `src/types/`，前后端共享接口
5. **状态**：Zustand store 在 `src/stores/`，一个领域一个
6. **图标**：只用 Lucide，不用 emoji
7. **颜色**：用语义变量（`bg-background`, `text-foreground`, `border-border`），不硬编码 hex

### 7.4 AI 开发指引

AI 在开发 UI 时：

1. 先读设计文档：DESIGN-02 → 03 → 04 → 05
2. 从 shadcn/ui 组件开始，不要从零写 button/input/dialog
3. 颜色用 CSS 变量，间距用 Tailwind spacing（`p-4`, `gap-2`），字号用 Tailwind text（`text-sm`, `text-base`）
4. 图标从 Lucide 导入，默认 `size={16}`
5. 所有后端调用走 `src/lib/tauri-api.ts`，不直接用 `invoke`

---

## 8. 与 Electron 版本的对比

| 维度 | Electron (v1) | Tauri (v2) |
|------|--------------|------------|
| 包体大小 | ~150MB | ~10MB |
| 内存占用 | ~200MB | ~30MB |
| 进程模型 | Main + Renderer | Rust 后端 + WebView |
| 文件系统 | Node.js fs | Rust std::fs + tauri-plugin-fs |
| 进程执行 | child_process | tauri-plugin-shell + tokio |
| 前端通信 | IPC (ipcMain/ipcRenderer) | Tauri invoke |
| 对话框 | Electron dialog | tauri-plugin-dialog |
| 打包 | electron-builder | Tauri CLI (NSIS/dmg/deb) |

**前端代码不受影响**。React 组件、Tailwind 样式、Zustand 状态管理完全一样。唯一区别是后端调用方式从 Electron IPC 变成 Tauri invoke。

---

## 文档版本

- 版本：2.0（迁移至 Tauri）
- 创建日期：2026-04-15
