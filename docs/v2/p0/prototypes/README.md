# TweetPilot P0 阶段 A - UI 原型

这是 TweetPilot P0 阶段 A 的功能完整的高保真 UI 原型。

## 功能概述

本原型实现了 P0 阶段 A 的所有核心功能：

1. **工作目录管理** - 选择本地目录、GitHub 克隆、最近使用历史
2. **Twitter 账号管理** - 账号映射、状态监控、删除映射
3. **定时任务管理** - 创建任务、配置参数、查看历史、执行控制
4. **数据积木** - 6 种数据卡片类型的网格展示
5. **系统设置** - 语言、主题、启动行为配置

## 技术实现

- **纯 HTML + CSS + JavaScript** - 无框架依赖
- **localStorage** - 模拟数据持久化
- **Mock 数据** - 模拟 LocalBridge 和 Twitter API
- **Canvas API** - 简单图表绘制

## 文件结构

```
docs/v2/p0/prototypes/
├── index.html                    # 入口页面（工作目录选择）
├── main.html                     # 主界面框架
├── pages/
│   ├── task-management.html      # 任务管理页面
│   ├── data-blocks.html          # 数据积木页面
│   └── settings.html             # 设置页面
├── js/
│   ├── utils.js                  # 工具函数
│   ├── mock-data.js              # Mock 数据
│   ├── workspace.js              # 工作目录管理
│   ├── account.js                # 账号管理
│   ├── task.js                   # 任务管理
│   └── data-blocks.js            # 数据积木管理
└── css/
    ├── base.css                  # 基础样式
    ├── layout.css                # 布局样式
    └── components.css            # 组件样式
```

## 如何使用

### 1. 启动原型

由于原型使用了 ES6 模块和 fetch API，需要通过 HTTP 服务器访问（不能直接用 file:// 协议打开）。

**方法 1：使用 Python 内置服务器**
```bash
cd docs/v2/p0/prototypes
python3 -m http.server 8000
```

然后在浏览器中访问：http://localhost:8000

**方法 2：使用 Node.js http-server**
```bash
cd docs/v2/p0/prototypes
npx http-server -p 8000
```

**方法 3：使用 VS Code Live Server 扩展**
- 安装 Live Server 扩展
- 右键点击 index.html
- 选择 "Open with Live Server"

### 2. 操作流程

#### 首次使用

1. **选择工作目录**
   - 打开 http://localhost:8000
   - 选择"选择本地目录"并输入路径（如：`/Users/user/projects/my-project`）
   - 或选择"从 GitHub 克隆"并输入仓库 URL
   - 或选择"最近使用"从历史记录中选择

2. **映射 Twitter 账号**
   - 进入"设置"页面
   - 点击"映射账号"按钮
   - 从弹出的列表中选择要映射的账号
   - 系统会自动验证账号状态

3. **创建任务**
   - 进入"任务管理"页面
   - 点击"创建任务"按钮
   - 填写任务信息：
     - 任务名称（必填）
     - 任务描述（可选）
     - Python 脚本路径（必填）
     - 任务类型（定时/即时）
     - 执行规则（定时任务需要）
   - 点击"创建"按钮

4. **查看数据**
   - 进入"数据积木"页面
   - 点击"添加卡片"按钮
   - 选择要添加的卡片类型
   - 卡片会自动加载并显示数据

#### 日常使用

- **执行任务**：在任务卡片上点击"立即执行"按钮
- **查看任务详情**：点击"查看详情"查看配置、统计、历史
- **暂停/恢复任务**：点击对应按钮控制任务状态
- **刷新数据卡片**：点击卡片右上角的刷新按钮
- **拖拽排序**：拖拽数据卡片可以调整顺序
- **账号状态检查**：系统会每 5 分钟自动检查账号状态

## Mock 数据说明

原型使用 Mock 数据模拟真实场景：

### 预设的 Twitter 账号
- @elonmusk (在线)
- @BillGates (在线)
- @sundarpichai (离线)
- @satyanadella (可映射)

### 预设的任务
- 每日推文发布（定时任务，运行中）
- 推文数据抓取（即时任务，已暂停）
- 互动数据统计（定时任务，运行中）

### 数据卡片类型
1. 账号推文统计 - 显示每个账号的推文总数
2. 最新推文列表 - 显示最新 10 条推文
3. 账号基础数据 - 关注数、被关注数等
4. 账号互动数据 - 浏览量、点赞数、转推数
5. 推文时间分布 - 最近 7 天的推文数量（柱状图）
6. 任务执行统计 - 最近 24 小时的执行情况（饼图）

## 数据持久化

原型使用 localStorage 模拟数据持久化：

- **全局数据**：
  - `current-workspace` - 当前工作目录
  - `recent-workspaces` - 最近使用的工作目录（最多 10 条）
  - `preferences` - 系统偏好设置

- **工作目录数据**（以工作目录路径为前缀）：
  - `{workspace}/accounts` - 账号映射配置
  - `{workspace}/tasks` - 任务配置列表
  - `{workspace}/execution-history` - 任务执行历史
  - `{workspace}/data-blocks-layout` - 数据卡片布局

## 功能限制

由于这是一个原型，存在以下限制：

1. **不是真实的 Electron 应用** - 在浏览器中运行
2. **无真实的 LocalBridge 通信** - 使用 Mock 数据模拟
3. **无真实的 Python 脚本执行** - 使用模拟输出
4. **无真实的 Twitter API 调用** - 使用 Mock 数据
5. **简化的图表实现** - 使用 Canvas 绘制基础图表
6. **无真实的文件系统操作** - 使用输入框模拟

## 浏览器兼容性

原型使用现代浏览器特性，建议使用：
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 开发说明

### 添加新的数据卡片类型

1. 在 `js/data-blocks.js` 的 `cardTypes` 数组中添加新类型
2. 在 `getCardData()` 方法中添加数据获取逻辑
3. 在 `pages/data-blocks.html` 中添加渲染函数

### 修改 Mock 数据

编辑 `js/mock-data.js` 文件，修改预设的账号、任务、推文等数据。

### 自定义样式

- 修改 `css/base.css` 中的 CSS 变量来调整颜色、间距等
- 修改 `css/components.css` 来调整组件样式

## 后续转换计划

原型完成后，可以按照以下步骤转换为真实的 Electron 应用：

1. 创建 Electron 项目结构
2. 集成 Vite 构建工具
3. 实现真实的文件系统操作（使用 Electron fs API）
4. 实现真实的 LocalBridge 通信（使用 IPC）
5. 实现真实的 Python 脚本执行（使用 child_process）
6. 替换 localStorage 为真实的文件存储
7. 添加真实的 Twitter API 集成

## 问题反馈

如果在使用原型过程中遇到问题，请检查：
1. 是否通过 HTTP 服务器访问（不能用 file:// 协议）
2. 浏览器控制台是否有错误信息
3. localStorage 是否被浏览器禁用

## 许可证

本原型仅用于内部开发和演示目的。
