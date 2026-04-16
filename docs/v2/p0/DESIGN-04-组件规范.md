# TweetPilot 组件规范

## 文档信息

- 版本：2.0
- 创建日期：2026-04-15
- 路径：docs/v2/p0/DESIGN-04-组件规范.md
- 状态：规范基线（部分条目尚未在代码中完全落地）

---

## 使用说明（先读）

本文件是组件设计规范，不是“当前实现快照”。

请按以下优先级理解：

1. **当前代码行为**优先（避免误改已上线交互）
2. **本规范**用于后续迭代收敛和统一风格
3. 如果规范与实现冲突，先在文档里记录偏差，再决定是否改代码

关联文档：
- `P0-03-接口设计规范.md`
- `NEXT_PHASE_MODULE_ABSTRACTION.md`
- `DESIGN-02-色彩体系.md`
- `DESIGN-03-排版与间距.md`

---

## 当前落地偏差（必须知晓）

以下是当前阶段的已知偏差：

1. 部分页面仍有 emoji 图标，尚未完全替换为 Lucide
2. 部分按钮和卡片存在硬编码颜色，尚未完全切换语义化 token
3. 部分弹窗交互已根据实际需求定制（例如删除二次确认流程），与通用模态描述略有差异
4. 部分页面布局已经在真实实现中迭代，不再和早期原型一一对应

结论：
- 这份文档用于统一方向，不应强行覆盖所有当前实现细节。

---

## 1. Button

### 1.1 变体

| 变体 | 背景 | 文字 | 边框 | 场景 |
|------|------|------|------|------|
| **Primary** | `--color-primary` | `--color-text-inverse` | none | 主要操作（创建、确认） |
| **Secondary** | transparent | `--color-text` | `1px solid var(--color-border)` | 次要操作（取消、返回） |
| **Ghost** | transparent | `--color-text-secondary` | none | 低优先操作 |
| **Danger** | `--color-danger` | white | none | 删除、不可逆操作 |
| **Danger-ghost** | transparent | `--color-danger` | none | 删除前提示态 |

### 1.2 尺寸

| 尺寸 | 高度 | Padding | 字号 | 图标间距 |
|------|------|---------|------|----------|
| `sm` | 28px | `0 8px` | 12px | 4px |
| `md` | 32px | `0 12px` | 13-14px | 6px |
| `lg` | 40px | `0 16px` | 14px | 8px |

### 1.3 状态

- Hover：Primary 使用 `--color-primary-hover`
- Active：可用轻微缩放（`scale(0.98)`）
- Disabled：`opacity: 0.4; cursor: not-allowed`
- Focus：`focus-visible` 显示 ring

---

## 2. Input

### 2.1 类型

- Text
- Textarea
- Select
- Search

### 2.2 规格

- 高度：32px（单行）
- 边框：`1px solid var(--color-border)`
- 圆角：`var(--radius-md)`
- 背景：`var(--color-bg-elevated)`

### 2.3 状态

- Placeholder：`--color-text-tertiary`
- Focus：边框和 ring 高亮
- Error：红色边框 + 辅助错误文案
- Disabled：降透明 + 禁用 cursor

---

## 3. Card

### 3.1 基础卡片

- 背景：`var(--color-bg-elevated)`
- 边框：`1px solid var(--color-border)`
- 圆角：`var(--radius-lg)`
- Padding：`var(--space-4)`

### 3.2 可交互卡片

- Hover：边框增强 + 轻阴影
- Active：可轻微缩放

### 3.3 数据积木卡片（结构）

- Header：标题 + 操作按钮（刷新/删除）
- Content：核心数据区
- Footer：最后更新时间

---

## 4. Status Badge

### 4.1 账号状态

| 状态 | 颜色 | 文案 |
|------|------|------|
| 在线 | 绿 | 在线 |
| 离线 | 红 | 离线 |
| 验证中 | 黄 | 验证中 |

### 4.2 任务状态

- 运行中：绿
- 已暂停：灰
- 失败：红
- 已完成：中性/成功态

---

## 5. Sidebar

### 5.1 结构

- 固定导航区 + 主内容区
- 导航项支持默认/hover/active 三态

### 5.2 导航图标规范

- 推荐 Lucide 图标
- 尺寸统一 16px

---

## 6. Modal

### 6.1 通用规则

- 遮罩 + 面板结构
- ESC 可关闭（高危操作可关闭该能力）
- 底部操作区默认 Secondary + Primary

### 6.2 高危操作弹窗规则

- 删除类操作必须强调不可恢复性
- 可采用双步骤确认（例如账号彻底删除）

---

## 7. Toast

- 右上角提示
- 支持 success / error / info
- 自动消失，保留手动关闭能力

---

## 8. Dropdown

- 触发元素下方展开
- 选项 hover 与 selected 态明确区分
- 超长列表需滚动容器

---

## 9. Tabs

- 下划线式
- 选中态高亮
- 保持文字和内容层级清晰

---

## 10. Empty State

- 居中展示图标、标题、说明
- 可附带一个主操作按钮

---

## 11. Tooltip

- 简短解释型文案
- 不放长段内容
- 避免遮挡核心操作区

---

## 12. 执行建议（给后续 AI）

1. 新组件优先按本规范落地
2. 改旧组件时先保持行为稳定，再收敛视觉规范
3. 不为了“看起来统一”去改动已经验证通过的关键流程交互
4. 当规范与真实需求冲突时，以用户流程为先，并回写文档

---

## 文档版本

- 版本：2.0
- 创建日期：2026-04-15
- 最后更新：2026-04-16（补充规范状态与现状偏差说明）
