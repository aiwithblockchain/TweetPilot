# 安装程序开发文档

## 1. 概述

TweetPilot 首次安装时需要完成环境初始化，包括 ClawBot 库的安装和配置。

---

## 2. 安装流程

### 2.1 首次启动检测

```
1. 检查 ~/.tweetpilot/ 目录是否存在
   ↓
2. 如果不存在，进入初始化流程
   ↓
3. 如果存在，跳过初始化
```

### 2.2 初始化步骤

```
1. 检查系统 Python
   - 检测 python3 是否存在
   - 检测 Python 版本（需要 3.8+）
   - 如果不存在，提示用户安装

2. 创建全局目录
   - 创建 ~/.tweetpilot/
   - 创建 ~/.tweetpilot/clawbot/

3. 安装 ClawBot
   - 复制 ClawBot 库到 ~/.tweetpilot/clawbot/
   - 安装依赖（requests）

4. 验证安装
   - 测试 Python 导入 ClawBot
   - 显示安装成功提示
```

---

## 3. 目录结构

### 3.1 安装后的全局目录

```
~/.tweetpilot/
└── clawbot/                        # ClawBot 根目录（全局共享）
    ├── clawbot/                    # ClawBot Python 包
    │   ├── __init__.py
    │   ├── client.py
    │   ├── config.py
    │   ├── services/
    │   ├── domain/
    │   ├── transport/
    │   └── workflows/
    ├── examples/                   # 示例脚本（可直接运行）
    │   ├── publish_tweet.py
    │   ├── reply_with_media.py
    │   ├── read_timeline.py
    │   ├── ai_reply_pinned_tweet.py
    │   └── ...
    ├── scripts/                    # 辅助脚本
    ├── tests/                      # 测试文件
    ├── utils/                      # 工具函数
    ├── README.md                   # 文档
    └── requirements.txt            # 依赖列表
```

### 3.2 ClawBot 来源

**从项目资源复制**：
- 源目录：`docs/clawBotCli/clawbot/`
- 目标目录：`~/.tweetpilot/clawbot/`
- 复制整个 `clawbot/` 目录

---

## 4. Python 环境检测

### 4.1 检测逻辑

```typescript
async function checkPythonEnvironment(): Promise<PythonCheckResult> {
  // 1. 检查 python3 命令
  const pythonExists = await commandExists('python3')
  
  if (!pythonExists) {
    return {
      status: 'not_found',
      message: 'Python 3 未安装'
    }
  }
  
  // 2. 检查 Python 版本
  const version = await getPythonVersion()
  
  if (version < '3.8') {
    return {
      status: 'version_too_old',
      message: `Python 版本过低 (${version})，需要 3.8+`
    }
  }
  
  return {
    status: 'ok',
    version
  }
}
```

### 4.2 错误提示

**Python 未安装**：
```
Python 3 未安装

TweetPilot 需要 Python 3.8 或更高版本。

请访问 https://www.python.org/downloads/ 下载安装。

安装完成后重启 TweetPilot。
```

**版本过低**：
```
Python 版本过低

当前版本：3.7
需要版本：3.8+

请升级 Python 后重启 TweetPilot。
```

---

## 5. ClawBot 安装

### 5.1 安装步骤

```rust
// src-tauri/src/installer.rs

pub async fn install_clawbot() -> Result<(), Error> {
    let home_dir = dirs::home_dir().ok_or("Cannot find home directory")?;
    let target_dir = home_dir.join(".tweetpilot/clawbot");
    
    // 1. 创建目标目录
    fs::create_dir_all(&target_dir)?;
    
    // 2. 获取源目录（打包在应用资源中）
    let source_dir = get_resource_dir()?.join("clawbot");
    
    // 3. 复制整个目录
    copy_dir_recursive(&source_dir, &target_dir)?;
    
    // 4. 安装依赖
    install_dependencies(&target_dir)?;
    
    Ok(())
}

fn install_dependencies(clawbot_dir: &Path) -> Result<(), Error> {
    // 安装 requests 库
    Command::new("python3")
        .args(&["-m", "pip", "install", "requests"])
        .output()?;
    
    Ok(())
}
```

### 5.2 验证安装

```rust
pub async fn verify_clawbot_installation() -> Result<bool, Error> {
    let home_dir = dirs::home_dir().ok_or("Cannot find home directory")?;
    let clawbot_dir = home_dir.join(".tweetpilot/clawbot");
    
    // 1. 检查目录存在
    if !clawbot_dir.exists() {
        return Ok(false);
    }
    
    // 2. 检查关键文件
    let required_files = vec![
        "__init__.py",
        "client.py",
        "config.py",
    ];
    
    for file in required_files {
        if !clawbot_dir.join(file).exists() {
            return Ok(false);
        }
    }
    
    // 3. 测试 Python 导入
    let output = Command::new("python3")
        .args(&["-c", "import sys; sys.path.insert(0, '~/.tweetpilot'); from clawbot import ClawBotClient"])
        .output()?;
    
    Ok(output.status.success())
}
```

---

## 6. 打包配置

### 6.1 Tauri 配置

```json
// src-tauri/tauri.conf.json
{
  "tauri": {
    "bundle": {
      "resources": [
        "resources/clawbot/**"
      ]
    }
  }
}
```

### 6.2 构建脚本

```bash
#!/bin/bash
# scripts/prepare-resources.sh

# 1. 创建资源目录
mkdir -p resources/clawbot

# 2. 复制 ClawBot 库
cp -r docs/clawBotCli/clawbot/* resources/clawbot/

# 3. 清理 .pyc 文件
find resources/clawbot -name "*.pyc" -delete
find resources/clawbot -name "__pycache__" -type d -delete

echo "Resources prepared"
```

---

## 7. 用户界面

### 7.1 初始化界面

```
┌─────────────────────────────────────────┐
│                                         │
│         TweetPilot 初始化               │
│                                         │
│  正在准备环境...                         │
│                                         │
│  ✓ 检测 Python 环境                     │
│  ✓ 创建配置目录                         │
│  ⏳ 安装 ClawBot 库...                  │
│  ⏳ 安装依赖...                         │
│                                         │
│  [进度条: 60%]                          │
│                                         │
└─────────────────────────────────────────┘
```

### 7.2 完成界面

```
┌─────────────────────────────────────────┐
│                                         │
│         初始化完成！                     │
│                                         │
│  ✓ Python 环境就绪                      │
│  ✓ ClawBot 库已安装                     │
│  ✓ 示例脚本已准备                       │
│                                         │
│  现在可以开始使用 TweetPilot 了          │
│                                         │
│         [开始使用]                       │
│                                         │
└─────────────────────────────────────────┘
```

---

## 8. 错误处理

### 8.1 安装失败

```
如果安装失败：
1. 显示详细错误信息
2. 提供重试选项
3. 提供手动安装指南
4. 提供跳过选项（高级用户）
```

### 8.2 手动安装指南

```
手动安装 ClawBot

如果自动安装失败，请手动执行以下步骤：

1. 创建目录
   mkdir -p ~/.tweetpilot/clawbot

2. 复制 ClawBot 库
   cp -r /path/to/TweetPilot/resources/clawbot/* ~/.tweetpilot/clawbot/

3. 安装依赖
   python3 -m pip install requests

4. 重启 TweetPilot
```

---

## 9. 更新机制

### 9.1 版本检测

```typescript
async function checkClawBotVersion(): Promise<VersionCheckResult> {
  const installedVersion = await getInstalledClawBotVersion()
  const bundledVersion = await getBundledClawBotVersion()
  
  if (installedVersion < bundledVersion) {
    return {
      needsUpdate: true,
      installedVersion,
      bundledVersion
    }
  }
  
  return { needsUpdate: false }
}
```

### 9.2 更新提示

```
发现 ClawBot 新版本

已安装版本：1.0.0
最新版本：1.1.0

是否更新？

[更新]  [稍后]  [不再提示]
```

---

## 10. 实施优先级

### P0（必须）
- Python 环境检测
- ClawBot 安装
- 基础错误处理

### P1（重要）
- 安装进度显示
- 验证安装
- 手动安装指南

### P2（可选）
- 版本检测
- 自动更新
- 详细日志

---

## 11. 工作目录初始化

### 11.1 触发时机

当用户选择或打开一个工作目录时，检查是否为 TweetPilot 项目：
- 如果存在 `.tweetpilot.json`，直接加载
- 如果不存在，提示用户初始化

### 11.2 初始化流程

```
1. 用户选择工作目录
   ↓
2. 检查 .tweetpilot.json 是否存在
   ↓
3. 如果不存在，显示初始化提示
   "是否将此目录初始化为 TweetPilot 项目？"
   [初始化]  [取消]
   ↓
4. 创建项目结构
   - 创建 .tweetpilot.json（空文件）
   - 创建 .tweetpilot/ 目录
   - 创建 .tweetpilot/tasks.db
   - 创建 .tweetpilot/logs/
   ↓
5. 初始化完成
```

### 11.3 目录结构

```
<workspace-root>/
├── .tweetpilot.json                # 项目标识（空文件）
└── .tweetpilot/                    # 项目配置目录
    ├── tasks.db                    # 任务数据库
    └── logs/                       # 执行日志
```

### 11.4 实现要点

- `.tweetpilot.json` 是空文件，仅用于标识
- `.tweetpilot/` 目录存储项目数据
- 数据库在首次访问时自动创建
- 日志目录按日期组织

---

## 12. Python 脚本管理方案

### 12.1 目录结构约定

TweetPilot 支持两种类型的 Python 资源：

**全局 ClawBot 代码库**（系统自带）：
```
~/.tweetpilot/clawbot/
├── clawbot/                    # ClawBot Python 包（核心库）
│   ├── __init__.py
│   ├── client.py
│   ├── config.py
│   ├── services/
│   ├── domain/
│   ├── transport/
│   └── workflows/
├── examples/                   # 示例脚本
│   ├── publish_tweet.py
│   ├── reply_with_media.py
│   └── ...
├── README.md                   # 文档
└── api_docs.json              # API 文档
```

**用户自定义脚本**（用户开发）：
```
<workspace-root>/scripts/
├── my_script.py
└── ...
```

### 12.2 AI 脚本管理能力

通过在 AI Session 的 System Prompt 中注入以下约定，实现脚本解释和脚本生成功能：

#### System Prompt 配置

```markdown
## Python 代码库访问能力

你可以访问完整的 ClawBot Python 代码库和用户自定义脚本：

1. **ClawBot 代码库** (`~/.tweetpilot/clawbot/`)
   - 完整的 ClawBot Python 包，包含所有源代码、文档和示例
   - 你可以读取任何文件来理解 API、实现细节和使用方法
   - 核心库：`~/.tweetpilot/clawbot/clawbot/` (client.py, services/, domain/, transport/, workflows/)
   - 示例脚本：`~/.tweetpilot/clawbot/examples/` (publish_tweet.py, reply_with_media.py 等)
   - 文档：`~/.tweetpilot/clawbot/README.md`, `~/.tweetpilot/clawbot/api_docs.json`
   - 使用 Glob 工具查看：`~/.tweetpilot/clawbot/**/*.py`
   - 使用 Read 工具读取任何源代码、文档或示例

2. **用户自定义脚本** (`{working_dir}/scripts/`)
   - 用户自己开发的脚本
   - 可以修改和扩展
   - 使用 Glob 工具查看：`{working_dir}/scripts/*.py`
   - 使用 Read 工具读取脚本内容

### 代码理解能力

当用户询问 ClawBot 功能或脚本时：
1. 使用 Read 工具读取相关源代码、文档或示例
2. 分析代码实现、API 接口、参数说明
3. 用简洁的语言解释功能、用法和最佳实践
4. 可以引用具体的代码位置和示例

### 脚本生成能力

当用户要求生成脚本时：
1. 先读取 ClawBot 源代码和示例，理解正确的 API 用法
2. 使用 Write 工具创建脚本到 `{working_dir}/scripts/` 目录
3. 确保脚本遵循 ClawBot 的最佳实践
4. 包含必要的注释和使用说明
5. 告诉用户如何运行脚本（需要配置 ClawBot 凭证）
```

### 12.3 实现方式

**无需修改代码**，只需要：

1. **在 ClaurstSession 初始化时注入 System Prompt**
   - 位置：[src-tauri/src/claurst_session.rs](src-tauri/src/claurst_session.rs)
   - 使用 Claurst 的 System Prompt 机制注入上述配置

2. **确保用户工作区有 scripts/ 目录**
   - 在工作目录初始化时自动创建 `scripts/` 目录
   - 或在首次使用时由 AI 自动创建

### 12.4 用户体验

用户可以直接在 AI 对话中：

**理解 ClawBot API**：
```
用户: "ClawBot 怎么发推文？"
AI: 读取 ~/.tweetpilot/clawbot/clawbot/client.py 和相关源代码，解释 API 用法
```

**查看示例代码**：
```
用户: "有哪些示例脚本？"
AI: 使用 Glob 列出 ~/.tweetpilot/clawbot/examples/ 下的所有脚本
```

**深入理解实现**：
```
用户: "ClawBot 的 transport 层是怎么工作的？"
AI: 读取 ~/.tweetpilot/clawbot/clawbot/transport/ 下的源代码并解释架构
```

**生成新脚本**：
```
用户: "帮我生成一个自动点赞的脚本"
AI: 先读取 ClawBot 源代码和示例，理解正确的 API 用法，然后生成脚本到 {working_dir}/scripts/auto_like.py
```

### 12.5 工作目录初始化扩展

在第 11 章的工作目录初始化流程中，添加 `scripts/` 目录创建：

```
4. 创建项目结构
   - 创建 .tweetpilot.json（空文件）
   - 创建 .tweetpilot/ 目录
   - 创建 .tweetpilot/tasks.db
   - 创建 .tweetpilot/logs/
   - 创建 scripts/ 目录（用户自定义脚本）
```

更新后的目录结构：

```
<workspace-root>/
├── .tweetpilot.json                # 项目标识（空文件）
├── .tweetpilot/                    # 项目配置目录
│   ├── tasks.db                    # 任务数据库
│   └── logs/                       # 执行日志
└── scripts/                        # 用户自定义脚本目录
    └── README.md                   # 脚本说明（可选）
```

---

## 13. 测试清单

- [ ] 全新安装（无 Python）
- [ ] 全新安装（有 Python）
- [ ] Python 版本过低
- [ ] 安装失败重试
- [ ] 手动安装验证
- [ ] 更新检测
- [ ] 跨平台测试（macOS, Windows, Linux）
