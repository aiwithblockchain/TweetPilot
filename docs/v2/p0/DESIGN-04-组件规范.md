# TweetPilot 组件规范

## 文档信息

- 版本：1.0
- 创建日期：2026-04-15
- 路径：docs/v2/p0/DESIGN-04-组件规范.md

---

## 1. Button

### 1.1 变体

| 变体 | 背景 | 文字 | 边框 | 场景 |
|------|------|------|------|------|
| **Primary** | `--color-primary` | `--color-text-inverse` (white) | none | 主要操作（创建任务、确认） |
| **Secondary** | `transparent` | `--color-text` | `1px solid var(--color-border)` | 次要操作（取消、返回） |
| **Ghost** | `transparent` | `--color-text-secondary` | none | 最低优先操作 |
| **Danger** | `--color-danger` | white | none | 删除、不可逆操作 |
| **Danger-ghost** | `transparent` | `--color-danger` | none | 删除确认前的警示态 |

### 1.2 尺寸

| 尺寸 | 高度 | Padding | 字号 | 图标间距 |
|------|------|---------|------|----------|
| `sm` | 28px | `0 8px` | `--text-xs` (12px) | 4px |
| `md` (默认) | 32px | `0 12px` | `--text-sm` (13px) | 6px |
| `lg` | 40px | `0 16px` | `--text-base` (14px) | 8px |

### 1.3 状态

- **Hover**：Primary 变亮 `--color-primary-hover`，Secondary 边框变亮 `--color-border-hover`
- **Active**：Primary 变深 `--primary-700`，`transform: scale(0.98)`
- **Disabled**：`opacity: 0.4; cursor: not-allowed`
- **Focus**：`box-shadow: var(--shadow-ring)`，仅在键盘导航时显示（`focus-visible`）

### 1.4 图标按钮

纯图标按钮为正方形，宽高 = 对应尺寸高度。图标大小：`sm` 用 14px，`md` 用 16px。

---

## 2. Input

### 2.1 变体

| 变体 | 用途 |
|------|------|
| **Text** | 单行输入 |
| **Textarea** | 多行输入（可自动增高） |
| **Select** | 下拉选择 |
| **Search** | 搜索框（左侧带 search 图标） |

### 2.2 规格

- 高度：32px（与 button md 一致）
- Padding：`0 var(--space-3)`
- 字号：`--text-base` (14px)
- 边框：`1px solid var(--color-border)`
- 圆角：`var(--radius-md)` (6px)
- 背景：`var(--color-bg-elevated)`

### 2.3 状态

- **Placeholder**：`--color-text-tertiary`
- **Focus**：边框变为 `--color-primary`，`box-shadow: var(--shadow-ring)`
- **Error**：边框变为 `--color-danger`，下方显示红色错误文字
- **Disabled**：`opacity: 0.5; cursor: not-allowed`

### 2.4 表单布局

Label 在上，Input 在下，间距 `--space-1.5`。表单组之间间距 `--space-4`。

```
[Label]                    ← --text-sm, --font-medium, --color-text
[Input]                    ← 32px 高
[Helper text / Error]      ← --text-xs, --color-text-secondary 或 --color-danger
```

---

## 3. Card

### 3.1 基础卡片

- 背景：`var(--color-bg-elevated)`
- 边框：`1px solid var(--color-border)`
- 圆角：`var(--radius-lg)` (8px)
- 阴影：`var(--shadow-xs)`
- Padding：`var(--space-4)`

### 3.2 可交互卡片

- Hover：`border-color: var(--color-border-hover)`，`box-shadow: var(--shadow-sm)`
- Active：`transform: scale(0.99)`
- Cursor：`pointer`

### 3.3 数据积木卡片

数据积木是核心组件，在基础卡片上增加：

```
┌─────────────────────────────┐
│ [Icon] 卡片标题    [刷新][×] │  ← header: padding var(--space-3) var(--space-4)
├─────────────────────────────┤
│                             │
│    卡片内容区                │  ← content: padding 0 var(--space-4), min-height 200px
│    (图表/列表/统计数字)       │
│                             │
├─────────────────────────────┤
│ 最后更新: 3分钟前            │  ← footer: padding var(--space-2) var(--space-4), --text-xs, --color-text-tertiary
└─────────────────────────────┘
```

- 拖拽时：`opacity: 0.5; border: 1px dashed var(--color-primary)`
- 拖拽目标：`border-color: var(--color-primary); background: var(--color-primary-50)` (Dark 下用 `var(--primary-800)`)

---

## 4. Status Badge

### 4.1 账号状态

| 状态 | 圆点颜色 | 文字 | 背景 |
|------|---------|------|------|
| 在线 | `--color-success` | "在线" | `--color-success-muted` |
| 离线 | `--color-danger` | "离线" | `--color-danger-muted` |
| 验证中 | `--color-warning` | "验证中" | `--color-warning-muted` |

规格：`padding: 2px var(--space-2); border-radius: var(--radius-full); font-size: --text-xs; display: inline-flex; align-items: center; gap: 6px`。圆点大小 6px。

### 4.2 任务状态

| 状态 | 标签样式 |
|------|---------|
| 运行中 | 绿色 Badge（同"在线"） |
| 已暂停 | 灰色 Badge (`--color-text-tertiary` 文字 + `--color-bg-hover` 背景) |
| 待执行 | 蓝色 Badge (`--color-info` + `--color-info-muted`) |
| 失败 | 红色 Badge（同"离线"） |
| 空闲 | 灰色 Badge（同"已暂停"） |

---

## 5. Sidebar

### 5.1 侧边栏整体

- 宽度：220px（固定，不可折叠）
- 背景：`var(--color-bg)`（与主内容区同色，通过 border 分隔）
- 右边框：`1px solid var(--color-border)`
- 顶部：App Logo + 名称

### 5.2 导航项

```
┌──────────────────────┐
│ [Icon]  任务管理      │  ← 36px 高, padding: 0 var(--space-3)
├──────────────────────┤
│ [Icon]  数据积木      │  ← 默认态
├──────────────────────┤
│ [Icon]  设置          │
└──────────────────────┘
```

- 默认态：文字 `--color-text-secondary`，背景 transparent
- Hover：背景 `var(--color-bg-hover)`，文字 `--color-text`
- Active：背景 `--color-primary-50`（Dark: `var(--primary-800)`），文字 `--color-primary`，左侧 2px 竖条 `--color-primary`
- 圆角：`var(--radius-md)`
- 图标：16px，Lucide

### 5.3 底部区域

侧边栏底部固定显示：

- 当前工作目录路径（截断显示，hover tooltip 完整路径）
- 主题切换按钮（dark/light）

---

## 6. Modal

### 6.1 规格

- 遮罩：`background: rgba(0,0,0,0.5)`（Dark），`rgba(0,0,0,0.3)`（Light）
- 面板：`max-width: 520px; width: 90%; border-radius: var(--radius-xl); padding: var(--space-6)`
- 背景：`var(--color-bg-elevated)`
- 阴影：`var(--shadow-xl)`
- 入场：`opacity 0→1, transform translateY(8px)→0, duration 200ms`

### 6.2 结构

```
┌─────────────────────────────┐
│ 标题                   [×]   │  ← 标题 --text-xl, --font-semibold
├─────────────────────────────┤
│                             │
│    内容区                    │
│                             │
├─────────────────────────────┤
│              [取消] [确认]    │  ← 底部按钮区, 右对齐, gap var(--space-2)
└─────────────────────────────┘
```

- 点击遮罩关闭（可配置为不关闭）
- `Escape` 键关闭
- 底部按钮：Secondary + Primary 组合

---

## 7. Toast

- 位置：屏幕右上角，距顶部 16px，距右 16px
- 最大宽度：360px
- 圆角：`var(--radius-md)`
- 入场：`translateX(100%)→0, opacity 0→1, 200ms`
- 自动消失：3 秒
- 变体：`success`（绿色左边条）、`error`（红色左边条）、`info`（蓝色左边条）

---

## 8. Dropdown

- 触发方式：点击
- 位置：触发元素正下方，左对齐
- 背景：`var(--color-bg-elevated)`
- 边框：`1px solid var(--color-border)`
- 圆角：`var(--radius-md)`
- 阴影：`var(--shadow-lg)`
- 选项高度：32px
- 选项 Hover：背景 `var(--color-bg-hover)`
- 选项 Active/Selected：背景 `var(--color-primary-50)`（Dark: `--primary-800`），文字 `--color-primary`
- 最大高度：320px，超出滚动

---

## 9. Tabs

- 类型：下划线式（underline）
- 选中态：底部 2px 线 `--color-primary`，文字 `--color-text`
- 未选中：文字 `--color-text-secondary`
- Hover：文字 `--color-text`
- 间距：Tab 之间 `--space-4`

---

## 10. Empty State

- 居中显示
- 图标：64px，使用 `--color-text-tertiary`（或 Lucide outline 图标）
- 标题：`--text-lg, --font-medium`
- 描述：`--text-sm, --color-text-secondary`
- 操作按钮：可选的 Primary 按钮

---

## 11. Tooltip

- 背景：Dark 模式 `var(--neutral-300)`，Light 模式 `var(--neutral-800)`
- 文字：对应的对比色
- 圆角：`var(--radius-sm)`
- Padding：`4px var(--space-2)`
- 字号：`--text-xs`
- 延迟：300ms 显示，0ms 隐藏

---

## 文档版本

- 版本：1.0
- 创建日期：2026-04-15
