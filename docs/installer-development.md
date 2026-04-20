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
└── clawbot/                        # ClawBot 库（全局共享）
    ├── __init__.py
    ├── client.py
    ├── config.py
    ├── services/
    ├── domain/
    ├── transport/
    ├── workflows/
    └── examples/                   # 示例脚本
        ├── publish_tweet.py
        ├── reply_with_media.py
        ├── read_timeline.py
        ├── ai_reply_pinned_tweet.py
        └── ...
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

## 12. 测试清单

- [ ] 全新安装（无 Python）
- [ ] 全新安装（有 Python）
- [ ] Python 版本过低
- [ ] 安装失败重试
- [ ] 手动安装验证
- [ ] 更新检测
- [ ] 跨平台测试（macOS, Windows, Linux）
