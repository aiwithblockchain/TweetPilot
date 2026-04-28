# Workspace Explorer 实施归档记录

## 状态

**已完成归档。**

本文件用于记录本轮 Workspace / Explorer 能力建设的背景、根因、交付结果与后续可选增强项，不再作为待实施方案使用。

---

## 背景与问题修正

本轮工作最初聚焦 Explore / Explorer 顶部的 3 个操作按钮：

1. 新建文件
2. 新建文件夹
3. 刷新工作区

重新核查运行时行为与代码链路后，问题被更准确地修正为：

- 这 3 个按钮在代码层面并非缺失
- 刷新按钮原本具备基础刷新逻辑
- 新建文件、新建文件夹虽然已有事件处理入口，但运行时点击后没有可见反馈
- 根因不是后端缺少创建能力，而是前端创建流程依赖 `window.prompt(...)` 获取名称
- 在当前 Tauri / WebView 环境中，`window.prompt(...)` 未产生有效交互，导致创建流程在入口处中断

因此，用户侧实际体验会认为“新建文件”和“新建文件夹”没有实现。

---

## 本轮已交付能力

当前 Workspace / Explorer 已完成以下能力：

- 新建文件
- 新建文件夹
- 刷新工作区
- 重命名文件 / 文件夹
- 删除文件 / 文件夹
- 删除确认弹窗
- 左侧工具栏入口
- 中间详情区入口
- 树节点右键菜单入口
- 文件 / 文件夹差异化右键菜单
- 最近创建 / 重命名节点高亮
- 右键菜单防溢出处理
- 桌面端 / 移动端链路打通
- hook / component / service 测试覆盖
- 构建通过

---

## 关键实现结论

### 1. 创建流程不再依赖 `window.prompt`

左侧 Explorer 已改为使用内联输入行收集名称：

- 点击“新建文件”或“新建文件夹”后立即显示输入行
- 支持 Enter 提交
- 支持 Esc 取消
- 支持 blur 时在非 pending 状态下取消
- 创建失败时可在当前区域显示错误信息

### 2. 刷新逻辑升级为基于工作区根目录重建树

刷新不再只是局部重载，而是：

- 基于工作区根目录重新构建目录树
- 尽量保留展开状态
- 尽量保留当前选中项
- 若选中项已不存在，则回退到最近仍存在的父节点或工作区根节点

### 3. Explorer 已补齐基础资源管理能力

除最初的 3 个按钮外，本轮还补齐了：

- 重命名
- 删除
- 删除确认
- 右键菜单
- 详情区操作入口

这使 Explorer 的行为更接近常见桌面 IDE 的基础文件管理体验。

### 4. 删除链路已补充回归修复

后续联调中发现删除确认流程存在卡住问题，已修复：

- 删除成功后确认弹窗能够正确关闭
- 删除后选中项会回退到最近可用路径，必要时回退到工作区根节点
- 已增加对应 hook 级回归测试

---

## 涉及的关键文件

### 前端状态与行为

- `src/hooks/useAppLayoutState.ts`
  - 负责 inline create / rename / delete / refresh 状态与行为
  - 负责刷新后的展开与选中状态协调

### 左侧 Explorer UI

- `src/components/LeftSidebar.tsx`
  - 渲染工具栏按钮、目录树、内联创建/重命名、右键菜单、高亮态

### 应用接线

- `src/App.tsx`
  - 负责将删除确认弹窗与 Explorer 状态接入主界面
- `src/components/CenterContentRouter.tsx`
- `src/components/WorkspaceDetailPane.tsx`
- `src/components/EditorTabsBar.tsx`
- `src/components/MobileSidebarDrawer.tsx`

### 配置与服务

- `src/config/layout.ts`
- `src/services/workspace/types.ts`
- `src/services/workspace/index.ts`
- `src/services/workspace/tauri.ts`

### Tauri 后端

- `src-tauri/src/commands/workspace.rs`
- `src-tauri/src/main.rs`

### 测试

- `src/components/LeftSidebar.test.tsx`
- `src/hooks/useAppLayoutState.test.tsx`
- `src/services/workspace/tauri.test.ts`

---

## 验证结果

本轮交付已覆盖：

- component 测试
- hook 测试
- service 测试
- 构建验证

已验证的关键链路包括：

- 新建文件 / 文件夹的内联输入与提交流程
- 创建成功后树结构刷新与自动选中
- 重命名状态打开与提交流程
- 删除确认状态打开、删除成功关闭与选中回退
- 刷新后选中项失效时回退到最近可用祖先节点
- 文件 / 文件夹右键菜单差异化展示
- 最近创建 / 重命名节点高亮

---

## 为什么保留本归档文档

本文件保留的原因不是“还有计划没做完”，而是为了沉淀以下信息：

- 本轮问题的真实根因不是按钮缺失，而是 `window.prompt(...)` 在运行环境中失效
- Explorer 当前的状态设计与交互设计有明确背景，不是随意扩展
- 后续继续演进 Explorer 时，可以快速理解本轮为什么这样改

因此，本文件被保留为**实施归档记录**，而不是待办计划。

---

## 后续可选增强项

如果后续继续迭代，可优先考虑：

1. 自动滚动到最近创建 / 重命名的节点
2. 高亮态增加更自然的淡出动画
3. 右键菜单增加分隔线与更强的视觉层次
4. 进一步统一工具栏、详情区、右键菜单文案
5. 扩展拖拽、批量操作或更多文件管理能力

---

## 最终结论

本轮 Workspace / Explorer 改造已经完成，原先名为“explore-actions-implementation-plan”的文档不再适合作为计划文档保留。其核心价值已经从“待实施方案”转变为“问题根因、交付范围与实现决策的归档记录”。
