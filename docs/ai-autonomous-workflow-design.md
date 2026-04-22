# AI 自主工作流任务技术方案

**文档版本**: 1.0  
**创建日期**: 2026-04-22  
**状态**: 设计阶段  
**实施阶段**: 第二阶段

---

## 一、方案概述

### 1.1 核心目标

实现一个**自然语言驱动的 AI 自主工作流系统**，让用户通过简单的文字描述即可创建复杂的定时任务，由 AI 自主决定执行流程，无需预定义步骤。每个推特账号拥有独立的 AI Session，保持人设一致性和上下文连续性。

### 1.2 典型应用场景

**场景：智能热点推文生成（账号级 AI Session）**

```
用户配置:
- 推特账号: @TechGirlMary (ID: 123)
- 账号人设: "刚参加工作的女大学生，对技术充满好奇但还在学习中，
            说话活泼可爱，偶尔用网络流行语，遇到不懂的会虚心请教"
- 定时: 每 4 小时
- 指令: "执行 scripts/fetch_trends.py 获取加密货币热点，
        分析后结合 knowledge/meshnet-protocol/ 下的产品信息生成推文，
        用 scripts/send_tweet.py 发送"

AI 自动执行 (使用账号专属 Session: account-123):
1. 调用 Bash 工具执行 fetch_trends.py
2. 读取脚本输出（热点数据）
3. 使用 Read 工具读取产品知识库
4. 分析热点与产品的关联点
5. 根据账号人设生成推文内容（活泼可爱的语气）
6. 调用 Bash 工具执行 send_tweet.py 发送推文

关键特性:
- AI Session 绑定账号 (account-123)，记住人设和历史推文
- 生成的推文符合 "刚工作的女大学生" 人设
- 避免重复之前发过的内容
- 随着时间推移，AI 会根据效果优化推文风格
```

---

## 二、技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│  UnifiedTimerManager (定时触发)                             │
│  - Interval: 每 N 小时                                       │
│  - Cron: 按 cron 表达式                                      │
└──────────────────┬──────────────────────────────────────────┘
                   │ 触发 (携带 account_id)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  AiAutonomousExecutor (AI 自主执行器)                       │
│  - 根据 account_id 获取或创建账号级 AI Session               │
│  - 读取账号人设，注入 System Prompt                          │
│  - 发送初始指令                                              │
│  - 等待 AI 完成所有操作                                      │
└──────────────────┬──────────────────────────────────────────┘
                   │ 创建/复用
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Claurst AI Session (account-{account_id})                  │
│  - 账号级 Session ID，绑定推特账号                           │
│  - System Prompt 包含账号人设                                │
│  - 拥有完整工具链: Bash, Read, Write, Grep, Glob            │
│  - 自主决定执行流程                                          │
│  - 自动 Compact 管理上下文                                   │
│  - 记住历史推文，避免重复                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │ 工具调用
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  执行环境                                                    │
│  - Python 脚本执行                                           │
│  - 文件系统访问                                              │
│  - 产品知识库读取 (knowledge/meshnet-protocol/)             │
│  - 账号人设读取 (knowledge/personas/account-{id}.md)        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

#### 2.2.1 AiAutonomousExecutor

**职责**：
- 创建专用的 AI Session（与用户聊天会话隔离）
- 构建完整的初始提示词（包含知识库路径等上下文）
- 发送指令给 AI Session
- 等待 AI 完成所有操作并返回结果

**实现位置**：`src-tauri/src/unified_timer/executors/ai_autonomous_executor.rs`

**核心接口**：
```rust
pub struct AiAutonomousExecutor {
    account_id: i64,              // 推特账号 ID
    initial_prompt: String,       // 用户配置的任务指令
    working_dir: String,          // 工作目录
    knowledge_base: Option<String>, // 产品知识库路径（可选）
}

// 执行结果结构（暴露给外部系统）
#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,                    // 是否成功
    pub session_id: String,               // 使用的 Session ID
    pub duration_ms: u64,                 // 执行耗时（毫秒）
    pub message_count: usize,             // AI 消息数量
    pub tool_calls: Vec<ToolCallRecord>,  // 工具调用记录
    pub final_output: Option<String>,     // AI 最终输出
    pub error: Option<String>,            // 错误信息（如果失败）
    pub metadata: ExecutionMetadata,      // 元数据
}

// 工具调用记录
#[derive(Debug, Serialize, Deserialize)]
pub struct ToolCallRecord {
    pub tool: String,           // 工具名称 (Bash, Read, Write, etc.)
    pub action: String,         // 工具参数描述
    pub success: bool,          // 是否成功
    pub duration_ms: u64,       // 耗时
    pub output: Option<String>, // 输出（截断到 500 字符）
}

// 执行元数据
#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionMetadata {
    pub account_id: i64,
    pub task_id: i64,
    pub started_at: i64,        // Unix timestamp
    pub completed_at: i64,      // Unix timestamp
    pub token_usage: TokenUsage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
}

#[async_trait]
impl TimerExecutor for AiAutonomousExecutor {
    async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult>;
}

// 内部实现
impl AiAutonomousExecutor {
    // 获取或创建账号级 AI Session
    async fn get_or_create_session(&self) -> Result<ClaurstSession> {
        let session_id = format!("account-{}", self.account_id);
        
        // 如果 session 已存在，直接返回
        if let Some(session) = SESSION_MANAGER.get(&session_id) {
            return Ok(session);
        }
        
        // 创建新 session，注入账号人设
        let persona = self.load_persona().await?;
        let system_prompt = self.build_system_prompt(&persona);
        
        let session = ClaurstSession::new(
            session_id,
            self.working_dir.clone(),
            system_prompt,
        ).await?;
        
        SESSION_MANAGER.insert(session_id, session.clone());
        Ok(session)
    }
    
    // 加载账号人设
    async fn load_persona(&self) -> Result<String> {
        let persona_path = format!(
            "{}/knowledge/personas/account-{}.md",
            self.working_dir,
            self.account_id
        );
        
        // 如果人设文件存在，读取内容
        if Path::new(&persona_path).exists() {
            fs::read_to_string(&persona_path).await
        } else {
            // 从数据库读取人设字段
            let account = get_account_by_id(self.account_id).await?;
            Ok(account.persona.unwrap_or_default())
        }
    }
    
    // 加载全局敏感词库
    async fn load_sensitive_words(&self) -> Result<String> {
        let sensitive_words_path = format!(
            "{}/knowledge/global/sensitive-words.md",
            self.working_dir
        );
        
        if Path::new(&sensitive_words_path).exists() {
            fs::read_to_string(&sensitive_words_path).await
        } else {
            Ok("（未配置敏感词库）".to_string())
        }
    }
    
    // 加载全局内容审核策略
    async fn load_content_policy(&self) -> Result<String> {
        let policy_path = format!(
            "{}/knowledge/global/content-policy.md",
            self.working_dir
        );
        
        if Path::new(&policy_path).exists() {
            fs::read_to_string(&policy_path).await
        } else {
            Ok("（未配置内容审核策略）".to_string())
        }
    }
    
    // 构建 System Prompt（注入全局规则和人设）
    async fn build_system_prompt(&self, persona: &str) -> Result<String> {
        let sensitive_words = self.load_sensitive_words().await?;
        let content_policy = self.load_content_policy().await?;
        
        Ok(format!(
            "你是一个 AI 助手，负责为推特账号执行自动化任务。\n\n\
            ## 全局内容审核规则（最高优先级）\n\
            {}\n\n\
            **重要**：以下敏感词**绝对不能**出现在任何推文或回复中：\n\
            {}\n\n\
            如果你生成的内容包含任何敏感词，立即停止并报告错误。\n\
            不要尝试使用谐音、拼音、缩写等变体来绕过检查。\n\n\
            ## 账号人设\n\
            {}\n\n\
            在生成推文或回复时，请始终保持这个人设，使用符合人设的语气和风格。\n\
            避免重复之前发过的内容，根据历史效果优化推文质量。",
            content_policy,
            sensitive_words,
            persona
        ))
    }
}
```

#### 2.2.2 Claurst AI Session

**职责**：
- 理解用户的自然语言指令
- 自主决定执行步骤
- 调用工具完成任务（Bash、Read、Write、Grep、Glob）
- 处理中间结果和错误
- 自动管理上下文（内置 Compact 功能）
- **维护账号人设**：在整个 session 生命周期内保持账号的人设特征

**会话命名规范**：
```
account-{account_id}           // 账号级 Session（推荐）
user-chat-<uuid>               // 用户手动聊天
```

**重要设计决策：账号级 Session**

推荐使用**账号级 Session ID**（格式：`account-{account_id}`），原因：
- **人设一致性**：AI 在整个 session 中保持账号的人设特征（语气、风格、性格）
- **上下文连续性**：AI 记得之前生成的推文，避免重复
- **自我改进**：根据历史效果调整风格
- **成本优化**：不用每次重新加载知识库和人设
- **自动压缩**：Claurst 内置 Compact 功能，自动管理上下文

**Claurst 内置 Compact 机制**：

Claurst 是 Claude Code 的 Rust 实现，包含完整的自动上下文压缩功能：

```rust
// 来自 claurst/src-rust/crates/query/src/compact.rs

// 自动触发阈值
AUTOCOMPACT_TRIGGER_FRACTION: 0.90  // 90% 触发完整压缩
WARNING_PCT: 0.80                   // 80% 黄色警告
CRITICAL_PCT: 0.95                  // 95% 红色警告

// 压缩策略
KEEP_RECENT_MESSAGES: 10            // 保留最近 10 条消息
MAX_CONSECUTIVE_FAILURES: 3         // 连续失败 3 次后停止
```

**压缩工作原理**：
1. 监控 token 使用率
2. 达到 90% 时自动触发 compact
3. 按 API 轮次分组（user + assistant + tool calls）
4. 为旧消息组生成摘要
5. 保留最近 10 条消息 + 旧消息摘要
6. 继续使用同一个 Session

**无需手动管理**：Claurst 自动处理所有压缩逻辑，开发者无需编写额外代码。

**可用工具**：
- **Bash**: 执行 Python 脚本、Shell 命令
- **Read**: 读取文件内容（知识库、脚本输出等）
- **Write**: 保存中间结果
- **Grep**: 搜索代码库
- **Glob**: 查找文件

---

## 三、数据模型

### 3.1 任务配置

扩展现有的 `tasks` 表，添加 AI 工作流支持：

```sql
ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'python_script';
ALTER TABLE tasks ADD COLUMN ai_workflow_config TEXT;
ALTER TABLE tasks ADD COLUMN account_id INTEGER;  -- 关联推特账号

-- task_type 可选值:
-- 'python_script': 传统 Python 脚本任务
-- 'ai_workflow': AI 自主工作流任务
```

### 3.2 推特账号表扩展

为支持账号级 AI session 和人设管理，扩展 `accounts` 表：

```sql
ALTER TABLE accounts ADD COLUMN persona TEXT;  -- 账号人设描述

-- persona 示例:
-- "你是一个刚刚参加工作的女大学生，对技术充满好奇但还在学习中。
--  说话语气活泼可爱，偶尔会用一些网络流行语，遇到不懂的会虚心请教。
--  喜欢用emoji表达情绪，但不会过度使用。"
```

### 3.3 AI 工作流配置格式

```json
{
  "account_id": 123,  // 关联的推特账号 ID
  "initial_prompt": "执行 scripts/fetch_trends.py 获取热点，分析后结合 knowledge/product.md 生成推文，用 scripts/send_tweet.py 发送",
  "working_dir": "/Users/hyperorchid/MeshNetProtocol",
  "knowledge_base": "knowledge/meshnet-protocol/",
  "timeout_seconds": 600,
  "max_retries": 3
}
```

---

## 四、知识库组织

### 4.1 知识库目录结构

```
TweetPilot/
├── knowledge/
│   ├── global/                     # 全局配置（所有账号共享）
│   │   ├── sensitive-words.md      # 敏感词库（禁止出现的词汇）
│   │   └── content-policy.md       # 内容审核政策
│   ├── personas/                   # 账号人设目录
│   │   ├── account-123.md          # 账号 123 的人设
│   │   └── ...
│   ├── meshnet-protocol/           # 产品 A 的知识库
│   │   ├── product-info.md         # 产品介绍
│   │   ├── features.md             # 功能列表
│   │   ├── use-cases.md            # 使用场景
│   │   ├── tech-stack.md           # 技术栈
│   │   └── recent-updates.md       # 最新进展
│   ├── another-product/            # 产品 B 的知识库
│   │   └── ...
│   └── messaging-guidelines.md     # 通用推文风格指南
```

### 4.2 全局敏感词库

**文件位置**：`knowledge/global/sensitive-words.md`

这是所有 AI 定时任务共享的全局配置，用于防止敏感词汇出现在推文中。

**示例内容**：

```markdown
# 全局敏感词库

## 说明
此文件包含所有 AI 自动化任务必须遵守的敏感词规则。
任何推文或回复中**绝对不能**包含以下词汇。

## 政治敏感词
- 习近平
- 共产党
- 六四
- 天安门
- 法轮功
- 台独
- 藏独
- 疆独
- [更多政治敏感词...]

## 违禁内容
- 色情
- 赌博
- 毒品
- 暴力
- 恐怖主义
- [更多违禁词...]

## 品牌禁忌
- 竞品公司名称（如果适用）
- 负面关联词汇
- [根据业务需求添加...]

## 检查规则
1. **完全匹配**：推文中不能包含上述任何词汇的完整形式
2. **变体检查**：包括拼音、谐音、缩写等变体
3. **上下文检查**：即使单个词不敏感，组合后可能敏感的情况

## 违规处理
如果 AI 生成的内容包含敏感词：
1. 立即拒绝发送
2. 记录到日志
3. 通知管理员
4. 不进行重试（避免反复触发）
```

```markdown
# knowledge/meshnet-protocol/product-info.md

## 产品名称
MeshNetProtocol

## 一句话介绍
去中心化的 P2P 网络协议，让你的数据真正属于你

## 核心功能
- 去中心化网络通信
- 端到端加密
- 无需中心服务器
- 跨平台支持（桌面、移动）

## 目标用户
- 隐私倡导者
- 区块链开发者
- 去中心化应用开发者
- 对数据主权有要求的用户

## 关键卖点
- **真正的去中心化**: 无单点故障，无审查
- **隐私优先**: 端到端加密，数据不经过第三方
- **开源透明**: 代码完全开源，可审计
- **易于集成**: 提供多语言 SDK

## 技术栈
- Rust (核心协议)
- libp2p (P2P 网络层)
- ChaCha20-Poly1305 (加密算法)
- IPFS (分布式存储)

## 最新进展
- 2026-04-15: v2.1 发布，新增移动端支持
- 2026-04-01: 社区贡献者突破 100 人
- 2026-03-20: 集成到 3 个主流 DApp 项目

## 竞品对比
- vs Tor: 更快的连接速度，更好的移动端体验
- vs VPN: 真正的去中心化，无需信任服务提供商
- vs Signal: 不仅是通信，还是通用网络协议

## 推文建议
- 强调去中心化和隐私保护
- 结合时事热点（数据泄露、审查等）
- 技术细节要通俗易懂
- 避免过度营销，保持真诚
```

### 4.3 全局内容审核策略

**文件位置**：`knowledge/global/content-policy.md`

定义所有 AI 自动化任务必须遵守的内容审核规则。

**示例内容**：

```markdown
# 全局内容审核策略

## 审核原则
1. **安全第一**：绝不发布可能引发法律风险的内容
2. **品牌保护**：维护账号和产品的正面形象
3. **用户友好**：避免冒犯、歧视或不当内容

## 禁止内容类型
- 政治敏感话题
- 色情、暴力、恐怖主义
- 歧视性言论（种族、性别、宗教等）
- 虚假信息或误导性宣传
- 侵犯他人隐私或知识产权

## 推文质量标准
- 语法正确，无错别字
- 逻辑清晰，易于理解
- 符合推特字数限制（280 字符）
- 适当使用话题标签（最多 2-3 个）
- 避免过度营销或垃圾信息

## 审核流程
1. **AI 生成阶段**：AI 根据敏感词库和内容策略自我审查
2. **发送前检查**：执行器二次验证，检测敏感词
3. **人工审核模式**（可选）：高风险内容需人工批准
```

### 4.4 账号人设文件

除了产品知识库，每个账号还有独立的人设文件：

```
TweetPilot/
├── knowledge/
│   ├── personas/                       # 账号人设目录
│   │   ├── account-123.md              # 账号 123 的人设
│   │   ├── account-456.md              # 账号 456 的人设
│   │   └── ...
│   ├── meshnet-protocol/               # 产品知识库
│   │   └── ...
```

**人设文件示例** (`knowledge/personas/account-123.md`):

```markdown
# 账号人设：@TechGirlMary

## 基本信息
- 账号 ID: 123
- 推特用户名: @TechGirlMary
- 角色定位: 刚参加工作的女大学生

## 性格特征
- 对技术充满好奇，但还在学习中
- 活泼可爱，喜欢用网络流行语
- 遇到不懂的会虚心请教
- 偶尔会用 emoji 表达情绪（但不过度）

## 语言风格
- 说话轻松活泼，不会太正式
- 会用 "哇"、"好厉害"、"学到了" 等口语化表达
- 遇到复杂概念会说 "这个我还在学习中"
- 适当使用 emoji：😊 🤔 💡 ✨（每条推文最多 2-3 个）

## 推文示例

**好的示例**：
- "刚看到一个关于去中心化的讨论，感觉和我们用的 MeshNetProtocol 好像哦 🤔 原来数据真的可以不经过第三方，学到了！"
- "今天又看到数据泄露的新闻...感觉隐私保护真的很重要呢。MeshNetProtocol 的端到端加密设计好像就是为了解决这个问题 💡"

**避免的风格**：
- ❌ "MeshNetProtocol 采用先进的 P2P 架构，实现了真正的去中心化" （太正式、太技术）
- ❌ "🎉🎉🎉 超级厉害的产品！！！快来试试吧 🚀🚀🚀" （emoji 过度、太营销）

## 话题偏好
- 关注隐私保护、数据安全
- 对新技术感兴趣但不会装专家
- 喜欢分享学习心得
- 避免过度营销，保持真诚
```

### 4.4 AI 如何使用知识库和人设

AI Session 在生成推文时会：
1. 使用 **Read** 工具读取产品知识库文件
2. 使用 **Read** 工具读取账号人设文件
3. 使用 **Grep** 搜索相关信息
4. 使用 **Glob** 查找相关文档
5. 结合热点数据分析关联点
6. **根据账号人设调整语气和风格**
7. 生成符合人设的推文内容

---

## 五、执行结果暴露机制

### 5.1 执行结果的重要性

定时任务管理器需要知道每次 AI 任务的执行结果，以便：
- **监控任务状态**：成功/失败/超时
- **记录执行日志**：工具调用、耗时、错误信息
- **统计成本**：Token 使用量
- **调试问题**：查看 AI 的执行过程和中间结果
- **优化任务**：根据历史数据调整任务配置

### 5.2 执行结果数据结构

`ExecutionResult` 是 `AiAutonomousExecutor::execute()` 的返回值，包含完整的执行信息：

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,                    // 是否成功
    pub session_id: String,               // 使用的 Session ID (account-123)
    pub duration_ms: u64,                 // 执行耗时（毫秒）
    pub message_count: usize,             // AI 消息数量
    pub tool_calls: Vec<ToolCallRecord>,  // 工具调用记录
    pub final_output: Option<String>,     // AI 最终输出
    pub error: Option<String>,            // 错误信息（如果失败）
    pub metadata: ExecutionMetadata,      // 元数据
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolCallRecord {
    pub tool: String,           // 工具名称 (Bash, Read, Write, etc.)
    pub action: String,         // 工具参数描述
    pub success: bool,          // 是否成功
    pub duration_ms: u64,       // 耗时
    pub output: Option<String>, // 输出（截断到 500 字符）
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionMetadata {
    pub account_id: i64,
    pub task_id: i64,
    pub started_at: i64,        // Unix timestamp
    pub completed_at: i64,      // Unix timestamp
    pub token_usage: TokenUsage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
}
```

### 5.3 执行结果的获取方式

**方式一：同步返回**（推荐）

定时任务管理器直接获取 `execute()` 的返回值：

```rust
// UnifiedTimerManager 调用 AI 执行器
let executor = AiAutonomousExecutor::new(
    account_id,
    initial_prompt,
    working_dir,
    knowledge_base,
);

let result = executor.execute(context).await?;

// 检查执行结果
if result.success {
    log::info!("Task {} completed successfully", task_id);
    log::info!("Duration: {}ms, Messages: {}, Tools: {}", 
        result.duration_ms, 
        result.message_count, 
        result.tool_calls.len()
    );
    
    // 保存到数据库
    save_execution_log(&result).await?;
} else {
    log::error!("Task {} failed: {}", task_id, result.error.unwrap_or_default());
    
    // 发送通知
    notify_task_failure(task_id, &result).await?;
}
```

**方式二：事件流监听**（实时监控）

如果需要实时监控 AI 执行过程，可以订阅事件流：

```rust
// 创建事件通道
let (tx, mut rx) = mpsc::channel(100);

// 启动监听任务
tokio::spawn(async move {
    while let Some(event) = rx.recv().await {
        match event {
            SessionEvent::ToolCallStart { tool, action } => {
                log::info!("Tool started: {} - {}", tool, action);
            }
            SessionEvent::ToolCallEnd { tool, success, duration_ms, .. } => {
                log::info!("Tool completed: {} - {} ({}ms)", tool, success, duration_ms);
            }
            SessionEvent::MessageChunk { chunk } => {
                // 实时显示 AI 输出
                print!("{}", chunk);
            }
            SessionEvent::Error { message } => {
                log::error!("Error: {}", message);
            }
        }
    }
});

// 执行任务（传入事件发送器）
let result = executor.execute_with_events(context, tx).await?;
```

### 5.4 执行日志持久化

**数据库表设计**：

```sql
CREATE TABLE ai_execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    duration_ms INTEGER NOT NULL,
    message_count INTEGER NOT NULL,
    tool_call_count INTEGER NOT NULL,
    final_output TEXT,
    error TEXT,
    started_at INTEGER NOT NULL,
    completed_at INTEGER NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cache_read_tokens INTEGER NOT NULL,
    cache_write_tokens INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE ai_tool_call_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_log_id INTEGER NOT NULL,
    tool TEXT NOT NULL,
    action TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    duration_ms INTEGER NOT NULL,
    output TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (execution_log_id) REFERENCES ai_execution_logs(id)
);

CREATE INDEX idx_execution_logs_task ON ai_execution_logs(task_id);
CREATE INDEX idx_execution_logs_account ON ai_execution_logs(account_id);
CREATE INDEX idx_execution_logs_time ON ai_execution_logs(started_at);
CREATE INDEX idx_tool_logs_execution ON ai_tool_call_logs(execution_log_id);
```

**保存执行日志**：

```rust
async fn save_execution_log(result: &ExecutionResult) -> Result<()> {
    let conn = get_db_connection().await?;
    
    // 保存主记录
    let log_id = conn.execute(
        "INSERT INTO ai_execution_logs (
            task_id, account_id, session_id, success, duration_ms,
            message_count, tool_call_count, final_output, error,
            started_at, completed_at, input_tokens, output_tokens,
            cache_read_tokens, cache_write_tokens
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            result.metadata.task_id,
            result.metadata.account_id,
            result.session_id,
            result.success,
            result.duration_ms,
            result.message_count,
            result.tool_calls.len(),
            result.final_output,
            result.error,
            result.metadata.started_at,
            result.metadata.completed_at,
            result.metadata.token_usage.input_tokens,
            result.metadata.token_usage.output_tokens,
            result.metadata.token_usage.cache_read_tokens,
            result.metadata.token_usage.cache_write_tokens,
        ],
    ).await?;
    
    // 保存工具调用记录
    for tool_call in &result.tool_calls {
        conn.execute(
            "INSERT INTO ai_tool_call_logs (
                execution_log_id, tool, action, success, duration_ms, output
            ) VALUES (?, ?, ?, ?, ?, ?)",
            params![
                log_id,
                tool_call.tool,
                tool_call.action,
                tool_call.success,
                tool_call.duration_ms,
                tool_call.output,
            ],
        ).await?;
    }
    
    Ok(())
}
```

### 5.5 JSON 格式暴露（推荐）

为了方便外部系统集成，`ExecutionResult` 可以直接序列化为 JSON 格式：

**成功执行的 JSON 示例**：

```json
{
  "success": true,
  "session_id": "account-123",
  "duration_ms": 8450,
  "message_count": 3,
  "tool_calls": [
    {
      "tool": "Bash",
      "action": "python3 scripts/fetch_trends.py --limit 10",
      "success": true,
      "duration_ms": 2340,
      "output": "Found 10 trending topics:\n1. Bitcoin ETF approval\n2. AI regulation debate\n..."
    },
    {
      "tool": "Read",
      "action": "knowledge/meshnet-protocol/product-info.md",
      "success": true,
      "duration_ms": 45,
      "output": "# MeshNetProtocol\n\n去中心化的 P2P 网络协议..."
    },
    {
      "tool": "Bash",
      "action": "python3 scripts/send_tweet.py --account 123 --text '...'",
      "success": true,
      "duration_ms": 1820,
      "output": "Tweet sent successfully. ID: 1234567890"
    }
  ],
  "final_output": "任务完成！已成功发送推文，内容结合了当前热点 'Bitcoin ETF approval' 和 MeshNetProtocol 的去中心化特性。推文 ID: 1234567890",
  "error": null,
  "metadata": {
    "account_id": 123,
    "task_id": 456,
    "started_at": 1713686400,
    "completed_at": 1713686408,
    "token_usage": {
      "input_tokens": 12450,
      "output_tokens": 890,
      "cache_read_tokens": 8500,
      "cache_write_tokens": 0
    }
  }
}
```

**失败执行的 JSON 示例**：

```json
{
  "success": false,
  "session_id": "account-123",
  "duration_ms": 3200,
  "message_count": 2,
  "tool_calls": [
    {
      "tool": "Bash",
      "action": "python3 scripts/fetch_trends.py --limit 10",
      "success": true,
      "duration_ms": 2340,
      "output": "Found 10 trending topics:\n1. Bitcoin ETF approval\n..."
    },
    {
      "tool": "Read",
      "action": "knowledge/meshnet-protocol/product-info.md",
      "success": false,
      "duration_ms": 12,
      "output": "Error: File not found"
    }
  ],
  "final_output": null,
  "error": "Failed to read product knowledge base: knowledge/meshnet-protocol/product-info.md not found",
  "metadata": {
    "account_id": 123,
    "task_id": 456,
    "started_at": 1713686400,
    "completed_at": 1713686403,
    "token_usage": {
      "input_tokens": 8200,
      "output_tokens": 320,
      "cache_read_tokens": 5100,
      "cache_write_tokens": 0
    }
  }
}
```

**Tauri Command 暴露接口**：

```rust
// 前端可以通过 Tauri Command 获取执行结果
#[tauri::command]
pub async fn get_task_execution_result(
    execution_log_id: i64,
) -> Result<ExecutionResult, String> {
    let log = get_execution_log_from_db(execution_log_id).await?;
    let tool_calls = get_tool_call_logs_from_db(execution_log_id).await?;
    
    Ok(ExecutionResult {
        success: log.success,
        session_id: log.session_id,
        duration_ms: log.duration_ms as u64,
        message_count: log.message_count as usize,
        tool_calls,
        final_output: log.final_output,
        error: log.error,
        metadata: ExecutionMetadata {
            account_id: log.account_id,
            task_id: log.task_id,
            started_at: log.started_at,
            completed_at: log.completed_at,
            token_usage: TokenUsage {
                input_tokens: log.input_tokens as u64,
                output_tokens: log.output_tokens as u64,
                cache_read_tokens: log.cache_read_tokens as u64,
                cache_write_tokens: log.cache_write_tokens as u64,
            },
        },
    })
}
```

**前端使用示例**：

```typescript
// 获取最新执行结果
const result = await invoke<ExecutionResult>('get_task_execution_result', {
  executionLogId: 123
});

// 检查执行状态
if (result.success) {
  console.log('✓ Task completed successfully');
  console.log(`Duration: ${result.duration_ms}ms`);
  console.log(`Tools used: ${result.tool_calls.length}`);
  console.log(`Output: ${result.final_output}`);
} else {
  console.error('✗ Task failed:', result.error);
  
  // 查看失败的工具调用
  const failedTools = result.tool_calls.filter(tc => !tc.success);
  failedTools.forEach(tc => {
    console.error(`  - ${tc.tool} failed: ${tc.output}`);
  });
}

// 计算成本
const totalTokens = result.metadata.token_usage.input_tokens + 
                    result.metadata.token_usage.output_tokens;
const cost = calculateCost(totalTokens); // 根据 API 定价计算
console.log(`Cost: $${cost.toFixed(4)}`);
```

### 5.6 执行结果的使用场景

**场景一：任务监控面板**

前端可以查询执行日志，展示任务执行历史：

```typescript
// 获取任务执行历史
const logs = await invoke<ExecutionLog[]>('get_task_execution_logs', { 
  taskId: 123,
  limit: 20 
});

// 展示统计信息
const stats = {
  totalRuns: logs.length,
  successRate: logs.filter(l => l.success).length / logs.length,
  avgDuration: logs.reduce((sum, l) => sum + l.duration_ms, 0) / logs.length,
  totalTokens: logs.reduce((sum, l) => sum + l.input_tokens + l.output_tokens, 0),
};
```

**场景二：失败重试**

定时任务管理器根据执行结果决定是否重试：

```rust
let result = executor.execute(context).await?;

if !result.success {
    if should_retry(&result) {
        log::info!("Retrying task {} (attempt {}/{})", task_id, attempt, max_retries);
        tokio::time::sleep(Duration::from_secs(60)).await;
        return retry_task(task_id, attempt + 1).await;
    } else {
        log::error!("Task {} failed permanently: {}", task_id, result.error.unwrap());
        notify_admin(task_id, &result).await?;
    }
}
```

**场景三：成本统计**

统计 AI 使用成本：

```sql
-- 按账号统计 Token 使用量
SELECT 
    account_id,
    COUNT(*) as execution_count,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(cache_read_tokens) as total_cache_read_tokens,
    SUM(input_tokens + output_tokens) as total_tokens
FROM ai_execution_logs
WHERE started_at >= strftime('%s', 'now', '-30 days')
GROUP BY account_id
ORDER BY total_tokens DESC;
```

**场景四：调试工具**

查看 AI 的执行过程，定位问题：

```rust
// 获取详细执行日志
let log = get_execution_log(log_id).await?;
let tool_calls = get_tool_call_logs(log_id).await?;

println!("Task: {}, Account: {}", log.task_id, log.account_id);
println!("Duration: {}ms, Messages: {}", log.duration_ms, log.message_count);
println!("\nTool Calls:");
for (i, tc) in tool_calls.iter().enumerate() {
    println!("  {}. {} - {} ({}ms) {}", 
        i + 1, 
        tc.tool, 
        tc.action, 
        tc.duration_ms,
        if tc.success { "✓" } else { "✗" }
    );
    if let Some(output) = &tc.output {
        println!("     Output: {}", output);
    }
}

if let Some(error) = &log.error {
    println!("\nError: {}", error);
}
```

---

## 六、账号人设管理

### 5.1 人设的作用

账号人设是 AI 自主工作流的核心特性之一，它确保：
- **一致性**：同一账号发出的所有推文保持统一的语气和风格
- **个性化**：不同账号可以有完全不同的人设（专业、活泼、严肃等）
- **真实感**：AI 生成的内容更像真人发布，而不是机器生成
- **品牌塑造**：通过持续的人设表现，建立账号的独特形象

### 5.2 人设的存储方式

**方式一：数据库字段**（推荐用于简短人设）
```sql
-- accounts 表中的 persona 字段
UPDATE accounts 
SET persona = '你是一个刚刚参加工作的女大学生，对技术充满好奇但还在学习中。
说话语气活泼可爱，偶尔会用一些网络流行语，遇到不懂的会虚心请教。'
WHERE id = 123;
```

**方式二：独立 Markdown 文件**（推荐用于详细人设）
```
knowledge/personas/account-123.md
```

优先读取 Markdown 文件，如果不存在则使用数据库字段。

### 5.3 人设与敏感词注入机制

**System Prompt 注入**：
在创建 AI Session 时，将人设和全局敏感词规则注入到 System Prompt 中：

```rust
let system_prompt = format!(
    "你是一个 AI 助手，负责为推特账号执行自动化任务。\n\n\
    ## 全局内容审核规则（最高优先级）\n\
    {}\n\n\
    **重要**：以下敏感词**绝对不能**出现在任何推文或回复中：\n\
    {}\n\n\
    如果你生成的内容包含任何敏感词，立即停止并报告错误。\n\
    不要尝试使用谐音、拼音、缩写等变体来绕过检查。\n\n\
    ## 账号人设\n\
    {}\n\n\
    在生成推文或回复时，请始终保持这个人设，使用符合人设的语气和风格。\n\
    避免重复之前发过的内容，根据历史效果优化推文质量。",
    content_policy,
    sensitive_words,
    persona
);
```

**关键特性**：
- System Prompt 在整个 Session 生命周期内有效
- 敏感词规则优先级最高，置于人设之前
- AI 在每次生成推文时都会自我审查
- 无需每次执行任务时重复输入规则
- Claurst 的 Compact 机制会保留 System Prompt

### 5.4 人设与知识库的协同

AI 在生成推文时会同时参考：
1. **产品知识库**：了解产品特性、卖点、技术细节
2. **账号人设**：决定如何表达这些内容

**示例**：

同样的产品信息 "MeshNetProtocol 提供端到端加密"，不同人设会有不同表达：

**人设 A（技术专家）**：
```
MeshNetProtocol 采用 ChaCha20-Poly1305 加密算法，
实现真正的端到端加密。你的数据在传输过程中完全不可见。
```

**人设 B（女大学生）**：
```
刚了解到 MeshNetProtocol 用的是端到端加密 🔒 
意思是数据传输过程中别人完全看不到，感觉好安全！
这个技术好像叫 ChaCha20 什么的，还在学习中 😊
```

### 5.5 人设的更新和维护

**更新人设**：
- 通过 UI 界面编辑账号人设
- 修改后立即生效（下次任务执行时使用新人设）
- 已存在的 AI Session 会在下次 Compact 时更新 System Prompt

**人设版本管理**（可选）：
```
knowledge/personas/account-123/
├── current.md          # 当前使用的人设
├── v1-initial.md       # 历史版本 1
└── v2-refined.md       # 历史版本 2
```

---

## 六、执行流程

### 5.1 完整执行流程（账号级 Session）

```
1. UnifiedTimerManager 触发任务
   任务配置: account_id = 123 (@TechGirlMary)
   ↓
2. AiAutonomousExecutor 获取或创建账号级 AI Session
   Session ID: account-123 (固定 ID，绑定账号，复用上下文)
   
   首次创建时注入 System Prompt:
   "你是 @TechGirlMary，一个刚参加工作的女大学生。
    对技术充满好奇但还在学习中，说话活泼可爱，
    偶尔用网络流行语，遇到不懂的会虚心请教。
    
    在生成推文时，请始终保持这个人设，使用轻松活泼的语气，
    适当使用 emoji（每条推文最多 2-3 个），避免过于正式或技术化。"
   ↓
3. 构建完整提示词
   "执行 scripts/fetch_trends.py 获取热点，
    阅读 knowledge/meshnet-protocol/ 下的所有文档，
    阅读 knowledge/personas/account-123.md 了解我的人设，
    分析热点与产品的关联点，
    生成 1-3 条推文（280 字以内，符合我的人设），
    用 scripts/send_tweet.py --account 123 发送"
   ↓
4. 发送给 AI Session
   ↓
5. AI 自主执行:
   a. Bash: python scripts/fetch_trends.py
      输出: ["数据泄露", "去中心化社交", "隐私法案"]
   
   b. Read: knowledge/meshnet-protocol/product-info.md
      Read: knowledge/meshnet-protocol/features.md
      Read: knowledge/personas/account-123.md  # 读取人设文件
   
   c. AI 分析:
      - 热点 "数据泄露" 与产品 "去中心化" 高度相关
      - 人设: 刚工作的女大学生，活泼可爱，不装专家
      - 语气: 轻松、好奇、真诚
   
   d. AI 生成推文（符合人设）:
      "刚看到又一个数据泄露的新闻...感觉隐私保护真的好重要 🤔 
      我们用的 MeshNetProtocol 好像就是为了解决这个问题，
      数据都在自己设备上，不经过第三方。学到了！💡"
   
   e. Bash: python scripts/send_tweet.py --account 123 --content "..."
      输出: "Tweet sent: https://twitter.com/TechGirlMary/status/123"
   ↓
6. 返回执行结果
   ExecutionResult {
     success: true,
     output: "Tweet sent successfully",
     duration: 45s,
     account_id: 123
   }
   ↓
7. 记录执行日志
   保存到: ~/.tweetpilot/automation-logs/account-123/<timestamp>.json
   
   AI Session 保留上下文:
   - 记住这次发的推文内容
   - 下次执行时避免重复
   - 根据效果调整风格
```

### 5.2 错误处理

```rust
// 重试策略
pub struct RetryPolicy {
    max_retries: u32,           // 最大重试次数
    backoff: ExponentialBackoff, // 指数退避
    retry_on: Vec<ErrorType>,    // 哪些错误需要重试
}

// 可重试的错误类型
pub enum ErrorType {
    NetworkError,      // 网络错误
    ApiRateLimit,      // API 限流
    ScriptTimeout,     // 脚本超时
    TemporaryFailure,  // 临时失败
}

// 不可重试的错误
// - 脚本不存在
// - 知识库路径错误
// - AI 拒绝执行（内容违规等）
```

---

## 六、用户界面

### 6.1 任务创建界面

在现有的任务创建界面添加 "AI 工作流" 选项：

```
┌─────────────────────────────────────────────────────────┐
│ 创建任务                                                 │
├─────────────────────────────────────────────────────────┤
│ 任务类型: ○ Python 脚本  ● AI 工作流                    │
│                                                         │
│ 任务名称: [MeshNet 热点推文生成]                        │
│                                                         │
│ 推特账号: [▼ @TechGirlMary (ID: 123)]                  │
│           人设: 刚参加工作的女大学生，活泼可爱...       │
│           [编辑人设]                                     │
│                                                         │
│ 定时规则:                                                │
│ ○ Interval  间隔: [4] 小时                              │
│ ○ Cron      表达式: [0 */4 * * *]                       │
│                                                         │
│ 工作目录: [/Users/hyperorchid/MeshNetProtocol]          │
│                                                         │
│ 知识库路径 (可选):                                       │
│ [knowledge/meshnet-protocol/]                           │
│                                                         │
│ AI 指令:                                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 1. 执行 scripts/fetch_crypto_trends.py 获取加密货币 │ │
│ │    和隐私相关的热点话题                              │ │
│ │ 2. 阅读 knowledge/meshnet-protocol/ 下的所有文档    │ │
│ │    了解产品特性和卖点                                │ │
│ │ 3. 阅读我的账号人设，保持人设一致性                  │ │
│ │ 4. 分析热点与产品的关联点                            │ │
│ │ 5. 生成 1-3 条推文（280 字以内，符合我的人设）       │ │
│ │ 6. 使用 scripts/send_tweet.py 发送推文              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 高级选项:                                                │
│ 超时时间: [600] 秒                                       │
│ 最大重试: [3] 次                                         │
│                                                         │
│ [取消]  [保存]                                           │
└─────────────────────────────────────────────────────────┘
```

### 6.2 执行历史查看

```
┌─────────────────────────────────────────────────────────┐
│ 任务执行历史: MeshNet 热点推文生成                       │
│ 账号: @TechGirlMary (ID: 123)                           │
├─────────────────────────────────────────────────────────┤
│ 2026-04-22 11:00  ✓ 成功  45s                          │
│ └─ 生成推文: "刚看到又一个数据泄露的新闻...感觉隐私保护  │
│    真的好重要 🤔 我们用的 MeshNetProtocol..."           │
│    发送成功: https://twitter.com/TechGirlMary/status/123│
│    AI Session: account-123 (上下文: 156 条消息)         │
│                                                         │
│ 2026-04-22 07:00  ✓ 成功  38s                          │
│ └─ 生成推文: "今天学到了去中心化的概念，原来数据可以不  │
│    经过第三方 💡 感觉好厉害..."                          │
│    发送成功: https://twitter.com/TechGirlMary/status/122│
│    AI Session: account-123 (上下文: 152 条消息)         │
│                                                         │
│ 2026-04-22 03:00  ✗ 失败  120s                         │
│ └─ 错误: API rate limit exceeded, 将在 1 小时后重试     │
│    AI Session: account-123 (上下文: 148 条消息)         │
│                                                         │
│ [查看详细日志]  [手动重试]  [查看 AI Session]            │
└─────────────────────────────────────────────────────────┘
```

---

## 七、与现有系统集成

### 7.1 UnifiedTimerManager 集成

```rust
// 在任务加载时判断类型
pub async fn load_tasks_from_database(
    db: &TaskDatabase,
    timer_manager: &UnifiedTimerManager,
) -> Result<()> {
    let tasks = db.get_all_tasks()?;
    
    for task in tasks {
        let executor: Box<dyn TimerExecutor> = match task.task_type.as_str() {
            "python_script" => {
                // 传统 Python 脚本任务
                Box::new(PythonScriptExecutor {
                    script_path: task.script_path,
                    parameters: task.parameters,
                })
            }
            "ai_workflow" => {
                // AI 自主工作流任务
                let config: AiWorkflowConfig = serde_json::from_str(&task.ai_workflow_config)?;
                Box::new(AiAutonomousExecutor {
                    account_id: config.account_id,  // 账号 ID
                    initial_prompt: config.initial_prompt,
                    working_dir: config.working_dir,
                    knowledge_base: config.knowledge_base,
                })
            }
            _ => return Err("Unknown task type".into()),
        };
        
        let timer = Timer {
            id: task.id,
            name: task.name,
            timer_type: task.timer_type,
            executor,
            enabled: task.enabled,
            priority: 50,
            next_execution: calculate_next_execution(&task.timer_type),
            last_execution: None,
        };
        
        timer_manager.register_timer(timer).await?;
    }
    
    Ok(())
}
```

### 7.2 AI Session 管理（账号级）

```rust
// 账号级 AI Session 管理
pub struct AutomationSessionManager {
    sessions: HashMap<String, Arc<Mutex<ClaurstSession>>>,
    personas: HashMap<i64, String>,  // 缓存账号人设
}

impl AutomationSessionManager {
    // 获取或创建账号级 AI Session
    pub async fn get_or_create_session(
        &mut self,
        account_id: i64,
        working_dir: &str,
    ) -> Result<Arc<Mutex<ClaurstSession>>> {
        let session_id = format!("account-{}", account_id);
        
        // 如果 session 已存在，直接返回
        if let Some(session) = self.sessions.get(&session_id) {
            return Ok(session.clone());
        }
        
        // 加载账号人设
        let persona = self.load_persona(account_id, working_dir).await?;
        
        // 构建 System Prompt（注入人设）
        let system_prompt = format!(
            "你是一个 AI 助手，负责为推特账号执行自动化任务。\n\n\
            ## 账号人设\n\
            {}\n\n\
            在生成推文或回复时，请始终保持这个人设，使用符合人设的语气和风格。\n\
            避免重复之前发过的内容，根据历史效果优化推文质量。",
            persona
        );
        
        // 创建新 session
        let session = create_claurst_session(
            &session_id,
            working_dir,
            Some(system_prompt),
        ).await?;
        
        let session_arc = Arc::new(Mutex::new(session));
        self.sessions.insert(session_id, session_arc.clone());
        self.personas.insert(account_id, persona);
        
        Ok(session_arc)
    }
    
    // 加载账号人设
    async fn load_persona(&self, account_id: i64, working_dir: &str) -> Result<String> {
        // 优先读取 Markdown 文件
        let persona_path = format!(
            "{}/knowledge/personas/account-{}.md",
            working_dir,
            account_id
        );
        
        if Path::new(&persona_path).exists() {
            return fs::read_to_string(&persona_path).await;
        }
        
        // 如果文件不存在，从数据库读取
        let account = get_account_by_id(account_id).await?;
        Ok(account.persona.unwrap_or_else(|| {
            "你是一个专业的推特账号运营者，保持真诚友好的语气。".to_string()
        }))
    }
    
    // 更新账号人设（触发 Session 重建）
    pub async fn update_persona(
        &mut self,
        account_id: i64,
        new_persona: String,
    ) -> Result<()> {
        let session_id = format!("account-{}", account_id);
        
        // 移除旧 session（下次执行时会用新人设重建）
        self.sessions.remove(&session_id);
        self.personas.insert(account_id, new_persona);
        
        Ok(())
    }
    
    // 清理长时间未使用的会话
    pub async fn cleanup_idle_sessions(&mut self, idle_threshold: Duration) {
        let now = Instant::now();
        let mut to_remove = Vec::new();
        
        for (session_id, session) in &self.sessions {
            let session = session.lock().await;
            if now.duration_since(session.last_activity) > idle_threshold {
                to_remove.push(session_id.clone());
            }
        }
        
        for session_id in to_remove {
            self.sessions.remove(&session_id);
        }
    }
}
```

---

## 八、成本控制

### 8.1 使用限制

```rust
pub struct UsageLimits {
    max_daily_requests: u32,      // 每日最大请求数
    max_monthly_cost: f64,        // 每月最大费用（美元）
    alert_threshold: f64,         // 告警阈值（百分比）
}

// 在执行前检查
impl AiAutonomousExecutor {
    async fn check_usage_limits(&self) -> Result<bool> {
        let usage = get_current_usage().await?;
        let limits = get_usage_limits().await?;
        
        if usage.daily_requests >= limits.max_daily_requests {
            return Err("Daily request limit reached".into());
        }
        
        if usage.monthly_cost >= limits.max_monthly_cost {
            return Err("Monthly cost limit reached".into());
        }
        
        if usage.monthly_cost / limits.max_monthly_cost > limits.alert_threshold {
            send_alert("Approaching monthly cost limit").await?;
        }
        
        Ok(true)
    }
}
```

### 8.2 使用统计

```json
// ~/.tweetpilot/usage-stats.json
{
  "daily": {
    "2026-04-22": {
      "requests": 6,
      "tokens": 45000,
      "cost": 0.23
    }
  },
  "monthly": {
    "2026-04": {
      "requests": 180,
      "tokens": 1350000,
      "cost": 6.75
    }
  }
}
```

---

## 九、安全考虑

### 9.1 沙箱执行

- Python 脚本在受限环境中执行
- 限制文件系统访问范围（仅限工作目录）
- 限制网络访问（仅允许配置的 API）
- 限制执行时间（默认 10 分钟超时）

### 9.2 内容审核（多层防护）

**第一层：AI 自我审查**
通过 System Prompt 注入敏感词规则，AI 在生成推文时自动避免敏感词。

**第二层：发送前检查**
在执行 `send_tweet.py` 之前，执行器进行二次验证：

```rust
// AI 生成内容审核
pub struct ContentReviewer {
    sensitive_words: Vec<String>,
    sensitive_patterns: Vec<Regex>,
}

impl ContentReviewer {
    // 从知识库加载敏感词
    pub async fn load_from_knowledge_base(working_dir: &str) -> Result<Self> {
        let sensitive_words_path = format!(
            "{}/knowledge/global/sensitive-words.md",
            working_dir
        );
        
        let content = fs::read_to_string(&sensitive_words_path).await?;
        let words = Self::parse_sensitive_words(&content);
        let patterns = Self::build_patterns(&words);
        
        Ok(Self {
            sensitive_words: words,
            sensitive_patterns: patterns,
        })
    }
    
    // 解析敏感词文件
    fn parse_sensitive_words(content: &str) -> Vec<String> {
        content
            .lines()
            .filter(|line| !line.starts_with('#') && !line.trim().is_empty())
            .filter(|line| !line.starts_with("##") && !line.starts_with('-'))
            .map(|line| line.trim().to_string())
            .collect()
    }
    
    // 构建正则表达式（检测变体）
    fn build_patterns(words: &[String]) -> Vec<Regex> {
        words
            .iter()
            .map(|word| {
                // 支持拼音、谐音、空格分隔等变体
                let pattern = word
                    .chars()
                    .map(|c| format!("{}\\s*", regex::escape(&c.to_string())))
                    .collect::<String>();
                Regex::new(&pattern).unwrap()
            })
            .collect()
    }
    
    // 审核内容
    pub fn review(&self, content: &str) -> Result<ReviewResult> {
        // 完全匹配检查
        for word in &self.sensitive_words {
            if content.contains(word) {
                return Ok(ReviewResult::Rejected {
                    reason: format!("包含敏感词: {}", word),
                    matched_word: word.clone(),
                });
            }
        }
        
        // 变体检查（正则表达式）
        for (i, pattern) in self.sensitive_patterns.iter().enumerate() {
            if pattern.is_match(content) {
                return Ok(ReviewResult::Rejected {
                    reason: format!("包含敏感词变体: {}", self.sensitive_words[i]),
                    matched_word: self.sensitive_words[i].clone(),
                });
            }
        }
        
        // 检查是否包含个人信息（可选）
        if self.contains_pii(content) {
            return Ok(ReviewResult::Warning {
                reason: "可能包含个人信息".to_string(),
            });
        }
        
        Ok(ReviewResult::Approved)
    }
    
    // 检查个人信息
    fn contains_pii(&self, content: &str) -> bool {
        // 简单的 PII 检测（手机号、邮箱等）
        let phone_pattern = Regex::new(r"\d{11}").unwrap();
        let email_pattern = Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b").unwrap();
        
        phone_pattern.is_match(content) || email_pattern.is_match(content)
    }
}

pub enum ReviewResult {
    Approved,
    Rejected { reason: String, matched_word: String },
    Warning { reason: String },
}

// 在 AiAutonomousExecutor 中使用
impl AiAutonomousExecutor {
    async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult> {
        // ... AI 生成推文 ...
        
        // 发送前审核
        let reviewer = ContentReviewer::load_from_knowledge_base(&self.working_dir).await?;
        let review_result = reviewer.review(&generated_tweet)?;
        
        match review_result {
            ReviewResult::Approved => {
                // 继续发送
            }
            ReviewResult::Rejected { reason, matched_word } => {
                // 拒绝发送，记录日志
                log::error!("推文被拒绝: {}", reason);
                return Err(format!("内容审核失败: {}", reason).into());
            }
            ReviewResult::Warning { reason } => {
                // 记录警告，但允许发送（可配置）
                log::warn!("推文警告: {}", reason);
            }
        }
        
        // 执行发送脚本
        // ...
    }
}
```

**第三层：人工审核模式（可选）**
对于高风险账号或敏感时期，可以启用人工审核模式。

### 9.3 人工审核模式

```rust
pub enum ApprovalMode {
    Automatic,      // 自动发送
    ManualReview,   // 人工审核后发送
    DryRun,         // 仅生成不发送
}

// 在任务配置中添加
pub struct AiWorkflowConfig {
    // ... 其他字段
    approval_mode: ApprovalMode,
}
```

---

## 十、实施计划

### 阶段 1：核心功能（3-4 天）

**目标**：实现基础的 AI 自主工作流执行和账号级 Session 管理

**任务**：
1. 实现 `AiAutonomousExecutor`（支持账号级 Session）
2. 扩展数据库支持 AI 工作流任务和账号人设
   - `tasks` 表添加 `account_id` 字段
   - `accounts` 表添加 `persona` 字段
3. 实现账号级 AI Session 创建和管理
   - Session ID 格式：`account-{account_id}`
   - 人设注入到 System Prompt
4. 实现基础的错误处理和重试

**验收标准**：
- 能够创建 AI 工作流任务并绑定推特账号
- AI 能够执行 Python 脚本并读取输出
- AI 能够读取产品知识库和账号人设文件
- 生成的推文符合账号人设
- 执行结果正确记录

### 阶段 2：用户界面（2-3 天）

**目标**：提供友好的任务配置界面

**任务**：
1. 任务创建界面添加 "AI 工作流" 选项
2. 实现知识库路径选择器
3. 实现执行历史查看
4. 实现详细日志查看

**验收标准**：
- 用户可以通过 UI 创建 AI 工作流任务
- 可以查看执行历史和详细日志
- UI 响应流畅，无明显卡顿

### 阶段 3：增强功能（2-3 天）

**目标**：添加成本控制和安全特性

**任务**：
1. 实现使用限制和统计
2. 实现内容审核
3. 实现人工审核模式
4. 实现会话清理机制

**验收标准**：
- 成本控制生效，超限时停止执行
- 敏感内容被拦截
- 人工审核模式正常工作

### 阶段 4：测试和优化（1-2 天）

**目标**：确保系统稳定可靠

**任务**：
1. 端到端测试
2. 性能优化
3. 文档完善
4. 用户指南编写

**验收标准**：
- 所有测试用例通过
- 性能满足要求（执行延迟 < 1 分钟）
- 文档完整清晰

**总计**: 8-12 天

---

## 十一、优势与限制

### 11.1 核心优势

**极简配置**：
- 用户只需用自然语言描述任务
- 无需定义步骤、变量、条件分支
- 降低使用门槛

**灵活性极高**：
- AI 可以根据实际情况动态调整执行流程
- 支持复杂的多步骤工作流
- 可以处理意外情况

**易于扩展**：
- 添加新功能只需更新提示词
- 无需修改代码
- 支持多种场景（推文生成、内容分析、数据处理等）

**智能关联**：
- AI 自动找到热点与产品的关联点
- 不是简单的模板填充
- 真正的智能分析

### 11.2 潜在限制

**不可预测性**：
- AI 可能不按预期执行
- 需要好的提示词工程
- 可能需要多次调整

**成本较高**：
- 每次执行都会调用 AI API
- 需要严格的成本控制
- 适合低频任务（每天几次）

**执行时间**：
- AI 思考 + 工具调用比固定流程慢
- 可能需要 30-60 秒完成
- 不适合实时任务

**依赖 AI 能力**：
- 受限于 AI 模型的能力
- 复杂逻辑可能出错
- 需要人工监督

---

## 十二、未来扩展

### 12.1 多步骤工作流可视化

在执行历史中展示 AI 的执行步骤：

```
执行步骤:
1. ✓ 执行 fetch_trends.py (3s)
2. ✓ 读取 product-info.md (1s)
3. ✓ 读取 features.md (1s)
4. ✓ 分析热点关联 (15s)
5. ✓ 生成推文内容 (8s)
6. ✓ 执行 send_tweet.py (2s)
```

### 12.2 工作流模板

提供常用工作流模板：

```
模板 1: 热点推文生成
模板 2: 代码更新推文
模板 3: 竞品分析报告
模板 4: 用户反馈分析
```

### 12.3 多账号支持

为不同推特账号配置不同的知识库和风格：

```
账号 A (技术向): knowledge/tech-focused/
账号 B (商业向): knowledge/business-focused/
```

### 12.4 A/B 测试

AI 生成多个版本的推文，自动选择效果最好的：

```
生成 3 个版本 → 发送到测试账号 → 分析互动数据 → 选择最佳版本
```

---

## 十三、参考资料

### 13.1 相关文档

- [AI 集成方案](ai-integration-plan.md) - AI 模块整体设计
- [定时器系统设计](timer-system-design.md) - UnifiedTimerManager 架构
- [Claurst 架构分析](../microcompany/docs/Claurst架构分析.md) - Claurst 工具链详解

### 13.2 技术栈

- **Claurst**: AI Session 管理和工具调用
- **UnifiedTimerManager**: 定时任务调度
- **Tauri**: 跨平台桌面应用框架
- **React + TypeScript**: 前端界面

---

**文档状态**: ✅ 设计完成，待实施  
**最后更新**: 2026-04-22
