# TweetPilot 排版与间距

## 文档信息

- 版本：1.0
- 创建日期：2026-04-15
- 路径：docs/v2/p0/DESIGN-03-排版与间距.md

---

## 1. 字体

### 1.1 字体栈

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
```

- **Inter**：UI 主字体。选型理由：开发者工具标配（Linear、Notion、Vercel 均使用），小字号下清晰度优秀，支持 tabular nums（表格数字等宽）。
- **JetBrains Mono**：代码/日志输出区域。选型理由：开发者熟悉，连字支持好。

Inter 需要通过 `@fontsource/inter` 或 Google Fonts 加载，不依赖系统安装。JetBrains Mono 作为可选增强，fallback 到系统 monospace。

### 1.2 字号层级

| Token | 大小 | 行高 | 字重 | 用途 |
|-------|------|------|------|------|
| `--text-xs` | 12px | 16px | 400 | 辅助文字、时间戳、元信息 |
| `--text-sm` | 13px | 20px | 400 | 表格内容、下拉选项、标签 |
| `--text-base` | 14px | 22px | 400 | 正文、列表项、输入框 |
| `--text-md` | 15px | 24px | 400 | 页面正文主内容 |
| `--text-lg` | 16px | 24px | 500 | 卡片标题、小节标题 |
| `--text-xl` | 18px | 28px | 600 | 页面标题 |
| `--text-2xl` | 22px | 30px | 600 | 大标题 |
| `--text-3xl` | 28px | 36px | 700 | Hero 数字（统计面板） |

**设计决策**：基础字号从原型的 16px 降到 14px。开发者工具信息密度更高，14px 是 Linear、VS Code 的标准选择。仅在需要突出时使用更大字号。

### 1.3 字重

| Token | 值 | 用途 |
|-------|-----|------|
| `--font-normal` | 400 | 正文 |
| `--font-medium` | 500 | 导航项、标签、小标题 |
| `--font-semibold` | 600 | 页面标题、按钮 |
| `--font-bold` | 700 | Hero 数字 |

### 1.4 字体特性

```css
body {
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  font-variant-numeric: tabular-nums;
}
```

- `cv02/03/04/11`：Inter 的 OpenType 特性，改善小写 a/g/l 的辨识度
- `tabular-nums`：数字等宽，确保数据表格、统计数据对齐

---

## 2. 间距系统

采用 4px 基准网格，与 Tailwind 默认对齐。

### 2.1 间距 Token

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-0` | 0 | 重置 |
| `--space-0.5` | 2px | 微调 |
| `--space-1` | 4px | 图标与文字间距、紧凑内边距 |
| `--space-1.5` | 6px | 标签内边距 |
| `--space-2` | 8px | 表单元素内间距、列表项间距 |
| `--space-2.5` | 10px | 小按钮内边距 |
| `--space-3` | 12px | 卡片内边距（紧凑） |
| `--space-4` | 16px | 标准内边距、卡片内边距 |
| `--space-5` | 20px | 区块间距 |
| `--space-6` | 24px | 大内边距 |
| `--space-8` | 32px | 区块分隔 |
| `--space-10` | 40px | 大区块分隔 |
| `--space-12` | 48px | 页面级分隔 |
| `--space-16` | 64px | Hero 区域间距 |

### 2.2 间距使用规则

**内间距（padding）**：
- 按钮：`padding: var(--space-2) var(--space-3)`（小按钮）、`var(--space-2.5) var(--space-4)`（默认）
- 卡片：`padding: var(--space-4)`
- 模态框：`padding: var(--space-6)`
- 页面容器：`padding: var(--space-6)`

**外间距（gap）**：
- 同类元素列表：`gap: var(--space-2)`
- 不同类区块：`gap: var(--space-4)`
- 区域分隔：`gap: var(--space-6)` 或 `gap: var(--space-8)`

**不使用 margin**。布局统一使用 gap + flex/grid 的 spacing，避免 margin 塌陷问题。唯一的 margin 场景是段落底部 `margin-bottom: var(--space-3)`。

---

## 3. 圆角

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-none` | 0 | — |
| `--radius-sm` | 4px | 标签、小徽章 |
| `--radius-md` | 6px | 按钮、输入框、下拉菜单 |
| `--radius-lg` | 8px | 卡片、模态框 |
| `--radius-xl` | 12px | 大卡片、弹窗 |
| `--radius-2xl` | 16px | 特殊容器 |
| `--radius-full` | 9999px | 头像、圆形按钮、状态点 |

**对比原型**：原型统一使用 4/8/12px 三档。新系统增加到 7 档，更精细。主按钮从 8px 调整为 6px（参考 Linear 的紧凑风格），卡片从 12px 调整为 8px（降低视觉噪音）。

---

## 4. 阴影

### 4.1 Shadow Token

| Token | 值 | 用途 |
|-------|-----|------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | 卡片默认 |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` | 卡片悬浮 |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)` | 下拉菜单 |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)` | 模态框 |
| `--shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04)` | 弹出层 |
| `--shadow-ring` | `0 0 0 2px var(--color-primary)` | focus ring |

### 4.2 Dark 模式阴影

Dark 模式下阴影需要更深的透明度才可见：

```css
[data-theme="dark"] {
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.2);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -1px rgba(0,0,0,0.2);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.2);
}
```

但在深色 UI 中，层级关系更常用 **边框亮度变化** 而非阴影来区分。Dark 模式下大部分卡片不使用阴影，用 `border: 1px solid var(--color-border)` 代替。

---

## 5. 图标

| 属性 | 值 |
|------|-----|
| 图标库 | Lucide Icons |
| 默认尺寸 | 16px |
| 线宽 | 1.5px（与 Lucide 默认一致） |
| 颜色 | 继承 `currentColor` |
| 对齐 | 使用 `display: inline-flex; align-items: center; justify-content: center` 确保垂直居中 |

常用图标映射（替代原型中的 emoji）：

| 场景 | 原型 Emoji | Lucide 图标 |
|------|-----------|-------------|
| 任务管理导航 | 📋 | `clipboard-list` |
| 数据积木导航 | 📊 | `layout-grid` |
| 设置导航 | ⚙️ | `settings` |
| 刷新 | 🔄 | `refresh-cw` |
| 删除 | × | `x` |
| 在线状态 | — | `circle`（实心，绿色） |
| 离线状态 | — | `circle`（实心，红色） |
| 添加 | — | `plus` |
| 搜索 | — | `search` |

---

## 6. 动效

### 6.1 过渡

| Token | 值 | 用途 |
|-------|-----|------|
| `--duration-fast` | 120ms | 悬浮态、颜色变化 |
| `--duration-normal` | 200ms | 展开折叠、面板切换 |
| `--duration-slow` | 300ms | 页面过渡、模态框出现 |
| `--easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | 默认缓动 |
| `--easing-in` | `cubic-bezier(0.4, 0, 1, 1)` | 进入 |
| `--easing-out` | `cubic-bezier(0, 0, 0.2, 1)` | 退出 |

### 6.2 动效规则

- 所有交互元素必须有过渡，不允许瞬间切换
- `prefers-reduced-motion: reduce` 下禁用所有动画，仅保留颜色过渡
- 不使用 `transition: all`，明确指定属性（如 `transition: background-color var(--duration-fast), border-color var(--duration-fast)`）
- 页面切换使用 `opacity + transform` 组合，不使用高度动画

---

## 文档版本

- 版本：1.0
- 创建日期：2026-04-15
