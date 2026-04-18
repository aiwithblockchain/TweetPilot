# P0-14 VSCode 风格 UI 重构方案 v2.0

## 文档信息

- 版本：v2.0（完全照抄 VSCode 布局）
- 创建日期：2026-04-18
- 适用阶段：TweetPilot V2 / P0-14 UI 重构
- 设计理念：100% 复刻 VSCode 的四栏布局和交互模式

---

## 1. 核心布局（完全照抄 VSCode）

```
┌──────────────────────────────────────────────────────────────────────┐
│  Custom Title Bar (自定义标题栏)                         ⚙️ 👤       │
├───┬──────────────┬─────────────────────────┬─────────────────────────┤
│   │              │                         │                         │
│   │   Left       │      Center             │      Right              │
│ A │   Sidebar    │      Detail             │      Chat Panel         │
│ c │              │      Content            │      (Claude 对话)       │
│ t │   列表类      │      详情类              │                         │
│ i │              │                         │   ┌─────────────────┐  │
│ v │  📁 工作区    │   根据左侧选择           │   │ 💬 Claude Code   │  │
│ i │  🐦 账号列表  │   显示对应详情           │   │                 │  │
│ t │  📊 数据卡片  │                         │   │ [消息列表]       │  │
│ y │  ⚡ 任务列表  │                         │   │                 │  │
│   │              │                         │   │                 │  │
│ B │              │                         │   └─────────────────┘  │
│ a │              │                         │   ┌─────────────────┐  │
│ r │              │                         │   │ 输入框           │  │
│   │              │                         │   │ [发送] [附件]    │  │
│   │  ┌────────┐  │                         │   └─────────────────┘  │
│   │  │🟢 实例  │  │                         │                         │
│   │  │状态面板 │  │                         │                         │
│   │  └────────┘  │                         │                         │
└───┴──────────────┴─────────────────────────┴─────────────────────────┘
     48px          ↔️ 可拖拽                 ↔️ 可拖拽                ↔️ 可拖拽
```

---

## 2. 四区域详细设计

### 2.1 Activity Bar（活动栏）

**尺寸**：
- 宽度：48px（固定，不可调整）
- 背景色：`#333333`

**图标列表**（从上到下）：
1. 📁 **Workspace** - 工作区管理
2. 🐦 **Accounts** - 账号管理
3. 📊 **Data Blocks** - 数据积木
4. ⚡ **Tasks** - 任务管理
5. ⚙️ **Settings** - 设置（移到这里）

**交互行为**：
- 点击图标切换左侧 Sidebar 内容
- 当前激活图标：左侧 2px 白色竖线 + 图标高亮
- 悬停效果：背景色变为 `#2A2A2A`

---

### 2.2 Left Sidebar（左侧边栏）

**尺寸**：
- 默认宽度：250px
- 可调整范围：180px - 400px
- 通过右侧分隔线拖拽调整

**内容区域**：
- **顶部**：标题栏（显示当前激活的功能名称）
- **中间**：列表内容（根据 Activity Bar 选择显示）
- **底部**：实例状态面板（固定显示，类似 VSCode 的 Ports/Accounts）

**实例状态面板设计**：
```
┌─────────────────────────────────┐
│ 🔌 TWEETCLAW INSTANCES          │
├─────────────────────────────────┤
│ 🟢 tweet-xiaohognshu            │
│    ID: b8311f7d...              │
│    最后活跃: 2分钟前             │
├─────────────────────────────────┤
│ 🔴 tweet-backup (离线)          │
│    ID: a7c22e8f...              │
│    最后活跃: 1小时前             │
└─────────────────────────────────┘
```

**状态指示器**：
- 🟢 在线（绿色）
- 🔴 离线（红色）
- 🟡 连接中（黄色）

---

### 2.3 Center Panel（中间详情区）

**尺寸**：
- 默认宽度：占剩余空间的 60%
- 通过左右分隔线拖拽调整

**内容**：
- 根据左侧 Sidebar 选择显示对应详情
- 例如：
  - 选择账号 → 显示账号详情页
  - 选择数据卡片 → 显示卡片配置和数据
  - 选择任务 → 显示任务详情和执行历史

**顶部 Tab 栏**（类似 VSCode 的编辑器 Tab）：
- 显示当前打开的详情页
- 支持多 Tab 切换
- 可关闭 Tab

---

### 2.4 Right Panel（右侧对话区）

**尺寸**：
- 默认宽度：占剩余空间的 40%
- 可调整范围：300px - 600px
- 可完全折叠（隐藏）

**功能**：
- Claude 对话界面（UI 占位，暂无后端逻辑）
- 预留给未来的 AI 助手功能

**UI 结构**：
```
┌─────────────────────────────────┐
│ 💬 Claude Code                  │
├─────────────────────────────────┤
│                                 │
│ [消息气泡 1]                     │
│ 你好，我是 Claude...             │
│                                 │
│         [消息气泡 2]             │
│         如何帮助你？             │
│                                 │
├─────────────────────────────────┤
│ 输入消息...                      │
│ [📎 附件] [发送]                 │
└─────────────────────────────────┘
```

**Mock 数据**：
- 显示 2-3 条示例对话
- 输入框可输入但不发送
- 点击发送按钮显示 Toast："功能开发中"

---

## 3. 可拖拽分隔线实现

### 3.1 技术方案

使用 React 状态管理 + CSS Flexbox + 鼠标事件

**状态管理**：
```typescript
const [leftWidth, setLeftWidth] = useState(250)
const [rightWidth, setRightWidth] = useState(400)
const [isDragging, setIsDragging] = useState<'left' | 'right' | null>(null)
```

**拖拽逻辑**：
```typescript
const handleMouseDown = (divider: 'left' | 'right') => {
  setIsDragging(divider)
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging) return
  
  if (isDragging === 'left') {
    const newWidth = e.clientX - 48 // 减去 Activity Bar 宽度
    setLeftWidth(Math.max(180, Math.min(400, newWidth)))
  } else if (isDragging === 'right') {
    const newWidth = window.innerWidth - e.clientX
    setRightWidth(Math.max(300, Math.min(600, newWidth)))
  }
}

const handleMouseUp = () => {
  setIsDragging(null)
}
```

### 3.2 分隔线样式

```css
.divider {
  width: 4px;
  background: transparent;
  cursor: col-resize;
  position: relative;
}

.divider:hover,
.divider.dragging {
  background: #007ACC;
}

.divider::before {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  top: 0;
  bottom: 0;
}
```

---

## 4. 设置页面重构

### 4.1 移除内容

**删除**：
- 整个 "Twitter 账号设置" 区块
- 相关的状态管理代码

### 4.2 新增账号设置

**未登录状态**：
```
┌─────────────────────────────────┐
│ 账号设置                         │
├─────────────────────────────────┤
│                                 │
│  [Google Logo]                  │
│                                 │
│  使用 Google 账号登录            │
│  以同步您的设置和订阅            │
│                                 │
│  ┌───────────────────────────┐ │
│  │ Sign in with Google       │ │
│  └───────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**已登录状态**：
```
┌─────────────────────────────────┐
│ 账号设置                         │
├─────────────────────────────────┤
│                                 │
│  [Avatar] user@example.com      │
│                                 │
│  订阅等级: Free                  │
│  ┌─────────────────────────┐   │
│  │ ████░░░░░░░░░░░░░░░░ 10% │   │
│  │ 1,000 / 10,000 tokens   │   │
│  └─────────────────────────┘   │
│                                 │
│  ┌───────────────────────────┐ │
│  │ Sign Out                  │ │
│  └───────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**Mock 逻辑**：
```typescript
const [isLoggedIn, setIsLoggedIn] = useState(false)
const [user, setUser] = useState<{
  email: string
  avatar: string
  tier: 'free' | 'pro'
  tokenUsed: number
  tokenLimit: number
} | null>(null)

const handleSignIn = () => {
  setIsLoggedIn(true)
  setUser({
    email: 'demo@example.com',
    avatar: 'https://via.placeholder.com/40',
    tier: 'free',
    tokenUsed: 1000,
    tokenLimit: 10000
  })
}

const handleSignOut = () => {
  setIsLoggedIn(false)
  setUser(null)
}
```

---

## 5. 视觉设计规范

### 5.1 VSCode Dark Theme 颜色

| 元素 | 颜色代码 | 用途 |
|------|----------|------|
| 背景色（主） | `#1E1E1E` | 主内容区 |
| 背景色（侧边栏） | `#252526` | Left Sidebar |
| 背景色（Activity Bar） | `#333333` | Activity Bar |
| 背景色（标题栏） | `#323233` | Title Bar |
| 边框色 | `#2A2A2A` | 分隔线 |
| 文字色（主） | `#CCCCCC` | 主要文字 |
| 文字色（次） | `#858585` | 次要文字 |
| 强调色 | `#007ACC` | 链接、按钮 |
| 成功色 | `#4EC9B0` | 在线状态 |
| 错误色 | `#F48771` | 离线状态 |

### 5.2 字体

- **主字体**：`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **等宽字体**：`'SF Mono', Monaco, Consolas, monospace`
- **字号**：
  - 标题：16px
  - 正文：13px
  - 小字：11px

### 5.3 间距

- 基础单位：4px
- 常用间距：4px, 8px, 16px, 24px, 32px

---

## 6. 实施计划

> 当前实现状态说明（2026-04-18）：
> - 阶段 1 已完成
> - 阶段 2 已完成
> - 阶段 3 已完成核心目标（真实实例获取 + 60 秒刷新）
> - 阶段 4 已完成 UI Mock
> - 阶段 5 已完成
> - 阶段 6 已完成基础视觉统一，并已支持 compact 模式侧边栏抽屉与主区域响应式切换
> - `workspace` 已升级为真实概览页（WorkspaceHome）
> - `accounts` 已升级为真实概览页（AccountsOverview）
> - `tasks`、`data-blocks`、`settings` 已恢复为真实页面，并通过懒加载按需进入
> - `App.tsx` 已完成职责拆分：Tab 栏、移动端侧边栏抽屉、中心内容路由、布局状态管理均已拆到独立组件 / hooks
> - 当前版本已达到一个可维护的收尾状态，后续主要是交互动效与更细节的响应式打磨

### 阶段 1：基础布局（2 天）

**任务**：
1. 移除原生标题栏（[tauri.conf.json](src-tauri/tauri.conf.json)）
2. 创建自定义标题栏组件（[TitleBar.tsx](src/components/TitleBar.tsx)）
3. 创建四栏布局容器（[App.tsx](src/App.tsx)）
4. 实现 Activity Bar（[ActivityBar.tsx](src/components/ActivityBar.tsx)）

**验收标准**：
- [x] 窗口无原生标题栏
- [x] 自定义标题栏可拖拽移动窗口
- [x] 窗口控制按钮（最小化、最大化、关闭）正常工作
- [x] Activity Bar 显示 5 个图标
- [x] 点击图标可切换（暂时只切换状态，不显示内容）

---

### 阶段 2：可拖拽分隔线（1 天）

**任务**：
1. 实现左侧分隔线拖拽（[ResizableDivider.tsx](src/components/ResizableDivider.tsx)）
2. 实现右侧分隔线拖拽
3. 宽度状态持久化到 localStorage

**验收标准**：
- [x] 左侧分隔线可拖拽调整 Left Sidebar 宽度
- [x] 右侧分隔线可拖拽调整 Right Panel 宽度
- [x] 拖拽时显示视觉反馈（蓝色高亮）
- [x] 宽度限制生效（最小/最大宽度）
- [x] 刷新页面后宽度保持

---

### 阶段 3：Left Sidebar + 实例状态（2 天）

**任务**：
1. 创建 Left Sidebar 容器（[LeftSidebar.tsx](src/components/LeftSidebar.tsx)）
2. 创建实例状态面板（[InstanceStatusPanel.tsx](src/components/InstanceStatusPanel.tsx)）
3. 实现实例数据获取（新增 Tauri command: `get_instances`）
4. 实时状态更新（每 60 秒）

**验收标准**：
- [x] Left Sidebar 显示当前激活功能的标题
- [x] 底部固定显示实例状态面板
- [x] 实例状态面板显示所有连接的实例
- [x] 状态指示器正确显示（在线/离线）
- [x] 每 60 秒自动刷新状态

---

### 阶段 4：Right Panel（Claude 对话 UI）（1 天）

**任务**：
1. 创建 Right Panel 容器（[RightPanel.tsx](src/components/RightPanel.tsx)）
2. 创建对话界面 UI（[ChatInterface.tsx](src/components/ChatInterface.tsx)）
3. Mock 对话数据
4. 实现折叠/展开功能

**验收标准**：
- [x] Right Panel 显示 Claude 对话界面
- [x] 显示 2-3 条 Mock 对话消息
- [x] 输入框可输入文字
- [x] 点击发送按钮显示 "功能开发中" Toast
- [x] 可通过按钮折叠/展开 Right Panel

---

### 阶段 5：设置页面重构（1 天）

**任务**：
1. 删除 Twitter 账号设置区块
2. 创建 Google 账号设置组件（[AccountSettings.tsx](src/components/AccountSettings.tsx)）
3. 实现 Mock 登录/登出逻辑
4. UI 细节打磨

**验收标准**：
- [x] 设置页面不再显示 Twitter 账号设置
- [x] 显示 Google 登录按钮（未登录状态）
- [x] 点击登录后显示 Mock 用户信息
- [x] 显示订阅等级和 Token 额度
- [x] 点击登出后返回未登录状态

---

### 阶段 6：视觉优化（1 天）

**任务**：
1. 应用 VSCode 颜色方案
2. 统一字体和间距
3. 添加过渡动画
4. 响应式适配

**验收标准**：
- [x] 所有颜色符合 VSCode Dark Theme
- [x] 字体和间距统一
- [x] 面板切换有平滑过渡
- [ ] 在不同屏幕尺寸下布局正常

---

## 7. 文件清单

### 新建文件

1. [src/components/TitleBar.tsx](src/components/TitleBar.tsx) - 自定义标题栏
2. [src/components/ActivityBar.tsx](src/components/ActivityBar.tsx) - 活动栏
3. [src/components/LeftSidebar.tsx](src/components/LeftSidebar.tsx) - 左侧边栏
4. [src/components/ResizableDivider.tsx](src/components/ResizableDivider.tsx) - 可拖拽分隔线
5. [src/components/InstanceStatusPanel.tsx](src/components/InstanceStatusPanel.tsx) - 实例状态面板
6. [src/components/RightPanel.tsx](src/components/RightPanel.tsx) - 右侧对话区
7. [src/components/ChatInterface.tsx](src/components/ChatInterface.tsx) - 对话界面
8. [src/styles/vscode-theme.css](src/styles/vscode-theme.css) - VSCode 主题样式
9. [src/services/layout.ts](src/services/layout.ts) - 布局层实例数据服务
10. [src/types/layout.ts](src/types/layout.ts) - 布局层类型定义
11. [src/config/layout.ts](src/config/layout.ts) - 布局配置与导航元数据
12. [src/components/DetailPanel.tsx](src/components/DetailPanel.tsx) - 中间详情面板
13. [src/components/WorkspaceHome.tsx](src/components/WorkspaceHome.tsx) - 工作区概览页
14. [src/components/AccountsOverview.tsx](src/components/AccountsOverview.tsx) - 账号概览页
15. [src/components/EditorTabsBar.tsx](src/components/EditorTabsBar.tsx) - 顶部标签栏与 Claude 面板切换
16. [src/components/MobileSidebarDrawer.tsx](src/components/MobileSidebarDrawer.tsx) - compact 模式侧边栏抽屉
17. [src/components/CenterContentRouter.tsx](src/components/CenterContentRouter.tsx) - 中心区域内容路由与懒加载承载
18. [src/hooks/useAppLayoutState.ts](src/hooks/useAppLayoutState.ts) - 布局状态与实例轮询 hook

### 修改文件

1. [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) - 窗口配置
2. [src/App.tsx](src/App.tsx) - 主布局重构
3. [src/pages/Settings.tsx](src/pages/Settings.tsx) - 设置页面重构
4. [src-tauri/src/commands/account.rs](src-tauri/src/commands/account.rs) - 新增 `get_instances` command
5. [src-tauri/src/main.rs](src-tauri/src/main.rs) - 注册新 command
6. [src/components/ActivityBar.tsx](src/components/ActivityBar.tsx) - 图标与类型调整
7. [src/services/layout.ts](src/services/layout.ts) - 实例查询服务接入
8. [src/App.tsx](src/App.tsx) - 继续拆分为布局编排层，接入 `EditorTabsBar` / `CenterContentRouter` / `useAppLayoutState`

---

## 8. 技术细节

### 8.1 窗口配置

**文件**：[src-tauri/tauri.conf.json](src-tauri/tauri.conf.json)

```json
{
  "tauri": {
    "windows": [
      {
        "title": "TweetPilot",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "decorations": false,
        "transparent": false,
        "resizable": true
      }
    ]
  }
}
```

### 8.2 布局状态持久化

```typescript
interface LayoutState {
  leftWidth: number
  rightWidth: number
  rightPanelVisible: boolean
  activePanel: string
}

// 保存
localStorage.setItem('layout', JSON.stringify(layoutState))

// 恢复
const savedLayout = JSON.parse(localStorage.getItem('layout') || '{}')
```

### 8.3 实例数据获取

**新增 Tauri Command**：

```rust
// src-tauri/src/commands/account.rs
#[tauri::command]
pub async fn get_instances() -> Result<Vec<serde_json::Value>, String> {
    let config = crate::commands::preferences::get_local_bridge_config().await?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;
    client.get_instances().await
}
```

**前端调用**：

```typescript
import { layoutService } from '@/services/layout'

useEffect(() => {
  let cancelled = false

  const loadInstances = async () => {
    try {
      const result = await layoutService.getInstances()
      if (!cancelled && result.length > 0) {
        setInstances(result)
      }
    } catch (error) {
      if (!cancelled) {
        setInstancesError(error instanceof Error ? error.message : '实例状态获取失败')
      }
    }
  }

  void loadInstances()
  const interval = window.setInterval(loadInstances, 60000)

  return () => {
    cancelled = true
    window.clearInterval(interval)
  }
}, [])
```

---

## 9. 总预计时间

**MVP 版本（核心功能）**：8 天

- 阶段 1：基础布局（2 天）
- 阶段 2：可拖拽分隔线（1 天）
- 阶段 3：Left Sidebar + 实例状态（2 天）
- 阶段 4：Right Panel（1 天）
- 阶段 5：设置页面重构（1 天）
- 阶段 6：视觉优化（1 天）

---

## 10. 风险与注意事项

### 10.1 窗口控制风险

**风险**：移除原生标题栏后，窗口控制在不同操作系统上可能不一致。

**缓解**：
- 使用 Tauri 官方 API
- 在 macOS 和 Windows 上分别测试

### 10.2 性能风险

**风险**：实时更新实例状态可能影响性能。

**缓解**：
- 使用防抖优化
- 只在面板可见时更新
- 使用 React.memo 优化渲染

---

最后更新：2026-04-18（已同步当前实现进度）
