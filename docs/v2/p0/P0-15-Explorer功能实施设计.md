# P0-15 Explorer 功能实施设计文档

## 一、功能目标

实现一个真正可用的文件浏览器（Explorer），支持：

### 左侧 Explorer 面板
- 展示当前项目目录的文件夹和文件
- 文件夹支持展开/折叠，多层级递归展示
- 支持刷新当前目录
- 支持新建文件
- 支持新建文件夹
- 点击文件后在主显示区打开内容
- 点击文件夹后在主显示区显示该文件夹信息

### 主显示区
- **文本文件**：展示完整文本内容（支持 .txt, .md, .json, .ts, .tsx, .js, .jsx, .css, .html, .yml 等）
- **图片文件**：展示图片预览（支持 .png, .jpg, .jpeg, .gif, .webp, .svg）
- **其他文件**：显示占位信息（类型、路径、TODO）
- **目录**：展示该目录下的子项摘要

---

## 二、技术架构

### 2.1 整体架构原则

**不依赖第三方 Explorer 插件**，原因：
- 与 Tauri 文件系统集成不自然
- 难以贴合现有 VSCode-like 布局状态管理
- 后续能力扩展会被插件结构限制
- 样式容易失控

**采用分层架构**：
- **文件系统能力层**：由 Tauri 提供本地文件系统访问能力
- **React 视图层**：自己实现树节点渲染、展开/折叠、选中状态、懒加载

---

## 三、数据模型设计

### 3.1 核心类型定义

```typescript
// src/services/workspace/types.ts

export type ExplorerNodeType = 'file' | 'directory'

export interface ExplorerNode {
  id: string                    // 唯一标识，使用完整路径
  name: string                  // 文件/文件夹名称
  path: string                  // 相对于项目根目录的路径
  type: ExplorerNodeType        // 节点类型
  extension?: string            // 文件扩展名（仅文件有）
  children?: ExplorerNode[]     // 子节点（仅目录有）
  isExpanded?: boolean          // 是否展开（仅目录有）
  isLoaded?: boolean            // 子节点是否已加载（仅目录有）
}

export type ExplorerDetailType = 'directory' | 'text' | 'image' | 'unsupported'

export interface DirectoryDetail {
  type: 'directory'
  path: string
  name: string
  childCount: number
  children: ExplorerNode[]
}

export interface TextFileDetail {
  type: 'text'
  path: string
  name: string
  content: string
  extension?: string
  size: number
}

export interface ImageFileDetail {
  type: 'image'
  path: string
  name: string
  src: string                   // 图片 URL 或 data URL
  width?: number
  height?: number
  size: number
}

export interface UnsupportedFileDetail {
  type: 'unsupported'
  path: string
  name: string
  extension?: string
  size: number
  reason?: string
}

export type ExplorerDetail = 
  | DirectoryDetail 
  | TextFileDetail 
  | ImageFileDetail 
  | UnsupportedFileDetail
```

---

## 四、服务层设计

### 4.1 服务接口定义

```typescript
// src/services/workspace/types.ts

export interface WorkspaceService {
  // 获取项目根目录路径
  getRootPath(): Promise<string>
  
  // 读取目录内容
  readDirectory(path: string): Promise<ExplorerNode[]>
  
  // 读取文件内容
  readFile(path: string): Promise<string>
  
  // 获取节点详情（用于主显示区）
  getNodeDetail(path: string): Promise<ExplorerDetail>
  
  // 创建文件
  createFile(parentPath: string, name: string): Promise<ExplorerNode>
  
  // 创建文件夹
  createFolder(parentPath: string, name: string): Promise<ExplorerNode>
  
  // 判断文件类型
  getFileType(path: string): Promise<ExplorerDetailType>
}
```

### 4.2 Mock 实现

```typescript
// src/services/workspace/mock.ts

// 提供假数据用于 UI 开发和测试
// 模拟项目根目录结构
// 支持所有服务接口方法
```

### 4.3 Tauri 实现

```typescript
// src/services/workspace/tauri.ts

// 调用 Tauri 命令访问本地文件系统
// 使用 @tauri-apps/api/fs 模块
// 处理路径转换（相对路径 <-> 绝对路径）
// 处理文件编码（UTF-8）
// 处理图片文件（转换为 data URL 或使用 convertFileSrc）
```

### 4.4 Tauri 后端命令

需要在 Rust 侧实现以下命令：

```rust
// src-tauri/src/commands/workspace.rs

#[tauri::command]
pub async fn get_root_path() -> Result<String, String>

#[tauri::command]
pub async fn read_directory(path: String) -> Result<Vec<ExplorerNode>, String>

#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, String>

#[tauri::command]
pub async fn get_node_detail(path: String) -> Result<ExplorerDetail, String>

#[tauri::command]
pub async fn create_file(parent_path: String, name: String) -> Result<ExplorerNode, String>

#[tauri::command]
pub async fn create_folder(parent_path: String, name: String) -> Result<ExplorerNode, String>

#[tauri::command]
pub async fn get_file_type(path: String) -> Result<String, String>
```

---

## 五、状态管理设计

### 5.1 新增 Hook：useExplorerState

```typescript
// src/hooks/useExplorerState.ts

export function useExplorerState() {
  const [rootPath, setRootPath] = useState<string>('')
  const [treeData, setTreeData] = useState<ExplorerNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [detail, setDetail] = useState<ExplorerDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 初始化：加载根目录
  const initialize = async () => { ... }

  // 展开/折叠目录
  const toggleExpand = async (path: string) => { ... }

  // 选中节点
  const selectNode = async (path: string) => { ... }

  // 刷新目录
  const refresh = async (path?: string) => { ... }

  // 新建文件
  const createFile = async (parentPath: string, name: string) => { ... }

  // 新建文件夹
  const createFolder = async (parentPath: string, name: string) => { ... }

  return {
    rootPath,
    treeData,
    expandedPaths,
    selectedPath,
    detail,
    loading,
    error,
    initialize,
    toggleExpand,
    selectNode,
    refresh,
    createFile,
    createFolder,
  }
}
```

### 5.2 懒加载策略

**采用目录按需加载**，不一次性递归全项目：

- 初始只加载根目录的直接子项
- 展开某个文件夹时再读取其 children
- 读取后缓存到 treeData 中
- 刷新时可选择刷新当前层或整棵树

**优点**：
- 首屏加载快
- 大项目不会卡顿
- 展开状态易管理
- 更像 VS Code 的行为

---

## 六、组件设计

### 6.1 组件结构

```
src/components/
├── ExplorerSidebar.tsx          # 左侧 Explorer 主容器
├── ExplorerTreeNode.tsx         # 树节点组件（递归渲染）
├── ExplorerDetailPane.tsx       # 主显示区路由组件
├── TextFilePreview.tsx          # 文本文件预览
├── ImageFilePreview.tsx         # 图片文件预览
├── DirectoryDetailPane.tsx      # 目录详情面板
└── UnsupportedFilePane.tsx      # 不支持文件类型占位
```

### 6.2 ExplorerSidebar 组件

**职责**：
- 渲染顶部 actions（新建文件、新建文件夹、刷新）
- 渲染根目录树结构
- 处理顶部按钮点击事件

**Props**：
```typescript
interface ExplorerSidebarProps {
  treeData: ExplorerNode[]
  expandedPaths: Set<string>
  selectedPath: string | null
  onToggleExpand: (path: string) => void
  onSelectNode: (path: string) => void
  onRefresh: () => void
  onCreateFile: () => void
  onCreateFolder: () => void
}
```

### 6.3 ExplorerTreeNode 组件

**职责**：
- 渲染单个节点（文件夹或文件）
- 显示图标（文件夹/文件类型图标）
- 处理展开/折叠
- 递归渲染子节点
- 显示选中态

**Props**：
```typescript
interface ExplorerTreeNodeProps {
  node: ExplorerNode
  level: number
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: (path: string) => void
  onSelect: (path: string) => void
}
```

**交互逻辑**：
- 单击文件夹名称：展开/折叠
- 单击文件：选中并在主区打开
- 单击文件夹右侧箭头：只控制展开

### 6.4 ExplorerDetailPane 组件

**职责**：
- 根据 detail 类型路由到不同的预览组件

**Props**：
```typescript
interface ExplorerDetailPaneProps {
  detail: ExplorerDetail | null
  loading: boolean
  error: string | null
}
```

**路由逻辑**：
```typescript
if (loading) return <LoadingState />
if (error) return <ErrorState message={error} />
if (!detail) return <EmptyState />

switch (detail.type) {
  case 'text':
    return <TextFilePreview detail={detail} />
  case 'image':
    return <ImageFilePreview detail={detail} />
  case 'directory':
    return <DirectoryDetailPane detail={detail} />
  case 'unsupported':
    return <UnsupportedFilePane detail={detail} />
}
```

### 6.5 TextFilePreview 组件

**职责**：
- 展示文本文件完整内容
- 支持滚动
- 显示文件名、路径、大小等元信息

**Props**：
```typescript
interface TextFilePreviewProps {
  detail: TextFileDetail
}
```

### 6.6 ImageFilePreview 组件

**职责**：
- 展示图片预览
- 适配容器显示
- 显示文件名、尺寸、大小等元信息

**Props**：
```typescript
interface ImageFilePreviewProps {
  detail: ImageFileDetail
}
```

---

## 七、文件类型支持范围

### 7.1 v1 支持的文件类型

#### 文本文件
- `.txt`
- `.md`
- `.json`
- `.ts`, `.tsx`
- `.js`, `.jsx`
- `.css`, `.scss`, `.less`
- `.html`
- `.yml`, `.yaml`
- `.xml`
- `.sh`
- `.rs`
- `.toml`

#### 图片文件
- `.png`
- `.jpg`, `.jpeg`
- `.gif`
- `.webp`
- `.svg`

#### 其他文件
- 显示"不支持预览，后续扩展"占位信息

### 7.2 文件类型判断逻辑

```typescript
function getFileDetailType(extension: string): ExplorerDetailType {
  const textExtensions = [
    'txt', 'md', 'json', 'ts', 'tsx', 'js', 'jsx',
    'css', 'scss', 'less', 'html', 'yml', 'yaml',
    'xml', 'sh', 'rs', 'toml'
  ]
  
  const imageExtensions = [
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'
  ]
  
  if (textExtensions.includes(extension)) return 'text'
  if (imageExtensions.includes(extension)) return 'image'
  return 'unsupported'
}
```

---

## 八、与现有架构的集成

### 8.1 修改 layout.ts

```typescript
// src/config/layout.ts

// workspace 的 SidebarSectionConfig 更新
export const SIDEBAR_SECTION_CONFIG: Record<View, SidebarSectionConfig> = {
  workspace: {
    title: '工作区',
    description: '浏览项目文件和目录',
    actions: [
      { id: 'create-file', label: '新建文件', icon: 'add-file' },
      { id: 'create-folder', label: '新建文件夹', icon: 'add-folder' },
      { id: 'refresh-workspace', label: '刷新', icon: 'refresh' },
    ],
    emptyMessage: '当前目录为空',
  },
  // ... 其他 view 配置
}
```

### 8.2 修改 useAppLayoutState.ts

```typescript
// src/hooks/useAppLayoutState.ts

const handleSidebarAction = async (actionId: string) => {
  if (actionId === 'create-file') {
    // 触发新建文件对话框
    // 可以通过 state 控制，或直接调用 explorer hook
    return
  }

  if (actionId === 'create-folder') {
    // 触发新建文件夹对话框
    return
  }

  if (actionId === 'refresh-workspace') {
    // 触发刷新
    return
  }

  // ... 其他 action 处理
}
```

### 8.3 修改 CenterContentRouter.tsx

```typescript
// src/components/CenterContentRouter.tsx

function CenterContentRouter({ activeView, centerMode, selectedSidebarItem }: Props) {
  if (activeView === 'workspace') {
    if (centerMode === 'empty') {
      return <EmptyState message="请从左侧选择文件或文件夹" />
    }
    
    if (centerMode === 'detail' && selectedSidebarItem) {
      return <ExplorerDetailPane />
    }
  }

  // ... 其他 view 路由
}
```

### 8.4 修改 App.tsx

```typescript
// src/App.tsx

function App() {
  const layoutState = useAppLayoutState()
  const explorerState = useExplorerState()

  useEffect(() => {
    void explorerState.initialize()
  }, [])

  // 将 explorerState 通过 context 或 props 传递给相关组件
  // ...
}
```

---

## 九、实施阶段划分

### Phase 1：只读 Explorer（优先实现）

**目标**：先做稳定基本盘

**包含功能**：
- 读取根目录
- 展示树结构
- 展开/折叠目录（懒加载）
- 选中文件
- 主区预览文本文件
- 主区预览图片文件
- 刷新当前目录

**不包含**：
- 新建文件/文件夹
- 重命名
- 删除
- 右键菜单

**验收标准**：
- 能够浏览项目目录树
- 能够展开/折叠文件夹
- 能够选中文件并在主区查看内容
- 文本文件内容正确显示
- 图片文件正确预览
- 刷新功能正常工作

### Phase 2：基础管理（后续实现）

**包含功能**：
- 新建文件
- 新建文件夹
- 选中态保持
- 创建后自动选中新节点

**验收标准**：
- 能够通过顶部按钮新建文件/文件夹
- 新建后树结构正确更新
- 新建的节点自动选中并在主区显示

### Phase 3：增强功能（未来扩展）

**包含功能**：
- 重命名文件/文件夹
- 删除文件/文件夹
- 右键菜单
- 拖拽排序
- 多标签打开
- 文本编辑保存
- 搜索过滤

---

## 十、技术风险与注意事项

### 10.1 路径与平台兼容

**风险**：
- Windows 和 macOS/Linux 路径分隔符不同
- 相对路径与绝对路径转换

**解决方案**：
- 统一使用相对路径（相对于项目根目录）
- Tauri 侧使用 `std::path::Path` 处理路径
- 前端使用 `/` 作为分隔符，Tauri 侧自动转换

### 10.2 图片读取方式

**风险**：
- 图片文件如何在 Tauri 中安全读取并展示

**解决方案**：
- 使用 Tauri 的 `convertFileSrc` API 将本地路径转换为安全的 URL
- 或者读取文件内容并转换为 data URL（适合小图片）

### 10.3 大文件处理

**风险**：
- 文本文件可能非常大，一次性加载会卡顿

**解决方案**：
- Phase 1 先不处理，假设文件不会太大
- Phase 2+ 添加文件大小检查，超过阈值（如 1MB）显示警告或分页加载

### 10.4 二进制文件误判

**风险**：
- 将二进制文件当作文本打开会显示乱码

**解决方案**：
- 使用扩展名白名单判断文件类型
- 不在白名单内的文件显示为 unsupported

### 10.5 权限与根目录

**风险**：
- Tauri 应用可能没有权限访问某些目录

**解决方案**：
- Phase 1 只展示当前项目根目录（Tauri 应用自身目录）
- 后续如需访问其他目录，需要用户授权

### 10.6 编码问题

**风险**：
- 文件可能不是 UTF-8 编码

**解决方案**：
- Phase 1 假设所有文本文件都是 UTF-8
- 读取失败时显示错误信息
- Phase 2+ 添加编码检测和转换

---

## 十一、具体文件修改清单

### 11.1 新增文件

```
src/services/workspace/
├── types.ts                     # 新增 ExplorerNode、ExplorerDetail 等类型
├── mock.ts                      # 更新：添加 Explorer 相关 mock 方法
├── tauri.ts                     # 更新：添加 Explorer 相关 Tauri 调用
└── index.ts                     # 更新：导出新方法

src/hooks/
└── useExplorerState.ts          # 新增：Explorer 状态管理 hook

src/components/
├── ExplorerSidebar.tsx          # 新增：左侧 Explorer 主容器
├── ExplorerTreeNode.tsx         # 新增：树节点组件
├── ExplorerDetailPane.tsx       # 新增：主显示区路由组件
├── TextFilePreview.tsx          # 新增：文本文件预览
├── ImageFilePreview.tsx         # 新增：图片文件预览
├── DirectoryDetailPane.tsx      # 新增：目录详情面板
└── UnsupportedFilePane.tsx      # 新增：不支持文件类型占位

src-tauri/src/commands/
└── workspace.rs                 # 更新：添加 Explorer 相关命令
```

### 11.2 修改文件

```
src/config/layout.ts             # 更新 workspace 的 SidebarSectionConfig
src/hooks/useAppLayoutState.ts   # 更新 handleSidebarAction
src/components/CenterContentRouter.tsx  # 更新 workspace 路由逻辑
src/components/WorkspaceDetailPane.tsx  # 替换为 ExplorerDetailPane
src/App.tsx                      # 集成 useExplorerState
src-tauri/src/main.rs            # 注册新的 Tauri 命令
```

---

## 十二、开发顺序建议

### Step 1：数据模型和服务接口
1. 定义 `ExplorerNode` 和 `ExplorerDetail` 类型
2. 定义 `WorkspaceService` 接口
3. 实现 mock 版本的服务方法

### Step 2：状态管理
1. 实现 `useExplorerState` hook
2. 实现懒加载逻辑
3. 实现展开/折叠、选中逻辑

### Step 3：左侧 Explorer 组件
1. 实现 `ExplorerTreeNode` 组件
2. 实现 `ExplorerSidebar` 组件
3. 集成到 `LeftSidebar`

### Step 4：主显示区组件
1. 实现 `TextFilePreview` 组件
2. 实现 `ImageFilePreview` 组件
3. 实现 `DirectoryDetailPane` 组件
4. 实现 `UnsupportedFilePane` 组件
5. 实现 `ExplorerDetailPane` 路由组件

### Step 5：集成到主应用
1. 修改 `CenterContentRouter`
2. 修改 `useAppLayoutState`
3. 修改 `App.tsx`
4. 测试 mock 版本

### Step 6：Tauri 后端实现
1. 实现 Rust 侧的文件系统命令
2. 实现前端 Tauri 服务调用
3. 测试真实文件系统访问

### Step 7：Phase 2 功能
1. 实现新建文件对话框
2. 实现新建文件夹对话框
3. 实现创建逻辑
4. 测试完整流程

---

## 十三、UI 设计规范

### 13.1 左侧 Explorer 样式

- 树节点缩进：每层 16px
- 文件夹图标：展开/折叠箭头 + 文件夹图标
- 文件图标：根据扩展名显示不同图标
- 选中态：背景色高亮
- hover 态：背景色浅高亮

### 13.2 主显示区样式

- 文本预览：等宽字体，保留原始格式
- 图片预览：居中显示，最大宽度 100%
- 目录详情：卡片式布局，显示子项列表
- 不支持文件：居中显示占位信息

### 13.3 顶部 Actions 样式

- 图标按钮，hover 显示 tooltip
- 从左到右：新建文件、新建文件夹、刷新

---

## 十四、测试计划

### 14.1 单元测试

- `useExplorerState` hook 的状态管理逻辑
- 文件类型判断函数
- 路径处理函数

### 14.2 集成测试

- 读取目录功能
- 展开/折叠功能
- 选中节点功能
- 刷新功能
- 新建文件/文件夹功能

### 14.3 端到端测试

- 完整的浏览文件流程
- 完整的新建文件流程
- 完整的新建文件夹流程

---

## 十五、性能优化

### 15.1 懒加载

- 只加载可见节点的子节点
- 展开时才加载子节点

### 15.2 虚拟滚动

- Phase 3 考虑：如果目录层级很深，使用虚拟滚动优化渲染性能

### 15.3 缓存策略

- 已加载的目录内容缓存在内存中
- 刷新时清除缓存重新加载

---

## 十六、总结

本设计文档提供了 Explorer 功能的完整实施方案，包括：

1. **清晰的功能目标**：只读浏览 + 基础管理
2. **完整的技术架构**：服务层 + 状态管理 + 组件层
3. **详细的数据模型**：类型定义清晰，易于扩展
4. **分阶段实施计划**：Phase 1 先做稳定基本盘，Phase 2 添加管理功能
5. **风险识别与解决方案**：路径、编码、大文件等问题都有预案
6. **具体的文件修改清单**：明确哪些文件需要新增或修改

**下一步行动**：
- 用户确认本设计方案
- 开始 Phase 1 实施：只读 Explorer
- 按照开发顺序逐步实现各个模块
