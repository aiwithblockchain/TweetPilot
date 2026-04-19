# P0-15 Explorer 功能待办事项

## 当前状态

Phase 1（只读 Explorer）已基本完成：
- ✅ 目录树展示（懒加载）
- ✅ 展开/折叠文件夹
- ✅ 文本文件预览
- ✅ 图片文件预览
- ✅ 目录统计信息
- ✅ 工作目录选择（起始页）
- ✅ 深色主题统一

## 待实现功能（Phase 2）

### 1. 刷新功能
**问题**：左侧顶部的刷新按钮不可用

**需要实现**：
- 点击刷新按钮后重新加载当前工作目录
- 刷新已展开的文件夹内容
- 保持当前选中状态

**相关文件**：
- `src/hooks/useAppLayoutState.ts` - `handleSidebarAction` 中的 `refresh-workspace` 逻辑
- `src/components/LeftSidebar.tsx` - 刷新按钮绑定

### 2. 新建文件
**问题**：新建文件按钮不可用

**需要实现**：
- 点击新建文件按钮弹出输入框
- 输入文件名后在当前选中目录下创建文件
- 创建后自动选中新文件并在主区打开

**相关文件**：
- `src/hooks/useAppLayoutState.ts` - `handleWorkspaceCreate('file')` 逻辑
- `src/services/workspace` - `createFile` 方法（已有）

### 3. 新建文件夹
**问题**：新建文件夹按钮不可用

**需要实现**：
- 点击新建文件夹按钮弹出输入框
- 输入文件夹名后在当前选中目录下创建
- 创建后自动展开并选中新文件夹

**相关文件**：
- `src/hooks/useAppLayoutState.ts` - `handleWorkspaceCreate('folder')` 逻辑
- `src/services/workspace` - `createFolder` 方法（已有）

### 4. 文本编辑
**问题**：文本文件只能预览，不能编辑

**需要实现**（Phase 3）：
- 在文本预览区添加编辑模式切换
- 支持文本编辑
- 保存修改到文件

**相关文件**：
- `src/components/TextFilePreview.tsx` - 需要添加编辑模式
- 需要新增保存文件的服务方法

## 技术债务

1. **类型错误**：编译时有多个 TypeScript 类型错误需要修复
2. **未使用的组件**：`ExplorerSidebar.tsx` 等新组件未被使用，可以考虑清理或集成
3. **状态管理**：`useExplorerState` hook 创建了但未使用，当前复用了 `useAppLayoutState`

## 优先级建议

**高优先级**（Phase 2）：
1. 刷新功能 - 用户体验必需
2. 新建文件 - 基础管理功能
3. 新建文件夹 - 基础管理功能

**中优先级**（Phase 3）：
4. 文本编辑 - 增强功能

**低优先级**（未来）：
- 重命名文件/文件夹
- 删除文件/文件夹
- 右键菜单
- 拖拽排序
- 文件搜索
