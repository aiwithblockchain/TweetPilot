# 任务模块架构设计

## 1. 设计理念

### 1.1 核心原则

**关注点分离**：Task 模块只负责任务的生命周期管理，不关心任务如何执行。

**架构分层**：
```
┌─────────────────────────────────────────────────────────┐
│                    Task Module                          │
│         (任务管理、调度、执行调度、历史追踪)                │
│                                                         │
│  职责：                                                  │
│  - 任务 CRUD                                            │
│  - 任务调度（Cron）                                      │
│  - 执行触发                                              │
│  - 结果记录                                              │
│  - 统计分析                                              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ 调用 Python 脚本
                      │ 传递参数
                      │ 捕获输出
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  User Python Script                     │
│              (用户编写的 Python 脚本)                     │
│                                                         │
│  用户自由选择：                                           │
│  - 使用 ClawBot (LocalBridge)                           │
│  - 使用 Twitter 官方 SDK                                 │
│  - 使用其他任何 Python 库                                │
│  - 混合使用多种方式                                       │
└─────────────────────────────────────────────────────────┘
```

### 1.2 设计哲学

**Task 模块的边界**：
- ✅ 管理任务元数据（名称、描述、状态）
- ✅ 调度任务执行（立即执行、定时执行）
- ✅ 传递参数给脚本（账号、任务参数）
- ✅ 捕获脚本输出（stdout、stderr、退出码）
- ✅ 记录执行历史和统计
- ❌ 不关心脚本内部使用什么 SDK
- ❌ 不关心脚本如何实现功能
- ❌ 不强制脚本使用特定的库

---

## 2. 任务数据模型

### 2.1 任务实体 (Task)

```typescript
interface Task {
  // 基础标识
  id: string
  name: string
  description?: string
  
  // 任务类型与状态
  type: 'immediate' | 'scheduled'
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  enabled: boolean
  
  // 脚本配置
  scriptPath: string              // Python 脚本路径（相对于工作目录）
  scriptContent?: string          // 脚本内容快照（版本追踪）
  scriptHash?: string             // 脚本 SHA256（检测变更）
  
  // 执行配置
  schedule?: string               // Cron 表达式（scheduled 类型）
  timeout?: number                // 超时时间（秒）
  retryCount?: number             // 失败重试次数
  retryDelay?: number             // 重试间隔（秒）
  
  // 账号标识（创建后不可变）
  accountId: string               // Twitter 账号唯一标识
  
  // 任务参数（传递给脚本）
  parameters: Record<string, any>
  
  // 执行历史
  lastExecution?: ExecutionResult
  lastExecutionTime?: string
  nextExecutionTime?: string
  
  // 统计信息
  statistics: TaskStatistics
  
  // 元数据
  createdAt: string
  updatedAt: string
  tags?: string[]
}
```

### 2.2 执行结果 (ExecutionResult)

```typescript
interface ExecutionResult {
  id: string
  taskId: string
  startTime: string
  endTime: string
  duration: number
  status: 'success' | 'failure'
  exitCode: number
  stdout: string
  stderr: string
  metadata?: Record<string, any>
}
```

---

## 3. 任务执行接口

### 3.1 执行流程

```
1. Task 模块触发执行
   ↓
2. 检查账号在线状态
   - 从内存中查询账号是否在线
   - 如果不在线，任务执行失败
   ↓
3. 构建 Python 命令
   - 脚本路径
   - 账号参数（--account）
   - 任务参数（--param1=value1）
   ↓
4. 执行 Python 脚本
   - 使用系统 Python
   - 设置超时
   - 捕获 stdout/stderr
   - 记录退出码
   ↓
5. 保存执行结果
   - 成功/失败状态
   - 输出内容
   - 执行时长
   ↓
6. 更新任务统计
   - 总执行次数
   - 成功/失败计数
   - 平均耗时
```

### 3.2 脚本调用约定

**命令行格式**：
```bash
python3 <script_path> \
  --account <account_id> \
  [--param1=value1] \
  [--param2=value2] \
  ...
```

**脚本输出约定**：
- 使用 `stdout` 输出正常信息
- 使用 `stderr` 输出错误信息
- 退出码 `0` 表示成功，非 `0` 表示失败
- 可选：输出 JSON 格式的元数据（最后一行）

---

## 4. 项目结构设计

### 4.1 目录结构

```
~/.tweetpilot/                      # 用户目录（全局）
└── clawbot/                        # ClawBot 库（全局共享）
    ├── __init__.py
    ├── client.py
    ├── services/
    ├── domain/
    └── examples/                   # 示例脚本（作为参考）
        ├── publish_tweet.py
        ├── reply_with_media.py
        └── ...

<workspace-root>/                   # 工作目录
├── .tweetpilot.json                # 项目标识文件（空文件）
├── .tweetpilot/                    # 项目配置目录
│   ├── tasks.db                    # 任务数据库（SQLite）
│   └── logs/                       # 执行日志
│       └── 2026-04-20/
│           └── task-123-exec-456.log
└── scripts/                        # 用户脚本目录
    ├── my_tweet.py
    ├── my_retweet.py
    └── custom/
        └── advanced.py
```

### 4.2 项目标识

**`.tweetpilot.json`**：
- 空文件，仅用于标识当前目录为 TweetPilot 项目
- 不存储任何配置信息

### 4.3 Python 环境

**使用系统 Python**：
- 依赖用户系统的 Python 环境
- 如果系统没有 Python，提示用户安装
- 预装 ClawBot 库到 `~/.tweetpilot/clawbot/`
- 用户可以自己安装其他库

---

## 5. 账号管理

### 5.1 账号在线状态

**内存中的账号信息**：
- 账号在线状态存储在内存中
- 任务执行前检查账号是否在线
- 如果账号不在线，任务执行失败并提示错误

**账号与任务的关系**：
- 每个任务绑定一个账号 ID
- 账号 ID 作为参数传递给脚本
- 脚本自己决定如何使用账号信息

---

## 6. 脚本管理

### 6.1 脚本存储

**用户自由管理**：
- 脚本可以放在工作目录的任意位置
- 推荐放在 `scripts/` 目录
- 任务记录脚本的相对路径

### 6.2 脚本参考

**ClawBot 示例脚本**：
- 位于 `~/.tweetpilot/clawbot/examples/`
- 用户可以参考这些示例
- AI 可以访问这些示例生成新脚本

---

## 7. 任务生命周期

### 7.1 状态机

```
[创建] → idle
         ↓
      [启用] → idle (enabled=true)
         ↓
      [执行] → running
         ↓
    ┌────┴────┐
    ↓         ↓
 success   failure
    ↓         ↓
    └────┬────┘
         ↓
      [完成] → idle (等待下次执行)
         
[暂停] → paused (scheduled 任务)
[恢复] → idle
[禁用] → idle (enabled=false)
[删除] → [从数据库删除]
```

### 7.2 执行流程

1. **验证任务状态** - 检查是否可执行
2. **检查账号在线** - 从内存查询账号状态
3. **检测脚本变更** - 通过 Hash 对比
4. **构建执行命令** - Python + 脚本路径 + 参数
5. **执行脚本** - 设置超时、捕获输出
6. **保存执行结果** - 记录到数据库
7. **更新统计信息** - 成功率、平均耗时
8. **处理重试逻辑** - 失败时根据配置重试
9. **计算下次执行** - 定时任务计算下次执行时间

---

## 8. 数据存储

### 8.1 数据库设计

**tasks 表**：
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  
  script_path TEXT NOT NULL,
  script_content TEXT,
  script_hash TEXT,
  
  schedule TEXT,
  timeout INTEGER,
  retry_count INTEGER DEFAULT 0,
  retry_delay INTEGER DEFAULT 60,
  
  account_id TEXT NOT NULL,
  
  parameters TEXT,  -- JSON
  
  last_execution_time TEXT,
  next_execution_time TEXT,
  
  total_executions INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  average_duration REAL DEFAULT 0,
  
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  tags TEXT
);
```

**executions 表**：
```sql
CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration REAL,
  status TEXT NOT NULL,
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  metadata TEXT,  -- JSON
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

---

## 9. 用户体验设计

### 9.1 创建任务流程

```
1. 基本信息
   - 任务名称
   - 任务描述
   - 选择账号

2. 选择脚本
   - 从当前工作目录选择 Python 文件
   - 默认从工作目录根开始查找
   - 支持子目录

3. 配置参数
   - 任务类型（immediate / scheduled）
   - 调度规则（scheduled 类型）
   - 任务参数（key-value）

4. 保存任务
```

---

## 10. 关键设计优势

### 10.1 简单性

- Task 模块职责清晰
- 不需要维护 SDK 抽象层
- 代码量小

### 10.2 灵活性

- 用户完全自由选择实现方式
- 可以使用任何 Python 库
- 不受 Task 模块限制

### 10.3 可维护性

- Task 模块代码简单
- 不需要跟随 SDK 更新
- 清晰的责任边界

---

## 11. 实施路线图

### Phase 1: 核心任务模块（3-4 天）
- 任务 CRUD 操作
- 任务数据库设计
- 任务执行引擎（调用 Python 脚本）
- 执行结果记录

### Phase 2: 调度系统（2-3 天）
- Cron 解析器
- 任务调度器
- 定时任务执行
- 并发控制

### Phase 3: UI 实现（3-4 天）
- 任务列表与详情
- 任务创建/编辑界面
- 执行历史查看

**注意**：UI 实现过程中使用 `/design-consultation` skill 进行界面设计和优化

---

## 12. 前置依赖

**ClawBot 环境准备**（由安装程序完成，见《安装程序开发文档》）：
- 安装 ClawBot 到 `~/.tweetpilot/clawbot/`
- 复制示例脚本
- 配置 Python 环境

---

## 13. 总结

**核心设计思想**：

1. **职责单一** - Task 模块只管理任务生命周期
2. **接口简单** - 通过命令行参数传递信息
3. **用户自由** - 脚本实现完全由用户决定
4. **AI 驱动** - 通过 AI 生成脚本降低开发门槛

**ClawBot 的角色**：
- 全局共享的 Python 库
- 提供示例脚本作为参考
- AI 生成脚本的参考资料
