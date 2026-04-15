# TweetPilot 色彩体系

## 文档信息

- 版本：1.0
- 创建日期：2026-04-15
- 路径：docs/v2/p0/DESIGN-02-色彩体系.md

---

## 1. 色彩来源

TweetPilot 的品牌色取自 Logo 的紫蓝渐变：

- Logo 主紫：`#7C3AED`（Violet 600）
- Logo 主蓝：`#3B82F6`（Blue 500）
- 渐变方向：紫 → 蓝，左上到右下

品牌主色取渐变中段偏紫的位置：**`#6D5BF6`**。这个色值既有 Logo 的辨识度，又不会太偏冷或太偏暖，在深色和浅色背景上都有良好表现。

**从原型迁移说明**：原型使用 Twitter 品牌蓝 `#1da1f2` 作为主色。正式版改为 Logo 衍生的紫蓝色系，与品牌视觉统一。

---

## 2. 语义色板

### 2.1 Primary（品牌紫蓝）

| Token | 用途 | Dark 模式 | Light 模式 |
|-------|------|-----------|------------|
| `--primary-50` | 极浅背景 | `#F5F3FF` | `#F5F3FF` |
| `--primary-100` | 浅色背景/悬浮 | `#EDE9FE` | `#EDE9FE` |
| `--primary-200` | 边框/分割线 | `#DDD6FE` | `#DDD6FE` |
| `--primary-300` | 禁用态文字 | `#C4B5FD` | `#C4B5FD` |
| `--primary-400` | 次要强调 | `#A78BFA` | `#A78BFA` |
| `--primary-500` | 主色（默认） | `#8B5CF6` | `#6D5BF6` |
| `--primary-600` | 主色（悬浮） | `#7C3AED` | `#5B3DE6` |
| `--primary-700` | 主色（按下） | `#6D28D9` | `#4C1DB8` |
| `--primary-800` | 深色强调 | `#5B21B6` | `#3B0F8A` |
| `--primary-900` | 极深 | `#4C1D95` | `#2E0A66` |

### 2.2 Accent（品牌蓝，辅助强调）

| Token | 用途 | 值 |
|-------|------|-----|
| `--accent-400` | 次要操作/图表色 | `#60A5FA` |
| `--accent-500` | 辅助强调 | `#3B82F6` |
| `--accent-600` | 悬浮态 | `#2563EB` |

### 2.3 Neutral（中性色，基于 Slate）

| Token | Dark 模式 | Light 模式 |
|-------|-----------|------------|
| `--neutral-0` | `#0F1117` | `#FFFFFF` |
| `--neutral-50` | `#161822` | `#F8FAFC` |
| `--neutral-100` | `#1E2030` | `#F1F5F9` |
| `--neutral-200` | `#282A3A` | `#E2E8F0` |
| `--neutral-300` | `#363849` | `#CBD5E1` |
| `--neutral-400` | `#4A4C5E` | `#94A3B8` |
| `--neutral-500` | `#6B6D80` | `#64748B` |
| `--neutral-600` | `#8B8DA0` | `#475569` |
| `--neutral-700` | `#A8AAB8` | `#334155` |
| `--neutral-800` | `#C4C6D0` | `#1E293B` |
| `--neutral-900` | `#E8E9ED` | `#0F172A` |

### 2.4 Semantic（功能色）

| Token | 用途 | 值 |
|-------|------|-----|
| `--color-success` | 成功/在线 | `#22C55E` |
| `--color-success-muted` | 成功背景 | `rgba(34,197,94,0.12)` |
| `--color-warning` | 警告/验证中 | `#F59E0B` |
| `--color-warning-muted` | 警告背景 | `rgba(245,158,11,0.12)` |
| `--color-danger` | 错误/离线 | `#EF4444` |
| `--color-danger-muted` | 错误背景 | `rgba(239,68,68,0.12)` |
| `--color-info` | 提示 | `#3B82F6` |
| `--color-info-muted` | 提示背景 | `rgba(59,130,246,0.12)` |

---

## 3. 语义化 Token 映射

组件不直接使用色板值，而是通过语义化 Token 引用。这样可以实现 dark/light 主题切换。

### 3.1 Dark 主题（默认）

```css
[data-theme="dark"] {
  /* 背景 */
  --color-bg:          var(--neutral-0);      /* #0F1117 */
  --color-bg-elevated: var(--neutral-50);     /* #161822 */
  --color-bg-secondary:var(--neutral-100);    /* #1E2030 */
  --color-bg-hover:    var(--neutral-200);    /* #282A3A */
  --color-bg-active:   var(--neutral-300);    /* #363849 */

  /* 文字 */
  --color-text:        var(--neutral-900);    /* #E8E9ED */
  --color-text-secondary: var(--neutral-500); /* #6B6D80 */
  --color-text-tertiary:  var(--neutral-400); /* #4A4C5E */
  --color-text-inverse:   var(--neutral-0);   /* #0F1117 */

  /* 边框 */
  --color-border:      var(--neutral-200);    /* #282A3A */
  --color-border-hover:var(--neutral-300);    /* #363849 */

  /* 主色 */
  --color-primary:     var(--primary-500);    /* #8B5CF6 */
  --color-primary-hover: var(--primary-400);  /* #A78BFA */
  --color-primary-text:  var(--primary-200);  /* #DDD6FE */
}
```

### 3.2 Light 主题

```css
[data-theme="light"] {
  /* 背景 */
  --color-bg:          var(--neutral-0);      /* #FFFFFF */
  --color-bg-elevated: #FFFFFF;
  --color-bg-secondary:var(--neutral-50);     /* #F8FAFC */
  --color-bg-hover:    var(--neutral-100);    /* #F1F5F9 */
  --color-bg-active:   var(--neutral-200);    /* #E2E8F0 */

  /* 文字 */
  --color-text:        var(--neutral-900);    /* #0F172A */
  --color-text-secondary: var(--neutral-600); /* #475569 */
  --color-text-tertiary:  var(--neutral-500); /* #64748B */
  --color-text-inverse:   var(--neutral-0);   /* #FFFFFF */

  /* 边框 */
  --color-border:      var(--neutral-200);    /* #E2E8F0 */
  --color-border-hover:var(--neutral-300);    /* #CBD5E1 */

  /* 主色 */
  --color-primary:     #6D5BF6;
  --color-primary-hover: #5B3DE6;
  --color-primary-text:  #4C1DB8;
}
```

---

## 4. 图表与数据色

数据积木中的图表需要独立的调色板，与品牌色区分开，保证数据可读性。

| 用途 | 色值 | 说明 |
|------|------|------|
| 数据系列 1 | `#8B5CF6` | 主色，与品牌一致 |
| 数据系列 2 | `#3B82F6` | 品牌蓝 |
| 数据系列 3 | `#22C55E` | 绿色 |
| 数据系列 4 | `#F59E0B` | 琥珀色 |
| 数据系列 5 | `#EF4444` | 红色 |
| 数据系列 6 | `#06B6D4` | 青色 |

图表背景网格线：Dark 模式 `rgba(255,255,255,0.06)`，Light 模式 `rgba(0,0,0,0.06)`。

---

## 5. 渐变用法

品牌渐变仅用于特定场景，不泛滥使用：

```css
/* Logo 品牌渐变 — 用于 Hero 区域、欢迎页、About 面板 */
--gradient-brand: linear-gradient(135deg, #7C3AED, #3B82F6);

/* 按钮渐变 — 主要 CTA */
--gradient-primary: linear-gradient(135deg, #8B5CF6, #6D5BF6);

/* 卡片顶部装饰线 */
--gradient-accent: linear-gradient(90deg, #7C3AED, #3B82F6);
```

**禁止使用渐变的场景**：文字正文、列表项背景、输入框边框。渐变是点缀，不是默认。

---

## 6. 从原型迁移对照表

| 原型 Token | 新 Token | 说明 |
|-----------|----------|------|
| `--color-primary: #1da1f2` | `--color-primary` (紫蓝色系) | 品牌色替换 |
| `--color-text: #14171a` | `--color-text` | 通过主题切换管理 |
| `--color-text-secondary: #657786` | `--color-text-secondary` | 通过主题切换管理 |
| `--color-bg: #ffffff` | `--color-bg` | 通过主题切换管理 |
| `--color-bg-secondary: #f7f9fa` | `--color-bg-secondary` | 通过主题切换管理 |
| `--color-border: #e1e8ed` | `--color-border` | 通过主题切换管理 |
| `--color-success: #17bf63` | `--color-success: #22C55E` | 对齐 Tailwind green-500 |
| `--color-warning: #ffad1f` | `--color-warning: #F59E0B` | 对齐 Tailwind amber-500 |
| `--color-danger: #e0245e` | `--color-danger: #EF4444` | 对齐 Tailwind red-500 |

---

## 文档版本

- 版本：1.0
- 创建日期：2026-04-15
